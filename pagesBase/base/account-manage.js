const api = require('../../api/base')
const categories = require('../../api/account-categories')
const session = require('../../stores/session')
Page({
  data: {
    accountList: [], categories: [], keyword: '', selectedType: '', address: '', filterAddress: '',
    total: 0, currentPage: 0, pageSize: 10, hasMore: true, loading: false, loaded: false,
    error: '', categoryError: '', sheet: '', passwordToShow: '', passwordTitle: '', passwordLoading: false, passwordError: ''
  },
  onLoad(options = {}) { if (options.type) this.setData({ selectedType: String(options.type) }) },
  onShow() {
    const token = session.getToken()
    if (this._token && this._token !== token) this.setData({ accountList: [], categories: [], loaded: false, currentPage: 0, total: 0, keyword: '', selectedType: '', address: '' })
    this._visible = true; this._token = token; this.refresh()
  },
  onHide() { this._visible = false; this.closePassword(); this.setData({ sheet: '' }) },
  onUnload() { this._visible = false; this._request = (this._request || 0) + 1; this.closePassword(); clearTimeout(this._searchTimer) },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()) },
  onReachBottom() { if (!this.data.loading && this.data.hasMore && !this.data.error) this.fetchPage(false) },
  async refresh() {
    await Promise.all([this.loadCategories(), this.fetchPage(true)])
  },
  async loadCategories() {
    const token = this._token
    try {
      const data = await categories.list()
      if (token !== session.getToken()) return
      this.setData({ categories: data.items.filter(i => i.enabled || i.accountCount > 0), unclassifiedCount: data.unclassifiedCount, categoryError: '' })
    } catch (e) { if (token === session.getToken()) this.setData({ categoryError: '分类加载失败，点击重试' }) }
  },
  async fetchPage(reset) {
    const id = reset ? (this._request = (this._request || 0) + 1) : this._request
    const token = this._token
    const currentPage = reset ? 1 : this.data.currentPage + 1
    this._failedReset = reset
    this.setData({ loading: true, error: '' })
    try {
      const query = { currentPage, pageSize: this.data.pageSize }
      if (this.data.keyword.trim()) query.keyword = this.data.keyword.trim()
      if (this.data.address.trim()) query.address = this.data.address.trim()
      if (this.data.selectedType === 'none') query.unclassified = true
      else if (this.data.selectedType !== '') query.type = Number(this.data.selectedType)
      const res = await api.getAccountPage(query)
      if (id !== this._request || token !== session.getToken()) return
      const data = res.data || {}
      const rows = (data.records || []).map(i => ({ ...i, title: i.name || i.address || i.account || '未命名账号', initial: Array.from(i.name || i.address || i.account || '?')[0], typeName: i.typeName || '未分类' }))
      const accountList = reset ? rows : this.data.accountList.concat(rows)
      this.setData({ accountList, total: Number(data.total || 0), currentPage, loaded: true, hasMore: accountList.length < Number(data.total || 0) })
    } catch (e) {
      if (id === this._request && token === session.getToken()) this.setData({ error: '账号加载失败，点击重试' })
    } finally { if (id === this._request && token === session.getToken()) this.setData({ loading: false }) }
  },
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value }); clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this.applyFilter(), 350)
  },
  applyFilter() { clearTimeout(this._searchTimer); return this.fetchPage(true) },
  chooseType(e) { this.setData({ selectedType: String(e.currentTarget.dataset.code) }); this.applyFilter() },
  retry() { return this.fetchPage(this._failedReset) },
  openFilter() { this.setData({ sheet: 'filter', filterAddress: this.data.address }) },
  inputAddress(e) { this.setData({ filterAddress: e.detail.value }) },
  confirmFilter() { this.setData({ sheet: '', address: this.data.filterAddress }); this.applyFilter() },
  resetFilter() { this.setData({ sheet: '', address: '', keyword: '', selectedType: '' }); this.applyFilter() },
  closeSheet() { this.setData({ sheet: '' }) },
  goCategories() { wx.navigateTo({ url: '/pagesBase/base/account-category-settings' }) },
  goAdd() { wx.navigateTo({ url: '/pagesBase/base/account-detail' }) },
  goDetail(e) { wx.navigateTo({ url: `/pagesBase/base/account-detail?id=${e.currentTarget.dataset.id}` }) },
  copyAccount(e) {
    const account = this.data.accountList.find(i => i.id === Number(e.currentTarget.dataset.id))
    if (!account || !account.account) return wx.showToast({ title: '该账号未填写账号信息', icon: 'none' })
    wx.setClipboardData({ data: account.account })
  },
  async viewPassword(e) {
    const id = Number(e.currentTarget.dataset.id), item = this.data.accountList.find(i => i.id === id)
    const request = this._passwordRequest = (this._passwordRequest || 0) + 1
    const token = session.getToken()
    this.setData({ sheet: 'password', passwordTitle: item ? item.title : '账号密码', passwordLoading: true, passwordToShow: '', passwordError: '' })
    try {
      const res = await api.viewAccountPassword(id)
      if (!this._visible || request !== this._passwordRequest || token !== session.getToken()) return
      this.setData({ passwordToShow: res.data || '', passwordLoading: false })
    } catch (e) {
      if (request === this._passwordRequest && token === session.getToken()) this.setData({ passwordLoading: false, passwordError: '密码读取失败，请关闭后重试' })
    }
  },
  copyPassword() { if (!this.data.passwordLoading && !this.data.passwordError && this.data.passwordToShow) wx.setClipboardData({ data: this.data.passwordToShow }) },
  closePassword() { this._passwordRequest = (this._passwordRequest || 0) + 1; this.setData({ sheet: '', passwordToShow: '', passwordLoading: false, passwordError: '', passwordTitle: '' }) },
  noop() {}
})
