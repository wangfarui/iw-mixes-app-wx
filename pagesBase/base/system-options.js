const api = require('../../api/system-options')
const session = require('../../stores/session')
const { refreshDictCache } = require('../../api/login')
Page({
  data: { loading: false, busy: false, error: '', preview: null, allowed: false, committed: false, cachePending: false, confirmOpen: false, domain: '', type: null },
  onLoad(query) {
    this.setData({ domain: query.domain || '', type: query.type ? Number(query.type) : null })
    wx.setNavigationBarTitle({ title: query.domain === 'all' ? '修复业务选项' : '系统固定选项' })
  },
  onShow() { return this.reload() },
  onHide() { this._seq = (this._seq || 0) + 1; this.setData({ allowed: false, preview: null, confirmOpen: false, busy: false, loading: false }) },
  current(seq, token) { return seq === this._seq && token === session.getToken() },
  async reload() {
    if (this.data.busy) return
    const seq = this._seq = (this._seq || 0) + 1
    const token = session.getToken()
    this.setData({ loading: true, error: '', preview: null, allowed: false, confirmOpen: false })
    try {
      const cap = (await api.capabilities()).data
      if (!this.current(seq, token)) return
      const allowed = this.data.domain === 'all' ? cap.repairSystemOptions : cap.manageSystemOptions
      if (!allowed) { this.setData({ error: '当前账号没有系统选项维护权限' }); return }
      const preview = (await api.preview(this.data.domain, this.data.type)).data
      if (!this.current(seq, token)) return
      preview.differences = preview.differences.map(item => ({ ...item, key: `${item.type}:${item.code}` }))
      preview.issueLines = preview.issues.map((text, key) => ({ text, key }))
      this.setData({ preview, allowed: true, committed: false })
    } catch (error) {
      if (this.current(seq, token)) this.setData({ error: error.message || '加载失败，请重试' })
    } finally { if (this.current(seq, token)) this.setData({ loading: false }) }
  },
  openConfirm() {
    if (!this.data.allowed || this.data.busy || this.data.committed || this.data.cachePending || !this.data.preview || this.data.preview.issues.length || !(this.data.preview.addCount + this.data.preview.correctCount)) return
    this.setData({ confirmOpen: true })
  },
  closeConfirm() { if (!this.data.busy) this.setData({ confirmOpen: false }) },
  noop() {},
  async confirmSync() {
    if (!this.data.confirmOpen || !this.data.allowed || this.data.busy || this.data.committed) return
    const seq = this._seq, token = session.getToken()
    this.setData({ busy: true })
    let result
    try {
      result = (await api.sync(this.data.domain, this.data.type, this.data.preview.scopeVersion)).data
      if (!this.current(seq, token)) return
      this.setData({ committed: true, cachePending: !result.cacheRefreshed, confirmOpen: false })
      await refreshDictCache(true)
      wx.showToast({ title: result.cacheRefreshed ? '系统选项已同步' : '已保存，请重试缓存刷新', icon: 'none' })
    } catch (error) {
      if (!this.current(seq, token)) return
      this.setData({ error: error.message || '同步失败，预览已保留' })
      try {
        const cap = (await api.capabilities()).data
        if (this.current(seq, token) && !(this.data.domain === 'all' ? cap.repairSystemOptions : cap.manageSystemOptions)) this.setData({ allowed: false, preview: null, confirmOpen: false })
      } catch (_) { if (this.current(seq, token)) this.setData({ allowed: false, preview: null, confirmOpen: false }) }
    } finally { if (this.current(seq, token)) this.setData({ busy: false }) }
    if (result && this.current(seq, token) && result.cacheRefreshed) await this.reload()
  },
  async retryCache() {
    if (this.data.busy) return
    const seq = this._seq, token = session.getToken()
    this.setData({ busy: true })
    try {
      const result = await api.refresh(this.data.domain)
      if (!this.current(seq, token)) return
      this.setData({ cachePending: !result.data })
      if (result.data) await refreshDictCache(true)
    } catch (_) {} finally { if (this.current(seq, token)) this.setData({ busy: false }) }
    if (this.current(seq, token) && !this.data.cachePending) this.reload()
  }
})
