const apiFactory = require('../../api/kitchen-dictionaries')
const optionsStore = require('../../stores/kitchen-options')
const familyStore = require('../../stores/family')
const settings = require('../../utils/bookkeeping-settings')

const TYPE_TEXT = { CATEGORY: '食材分类', SECTION: '食材分区' }
const PLACEHOLDER = { CATEGORY: '如：蔬菜', SECTION: '如：冷藏区' }

module.exports = function createDictionaryManagement(type) {
  const personalOnly = false
  const identityKey = optionsStore.identity
  return {
    data: {
      type,
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
        this._resetTransient()
        this.setData({ scope: 'PERSONAL', items: [], enabledItems: [], disabledItems: [], disabledCount: 0, showDisabled: false, loadedOnce: false })
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
        sorting: false, sortItems: [], sortError: '',
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

    toggleDisabled() { this.setData({ showDisabled: !this.data.showDisabled }) },

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
      const requestId = this._request
      const identity = identityKey()
      return this._reload(requestId, identity)
    },

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
      this.setData({ scope, items: [], enabledItems: [], disabledItems: [], disabledCount: 0, loadedOnce: false, loading: true })
      this.load(false)
    },

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
      this.setData({ activeSheet: 'editor', editing: null, draftName: '', writeError: '' })
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

    async openCopy() {
      if (personalOnly || !this.data.canManage || this.data.scope !== 'FAMILY' || this.data.busy || this.data.sorting) return
      const requestId = this._request
      const identity = identityKey()
      this.setData({ activeSheet: 'copy', copyLoading: true, copyError: '', copyItems: [], copySelectedIds: [], writeError: '' })
      try {
        const res = await this._api.list(type, 'PERSONAL')
        if (requestId !== this._request || identity !== identityKey() || this.data.scope !== 'FAMILY') {
          this._closeSheets()
          this.setData({ copyItems: [], copySelectedIds: [], copyLoading: false })
          this.load(false)
          return
        }
        this.setData({ copyLoading: false, copyItems: settings.deriveCopyItems((res.data || {}).items || [], this.data.items) })
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
