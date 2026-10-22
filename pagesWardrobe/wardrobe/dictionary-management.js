const apiFactory = require('../../api/wardrobe-dictionaries')
const optionsStore = require('../../stores/wardrobe-options')
const familyStore = require('../../stores/family')
const settings = require('../../utils/bookkeeping-settings')


const TYPE_TEXT = { CATEGORY: '衣物品类', ITEM_STYLE: '衣物款式', COLOR: '衣物颜色', SCENE: '使用场景', STYLE: '穿搭风格' }
const PLACEHOLDER = { CATEGORY: '如：外套', ITEM_STYLE: '如：衬衫', COLOR: '如：米色', SCENE: '如：通勤', STYLE: '如：简约' }
// 实例私有字段（不放入 data）：
// this._request 请求序号；this._identityKey 上次请求上下文（含用户/会话/家庭，禁止打印）；
// this._sortBaseline/_sortVersion 排序基线与进入版本；this._sortRects 行矩形缓存；
// this._touch/_drag 触摸与拖动状态；this._measureSeq/_scrollTimer 测量与自动滚动计时器；this._disposed 卸载标记。
module.exports = function createDictionaryManagement(type) {
  const personalOnly = false
  const identityKey = optionsStore.identity
  return {
    data: {
      type,
      parentItems: [], parentIndex: 0, selectedParentId: null, selectedParent: null,
      matchKindIndex: 10,
      matchKinds: ['上装', '下装', '连衣裙', '内衣', '袜子', '鞋履', '配饰', '帽子', '包袋', '首饰', '其他'],
      personalOnly,
      typeText: TYPE_TEXT[type] || '选项',
      placeholder: PLACEHOLDER[type] || '请输入名称',
      scope: 'PERSONAL',
      hasFamily: false,
      canManage: false,
      items: [],
      enabledItems: [],
      disabledItems: [],
      disabledCount: 0,
      showDisabled: false,
      loading: true,
      loadedOnce: false,
      loadError: '',
      refreshFailed: false,
      busy: false,
      busyAction: '',
      writeError: '',
      sorting: false,
      sortItems: [],
      sortError: '',
      dragItem: null,
      dragTop: 0,
      dragIndex: -1,
      activeSheet: '',
      editing: null,
      draftName: '',
      nameCount: 0,
      nameError: '',
      nameUnchanged: false,
      canSaveName: false,
      menuItem: null,
      deleteItem: null,
      copyItems: [],
      copySelectedIds: [],
      copyLoading: false,
      copyError: '',
      keyboardHeight: 0,
      safeBottom: 0
    },

    onLoad() {
      this._api = apiFactory.management(this)
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        const safeBottom = Math.max(0, (info.screenHeight || info.windowHeight || 0) - ((info.safeArea && info.safeArea.bottom) || info.screenHeight || info.windowHeight || 0))
        this.setData({ safeBottom })
      } catch (error) { this.setData({ safeBottom: 0 }) }
    },

    onShow() {
      const identity = identityKey()
      if (this._identityKey && identity !== this._identityKey) {
        // 身份/家庭变化：清理旧弹层、草稿、排序与复制状态，回到初始范围。
        this._resetTransient()
        this.setData({ scope: 'PERSONAL', items: [], enabledItems: [], disabledItems: [], disabledCount: 0, loadedOnce: false })
      }
      this._identityKey = identity
      this.load(true)
    },

    onHide() { this._resetDragState() },

    onUnload() {
      this._disposed = true
      this._request = (this._request || 0) + 1
      this._resetDragState()
      if (this._scrollTimer) clearInterval(this._scrollTimer)
    },

    noop() {},

    _closeSheets() {
      this.setData({ activeSheet: '', menuItem: null, deleteItem: null, writeError: '', keyboardHeight: 0 })
    },

    _resetTransient() {
      this._resetDragState()
      this._sortBaseline = null
      this._sortVersion = null
      this._closeSheets()
      this.setData({
        editing: null, draftName: '', nameCount: 0, nameError: '', nameUnchanged: false, canSaveName: false,
        sorting: false, sortItems: [], sortError: '', showDisabled: false,
        copyItems: [], copySelectedIds: [], copyLoading: false, copyError: '', refreshFailed: false, writeError: ''
      })
    },

    _deriveList() {
      const enabledItems = []
      const disabledItems = []
      this.data.items.forEach((item) => { (item.enabled ? enabledItems : disabledItems).push(item) })
      const patch = { enabledItems, disabledItems, disabledCount: disabledItems.length }
      if (!disabledItems.length) patch.showDisabled = false
      this.setData(patch)
    },

    async load(refreshFamily = false) {
      if (this._disposed) return
      const requestId = this._request = (this._request || 0) + 1
      this.setData(this.data.loadedOnce
        ? { loading: false, loadError: '' }
        : { loading: true, loadError: '', canManage: false, items: [], enabledItems: [], disabledItems: [], disabledCount: 0 })
      try {
        if (!personalOnly && refreshFamily) await familyStore.fetchMyGroup()
        const group = personalOnly ? null : await familyStore.ensureMyGroupLoaded()
        if (requestId !== this._request) return
        // identity 必须在家庭组确认后捕获，否则首次加载时家庭到达会误判响应过期。
        const identity = identityKey()
        const scope = group ? this.data.scope : 'PERSONAL'
        const res = await this._api.list(type, scope)
        if (requestId !== this._request || identity !== identityKey()) return
        const data = res.data || {}
        this.setData({
          scope, hasFamily: Boolean(group), canManage: Boolean(data.canManage),
          items: data.items || [], scopeVersion: data.scopeVersion,
          loadedOnce: true, loading: false, loadError: '', refreshFailed: false, busy: false, busyAction: ''
        })
        this._deriveList()
      } catch (error) {
        if (requestId !== this._request) return
        if (this.data.loadedOnce) this.setData({ refreshFailed: true, loading: false })
        else this.setData({ loading: false, loadError: (error && error.message) || '加载失败', canManage: false })
      }
    },

    retryLoad() { this.load(false) },

    retryRefresh() {
      // 写成功后的只读刷新重试：不重复发送任何写请求。
      const requestId = this._request
      const identity = identityKey()
      return this._reload(requestId, identity)
    },

    // 写成功后的权威刷新；失败只置 refreshFailed，不破坏已保存结果。
    async _reload(requestId, identity) {
      try {
        const group = personalOnly ? null : await familyStore.ensureMyGroupLoaded()
        if (requestId !== this._request) return
        const scope = group ? this.data.scope : 'PERSONAL'
        const res = await this._api.list(type, scope)
        if (requestId !== this._request || identity !== identityKey()) return
        const data = res.data || {}
        this.setData({
          scope, hasFamily: Boolean(group), canManage: Boolean(data.canManage),
          items: data.items || [], scopeVersion: data.scopeVersion, loadError: '', refreshFailed: false
        })
        this._deriveList()
      } catch (error) {
        if (requestId !== this._request || identity !== identityKey()) return
        this.setData({ refreshFailed: true })
      }
    },

    changeScope(event) {
      if (personalOnly || this.data.busy || this.data.sorting) return
      const scope = event.currentTarget.dataset.scope
      if (scope === this.data.scope) return
      this._request = (this._request || 0) + 1
      this._resetTransient()
      this.setData({ scope, items: [], enabledItems: [], disabledItems: [], disabledCount: 0, loadedOnce: false, loading: true, selectedParentId: null, selectedParent: null })
      this.load(false)
    },

    changeParent(event) {
      if (this.data.busy || this.data.sorting) return
      const parent = this.data.parentItems[Number(event.detail.value)]
      this._resetTransient()
      this.setData({ selectedParentId: parent ? parent.id : null, selectedParent: parent || null, parentIndex: Number(event.detail.value), loadedOnce: false })
      this.load(false)
    },
    changeMatchKind(event) { this.setData({ matchKindIndex: Number(event.detail.value) }) },
    toggleDisabled() { this.setData({ showDisabled: !this.data.showDisabled }) },

    // ---------- 编辑表单 ----------

    _syncDraft(patch = {}) {
      const excludeId = this.data.editing ? this.data.editing.id : 0
      const result = settings.validateName(this.data.draftName, this.data.items, excludeId)
      const unchanged = Boolean(this.data.editing) && result.name === settings.nameValue(this.data.editing.name)
      this.setData({
        ...patch,
        nameCount: result.count,
        nameError: result.error,
        nameUnchanged: unchanged,
        canSaveName: result.canSave && !unchanged
      })
    },

    openAdd() {
      if (!this.data.canManage || this.data.busy || this.data.sorting) return
      this.setData({ activeSheet: 'editor', editing: null, draftName: '', writeError: '', matchKindIndex: 10 })
      this._syncDraft()
    },

    openNameEditor(event) {
      if (!this.data.canManage || this.data.busy || this.data.sorting) return
      const item = this._findItem(event.currentTarget.dataset.id)
      if (!item) return
      this.setData({ activeSheet: 'editor', editing: item, draftName: item.name, writeError: '' })
      this._syncDraft()
    },

    _findItem(id) {
      return this.data.items.find((item) => Number(item.id) === Number(id)) || null
    },

    inputName(event) {
      this.setData({ draftName: event.detail.value })
      this._syncDraft()
    },

    onEditorFocus(event) {
      this.setData({ keyboardHeight: (event.detail && event.detail.height) || 0 })
    },

    onEditorKeyboardHeightChange(event) {
      const height = (event.detail && event.detail.height) || 0
      if (height !== this.data.keyboardHeight) this.setData({ keyboardHeight: height })
    },

    onEditorBlur() {
      if (this.data.activeSheet === 'editor') this.setData({ keyboardHeight: 0 })
    },

    closeEditor() {
      if (this.data.busy) return
      this._closeSheets()
      this.setData({ editing: null, draftName: '', nameCount: 0, nameError: '', nameUnchanged: false, canSaveName: false })
    },

    onMaskTap() {
      // 编辑表单不通过点击遮罩丢弃草稿；其余弹层遮罩等同取消。
      if (this.data.activeSheet === 'editor') return
      this._closeSheets()
    },

    saveName() {
      if (this.data.busy) return
      const editing = this.data.editing
      if (editing && this.data.nameUnchanged) { this.closeEditor(); return }
      if (!this.data.canSaveName) return
      const name = settings.nameValue(this.data.draftName)
      return this._write(editing ? 'rename' : 'add', () => {
        if (editing) return this._api.rename(editing.id, { name, revision: editing.revision })
        return this._api.add({ type, scope: this.data.scope, name })
      })
    },

    // ---------- 更多菜单 / 启停 / 删除 ----------

    openMenu(event) {
      if (!this.data.canManage || this.data.busy || this.data.sorting) return
      const item = this._findItem(event.currentTarget.dataset.id)
      if (!item) return
      this.setData({ activeSheet: 'menu', menuItem: item, writeError: '' })
    },

    closeMenu() { if (!this.data.busy) this._closeSheets() },

    cancelDelete() { if (!this.data.busy) this._closeSheets() },

    menuEditName() {
      const item = this.data.menuItem
      if (!item || this.data.busy) return
      this.setData({ activeSheet: 'editor', editing: item, draftName: item.name, writeError: '' })
      this._syncDraft()
    },

    menuToggleStatus() {
      const item = this.data.menuItem
      if (!item || this.data.busy) return
      return this._write('status', () => this._api.status(item.id, { enabled: !item.enabled, revision: item.revision }))
    },

    menuDelete() {
      const item = this.data.menuItem
      if (!item || this.data.busy) return
      this.setData({ activeSheet: 'delete', deleteItem: item })
    },

    confirmDelete() {
      const item = this.data.deleteItem
      if (!item || this.data.busy) return
      return this._write('delete', () => this._api.remove(item.id, item.revision))
    },

    // ---------- 写入流程：防重 / 失败保留 / 成功后刷新 ----------

    async _write(action, fn, options = {}) {
      if (!this.data.canManage || this.data.busy) return false
      const requestId = this._request
      const identity = identityKey()
      this.setData({ busy: true, busyAction: action, writeError: '', sortError: '' })
      try {
        await fn()
      } catch (error) {
        if (requestId === this._request && identity === identityKey()) {
          const message = (error && error.message) || '操作失败'
          const patch = options.errorField === 'sortError' ? { sortError: message } : { writeError: message }
          this.setData(patch)
          // 失败后刷新权威数据；不自动改用新 revision 重放同一写入。
          this._reload(requestId, identity)
        }
        return false
      } finally {
        if (requestId === this._request && identity === identityKey()) this.setData({ busy: false, busyAction: '' })
      }
      optionsStore.invalidate()
      if (requestId !== this._request || identity !== identityKey()) return true
      if (options.exitSort) { this._resetDragState(); this.setData({ sorting: false, sortItems: [], sortError: '' }) }
      if (options.keepSheet !== true) this._closeSheets()
      else if (options.clearWriteError) this.setData({ writeError: '' })
      await this._reload(requestId, identity)
      return true
    },

    // ---------- 排序 ----------

    startSort() {
      if (!this.data.canManage || this.data.busy || this.data.sorting) return
      const items = this.data.items.slice()
      if (!items.length) return
      this._sortBaseline = items.map((item) => item.id)
      this._sortVersion = this.data.scopeVersion
      this._resetDragState()
      this.setData({ sorting: true, sortItems: items, sortError: '', showDisabled: true, activeSheet: '' })
      this._measureSortRows()
    },

    cancelSort() {
      if (!this.data.sorting || this.data.busy) return
      // 只恢复进入排序时的原始顺序，不调用排序 API。
      this._resetDragState()
      this.setData({ sorting: false, sortItems: [], sortError: '' })
    },

    finishSort() {
      if (!this.data.sorting || this.data.busy) return
      const ids = this.data.sortItems.map((item) => item.id)
      if (!ids.length || new Set(ids).size !== ids.length) {
        this.setData({ sortError: '排序数据异常，请取消后重试' })
        return
      }
      const scopeVersion = this._sortVersion
      return this._write('order', () => this._api.order({ type, scope: this.data.scope, ids, scopeVersion }), {
        errorField: 'sortError',
        keepSheet: true,
        exitSort: true
      })
    },

    moveSort(event) {
      if (!this.data.sorting || this.data.busy || this._drag) return
      const index = this.data.sortItems.findIndex((item) => Number(item.id) === Number(event.currentTarget.dataset.id))
      const target = index + Number(event.currentTarget.dataset.direction)
      if (index < 0 || target < 0 || target >= this.data.sortItems.length) return
      this.setData({ sortItems: settings.reorder(this.data.sortItems, index, target) })
      this._measureSortRows()
    },

    // ---------- 排序拖动 ----------

    onHandleTouchStart(event) {
      if (!this.data.sorting || this.data.busy) return
      this._touch = {
        id: Number(event.currentTarget.dataset.id),
        startY: event.touches[0].clientY,
        startX: event.touches[0].clientX,
        moved: false
      }
    },

    onHandleTouchMove(event) {
      if (!this._touch || this._drag) return
      const dy = Math.abs(event.touches[0].clientY - this._touch.startY)
      const dx = Math.abs(event.touches[0].clientX - this._touch.startX)
      if (dy > 12 || dx > 12) this._touch.moved = true
    },

    onHandleTouchEnd() {
      // 拖动中松手必须结束拖动；未拖动则只清理触摸缓存。
      if (this._drag) this._resetDragState()
      else this._touch = null
    },

    onHandleLongPress() {
      if (!this.data.sorting || this.data.busy || !this._touch || this._touch.moved) return
      const index = this.data.sortItems.findIndex((item) => Number(item.id) === Number(this._touch.id))
      const rect = (this._sortRects || [])[index]
      if (index < 0 || !rect) return
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
      this._drag = { id: this._touch.id, index, offsetY: this._touch.startY - rect.top }
      this.setData({ dragItem: this.data.sortItems[index], dragTop: rect.top, dragIndex: index })
    },

    onDragMove(event) {
      if (!this._drag) return
      const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0])
      if (!touch) return
      this.setData({ dragTop: touch.clientY - this._drag.offsetY })
      const target = settings.dragTargetIndex(this._sortRects || [], this._drag.index, touch.clientY)
      if (target >= 0 && target !== this._drag.index) {
        const fromIndex = this._drag.index
        this._drag.index = target
        this.setData({ sortItems: settings.reorder(this.data.sortItems, fromIndex, target) })
        this._measureSortRows()
      }
      this._autoScroll(touch.clientY)
    },

    onDragEnd() { this._resetDragState() },

    _resetDragState() {
      if (this._scrollTimer) { clearInterval(this._scrollTimer); this._scrollTimer = null }
      this._drag = null
      this._touch = null
      this._measureSeq = (this._measureSeq || 0) + 1
      if (this.data && this.data.dragItem) this.setData({ dragItem: null, dragIndex: -1 })
    },

    _measureSortRows() {
      if (!this.data.sorting || this._disposed) return
      const seq = this._measureSeq = (this._measureSeq || 0) + 1
      setTimeout(() => {
        if (seq !== this._measureSeq || !this.data.sorting || this._disposed) return
        wx.createSelectorQuery().in(this).selectAll('.dm-sort-row').boundingClientRect((rects) => {
          if (seq !== this._measureSeq || !this.data.sorting) return
          this._sortRects = (rects || []).map((rect) => ({ top: rect.top, height: rect.height }))
        }).exec()
      }, 50)
    },

    _autoScroll(pointerY) {
      const edge = 80
      const windowHeight = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowHeight || 667
      let step = 0
      if (pointerY < edge) step = -24
      else if (pointerY > windowHeight - edge) step = 24
      if (!step) {
        if (this._scrollTimer) { clearInterval(this._scrollTimer); this._scrollTimer = null }
        return
      }
      if (this._scrollTimer) return
      this._scrollTimer = setInterval(() => {
        if (!this._drag || this._disposed) { this._resetDragState(); return }
        wx.createSelectorQuery().in(this).selectViewport().scrollOffset((res) => {
          if (!res || !this._drag) return
          wx.pageScrollTo({ scrollTop: Math.max(0, res.scrollTop + step), duration: 90 })
          this._measureSortRows()
        }).exec()
      }, 120)
    },

    // ---------- 家庭复制 ----------

    async openCopy() {
      if (personalOnly || !this.data.canManage || this.data.scope !== 'FAMILY' || this.data.busy || this.data.sorting) return
      const requestId = this._request
      const identity = identityKey()
      this.setData({ activeSheet: 'copy', copyLoading: true, copyError: '', copyItems: [], copySelectedIds: [], writeError: '' })
      try {
        const res = await this._api.list(type, 'PERSONAL', type === 'ITEM_STYLE')
        if (requestId !== this._request || identity !== identityKey() || this.data.scope !== 'FAMILY') {
          // 身份/家庭已变：关闭弹层并加载新范围，禁止套用旧选择。
          this._closeSheets()
          this.setData({ copyItems: [], copySelectedIds: [], copyLoading: false })
          this.load(false)
          return
        }
        this.setData({ copyLoading: false, copyItems: settings.deriveCopyItems((res.data || {}).items || [], type === 'ITEM_STYLE' ? [] : this.data.items) })
      } catch (error) {
        if (requestId !== this._request || identity !== identityKey()) return
        this.setData({ copyLoading: false, copyError: (error && error.message) || '加载失败' })
      }
    },

    toggleCopyItem(event) {
      if (this.data.busy) return
      const id = Number(event.currentTarget.dataset.id)
      const item = this.data.copyItems.find((entry) => Number(entry.id) === id)
      if (!item || item.exists || !item.enabled) return
      const selected = this.data.copySelectedIds.slice()
      const index = selected.indexOf(id)
      if (index >= 0) selected.splice(index, 1)
      else selected.push(id)
      // WXML 不执行数组方法，选中样式与提交 ID 在同一次更新中同步。
      const selectedIds = new Set(selected)
      const copyItems = this.data.copyItems.map((entry) => ({ ...entry, selected: selectedIds.has(Number(entry.id)) }))
      this.setData({ copyItems, copySelectedIds: selected, copyError: '' })
    },

    closeCopy() {
      if (this.data.busy) return
      this._closeSheets()
      this.setData({ copyItems: [], copySelectedIds: [], copyLoading: false, copyError: '' })
    },

    confirmCopy() {
      if (!this.data.copySelectedIds.length || this.data.busy) return
      const sourceIds = this.data.copySelectedIds.slice()
      return this._write('copy', async () => {
        const res = await this._api.copyPersonal({ sourceIds })
        const data = res.data || {}
        const count = (value) => (Array.isArray(value) ? value.length : Number(value || 0))
        wx.showToast({ title: `已添加${count(data.created)}项，跳过${count(data.skipped)}项`, icon: 'none' })
      })
    }
  }
}
