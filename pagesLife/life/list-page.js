const { api, session, configs, formatRow } = require('./common')
function emptyMessage(kind, selected, keyword) {
  if ((keyword || '').trim()) return '没有匹配的记录'
  if (kind === 'date' && selected === 'UPCOMING') return '未来30天没有重要日期，可在「全部」查看'
  if (kind === 'wish' && selected === 'FULFILLED') return '还没有已实现的心愿'
  if (kind === 'wish' && selected === 'ARCHIVED') return '还没有搁置的心愿'
  if (kind === 'bookmark' && selected) return '该类型下还没有收藏'
  return '这里还没有记录，添加一个吧'
}
module.exports = function listPage(kind) {
  const config = configs[kind]
  return {
    data: { kind, ...config, emptyText: emptyMessage(kind, config.filter, ''), keyword: '', selected: config.filter, items: [], total: 0, pendingCount: 0, loaded: false, loading: false, busy: false, error: '', currentPage: 0, hasMore: true },
    onLoad() { this._alive = true },
    onShow() {
      const token = session.getToken()
      if (this._token !== token) this.setData({ keyword: '', selected: config.filter, items: [], loaded: false, total: 0 })
      this._token = token; this._visible = true; this.setData({ busy: false }); this.load(true)
    },
    onHide() { this._visible = false; this._seq = (this._seq || 0) + 1; clearTimeout(this._searchTimer) },
    onUnload() { this._alive = false; this._visible = false; this._seq = (this._seq || 0) + 1; clearTimeout(this._searchTimer) },
    valid() { return this._alive && this._visible && this._token === session.getToken() },
    onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()) },
    onReachBottom() { if (!this.data.loading && !this.data.error && this.data.hasMore) this.load(false) },
    async load(reset = true) {
      const seq = this._seq = (this._seq || 0) + 1, token = this._token
      const currentPage = reset ? 1 : this.data.currentPage + 1
      this._failedReset = reset; this.setData({ loading: true, error: '', emptyText: emptyMessage(kind, this.data.selected, this.data.keyword) })
      try {
        const query = { currentPage, pageSize: 20, keyword: this.data.keyword.trim() }
        query[kind === 'wish' ? 'status' : kind === 'date' ? 'view' : 'category'] = this.data.selected
        const res = await api.page(kind, query)
        if (!this.valid() || seq !== this._seq || token !== session.getToken()) return
        const data = res.data || {}, rows = (data.records || []).map(r => formatRow(kind, r))
        const items = reset ? rows : this.data.items.concat(rows)
        this.setData({ items, loaded: true, total: data.total || 0, pendingCount: data.pendingCount || 0, currentPage, hasMore: items.length < data.total })
      } catch (e) { if (this.valid() && seq === this._seq) this.setData({ error: '加载失败，点击重试' }) }
      finally { if (this.valid() && seq === this._seq) this.setData({ loading: false }) }
    },
    search(e) { this.setData({ keyword: e.detail.value }); this._seq = (this._seq || 0) + 1; clearTimeout(this._searchTimer); this._searchTimer = setTimeout(() => this.load(true), 350) },
    confirmSearch() { clearTimeout(this._searchTimer); this.load(true) },
    choose(e) { if (this.data.busy) return; clearTimeout(this._searchTimer); this.setData({ selected: e.currentTarget.dataset.value }); this.load(true) },
    retry() { this.load(this._failedReset) },
    add() { if (!this.data.busy) wx.navigateTo({ url: '/pagesLife/life/' + kind + '-editor' }) },
    edit(e) { if (!this.data.busy) wx.navigateTo({ url: '/pagesLife/life/' + kind + '-editor?id=' + e.currentTarget.dataset.id }) },
    async action(e) {
      if (this.data.busy || this.data.loading || !this.valid()) return
      const item = this.data.items.find(r => r.id === Number(e.currentTarget.dataset.id)); if (!item) return
      this.setData({ busy: true })
      try {
        if (kind === 'wish') await api.changeStatus({ id: item.id, revision: item.revision, action: e.currentTarget.dataset.action })
        else await api.setPinned({ id: item.id, revision: item.revision, pinned: !item.pinned })
        if (!this.valid()) return
        await this.load(true)
        if (this.data.error) wx.showToast({ title: '已更新，列表刷新失败', icon: 'none' })
      } catch (e) { /* Keep rows for inspection; wrapper displays the business error. */ }
      finally { if (this.valid()) this.setData({ busy: false }) }
    }
  }
}
