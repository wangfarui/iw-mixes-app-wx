const api = require('../../api/account-categories')
const session = require('../../stores/session')
const reorder = (list, from, to) => { const rows = list.slice(); rows.splice(to, 0, rows.splice(from, 1)[0]); return rows }
Page({
  data: { items: [], enabledItems: [], disabledItems: [], scopeVersion: '', loading: false, loaded: false,
    error: '', refreshFailed: false, busy: false, showDisabled: false, sorting: false, sortItems: [],
    sheet: '', editing: null, draftName: '', nameCount: 0, nameError: '', keyboardHeight: 0, draggingId: 0 },
  onShow() {
    const token = session.getToken()
    if (this._token && this._token !== token) this.setData({ items: [], sheet: '', sorting: false, loaded: false, busy: false, scopeVersion: '' })
    this._token = token
    if (!this.data.sheet && !this.data.sorting) this.load()
  },
  onHide() { this.endDrag() },
  onUnload() { this._request = (this._request || 0) + 1; this.endDrag() },
  async load(afterWrite = false) {
    const id = this._request = (this._request || 0) + 1, token = this._token
    this.setData({ loading: true, error: '' })
    try {
      const data = await api.list()
      if (id !== this._request || token !== session.getToken()) return false
      this.setData({ items: data.items, enabledItems: data.items.filter(i => i.enabled), disabledItems: data.items.filter(i => !i.enabled), scopeVersion: data.scopeVersion, loaded: true, refreshFailed: false })
      return true
    } catch (e) {
      if (id === this._request && token === session.getToken()) this.setData({ error: afterWrite ? '已保存，列表刷新失败' : '分类加载失败，请重试', refreshFailed: afterWrite })
      return false
    } finally { if (id === this._request && token === session.getToken()) this.setData({ loading: false }) }
  },
  retry() { return this.load(this.data.refreshFailed) },
  toggleDisabled() { this.setData({ showDisabled: !this.data.showDisabled }) },
  openAdd() { if (this.data.busy || !this.data.loaded || this.data.refreshFailed) return; this.openEditor(null) },
  openName(e) { if (this.data.busy || this.data.refreshFailed) return; this.openEditor(this.data.items.find(i => i.id === Number(e.currentTarget.dataset.id))) },
  openEditor(item) { this._editVersion = this.data.scopeVersion; this.setData({ sheet: 'editor', editing: item, draftName: item ? item.name : '', nameCount: Array.from(item ? item.name : '').length, nameError: '' }) },
  inputName(e) { this.setData({ draftName: e.detail.value, nameCount: Array.from(e.detail.value.trim()).length, nameError: '' }) },
  keyboardChange(e) { this.setData({ keyboardHeight: e.detail.height || 0 }) },
  closeSheet() { if (this.data.busy) return; wx.hideKeyboard(); this.setData({ sheet: '', keyboardHeight: 0, editing: null, nameError: '' }) },
  async saveName() {
    if (this.data.busy) return
    const name = this.data.draftName.trim(), row = this.data.editing
    if (!name || Array.from(name).length > 32) { this.setData({ nameError: '请输入1–32个字符的分类名称' }); return }
    if (this.data.items.some(i => (!row || i.id !== row.id) && i.name.toLowerCase() === name.toLowerCase())) { this.setData({ nameError: '分类名称已存在（包含停用分类）' }); return }
    await this.mutate(() => row ? api.rename(row.id, { name, revision: row.revision, scopeVersion: this._editVersion }) : api.create({ name, scopeVersion: this._editVersion }))
  },
  openMenu(e) {
    if (this.data.busy || this.data.refreshFailed) return
    const row = this.data.items.find(i => i.id === Number(e.currentTarget.dataset.id))
    if (row) this.setData({ editing: row, sheet: 'menu' })
  },
  menuRename() { this.openEditor(this.data.editing) },
  menuStatus() { const row = this.data.editing; this.mutate(() => api.status(row.id, { enabled: !row.enabled, revision: row.revision, scopeVersion: this.data.scopeVersion })) },
  menuDelete() { this.setData({ sheet: this.data.editing.accountCount > 0 ? 'referenced' : 'delete' }) },
  viewAccounts() {
    const code = this.data.editing.code
    const pages = getCurrentPages(), previous = pages[pages.length - 2]
    if (previous && previous.route === 'pagesBase/base/account-manage') { previous.setData({ selectedType: String(code) }); wx.navigateBack() }
    else wx.redirectTo({ url: `/pagesBase/base/account-manage?type=${code}` })
  },
  confirmDelete() { const row = this.data.editing; this.mutate(() => api.remove(row.id, { revision: row.revision, scopeVersion: this.data.scopeVersion })) },
  async mutate(write) {
    if (this.data.busy || this._token !== session.getToken()) return
    const token = this._token
    this.setData({ busy: true, nameError: '' })
    try {
      await write()
      if (token !== session.getToken()) return
      wx.hideKeyboard(); this.endDrag()
      this.setData({ sheet: '', keyboardHeight: 0, editing: null, sorting: false, sortItems: [] })
      await this.load(true)
    } catch (e) {
      if (token === session.getToken()) this.setData({ nameError: e.message || '保存失败，请重试' })
      // Refresh the authority token without resubmitting. Keep the current editor draft for user review.
      if (token === session.getToken() && /已变化/.test(e.message || '')) { await this.load(); this._editVersion = this.data.scopeVersion }
    } finally { if (token === session.getToken()) this.setData({ busy: false }) }
  },
  startSort() {
    if (this.data.busy || this.data.refreshFailed || this.data.loading) return
    this._sortVersion = this.data.scopeVersion
    this.setData({ sorting: true, sortItems: this.data.items.map(i => ({ ...i })), nameError: '' })
  },
  cancelSort() { if (this.data.busy) return; this.endDrag(); this.setData({ sorting: false, sortItems: [], nameError: '' }) },
  finishSort() { this.mutate(() => api.order({ ids: this.data.sortItems.map(i => i.id), scopeVersion: this._sortVersion })) },
  move(e) {
    if (this.data.busy) return
    const index = Number(e.currentTarget.dataset.index), target = index + Number(e.currentTarget.dataset.direction)
    if (target < 0 || target >= this.data.sortItems.length) return
    this.setData({ sortItems: reorder(this.data.sortItems, index, target) })
  },
  touchStart(e) { this._touchId = Number(e.currentTarget.dataset.id) },
  startDrag() {
    if (this.data.busy || !this._touchId) return
    wx.createSelectorQuery().in(this).selectAll('.sort-row').boundingClientRect(rects => {
      if (!this._touchId) return
      this._rects = rects; this.setData({ draggingId: this._touchId }); wx.vibrateShort({ type: 'light' })
    }).exec()
  },
  dragMove(e) {
    if (!this.data.draggingId || !e.touches.length) return
    const y = e.touches[0].clientY, from = this.data.sortItems.findIndex(i => i.id === this.data.draggingId)
    const target = (this._rects || []).findIndex(r => y >= r.top && y <= r.bottom)
    if (target >= 0 && target !== from) this.setData({ sortItems: reorder(this.data.sortItems, from, target) })
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    if (y < 100 || y > info.windowHeight - 80) {
      if (!this._scrollTimer) this._scrollTimer = setInterval(() => {
        wx.pageScrollTo({ scrollTop: Math.max(0, (this._scrollTop || 0) + (y < 100 ? -50 : 50)), duration: 0 })
        wx.createSelectorQuery().in(this).selectAll('.sort-row').boundingClientRect(r => { this._rects = r }).exec()
      }, 180)
    } else { clearInterval(this._scrollTimer); this._scrollTimer = null }
  },
  onPageScroll(e) { this._scrollTop = e.scrollTop },
  endDrag() { this._touchId = null; clearInterval(this._scrollTimer); this._scrollTimer = null; this.setData({ draggingId: 0 }) },
  noop() {}
})
