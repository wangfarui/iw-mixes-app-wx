const api = require('../api/system-options')
const session = require('../stores/session')
const definitions = {
  kitchen: [{ type: 3003, name: '菜品分类' }, { type: 3002, name: '用餐时间' }, { type: 3004, name: '菜品状态' }],
  bookkeeping: [{ type: 4003, name: '收支类型' }, { type: 4005, name: '订阅计费周期' }, { type: 4006, name: '订阅周期单位' }]
}
module.exports = (domain) => ({
  async onShow() {
    const seq = this._permissionSeq = (this._permissionSeq || 0) + 1
    const token = session.getToken()
    this.setData({ systemItems: [], permissionError: false })
    try {
      const res = await api.capabilities()
      if (seq === this._permissionSeq && token === session.getToken()) this.setData({ systemItems: res.data.manageSystemOptions ? definitions[domain] : [] })
    } catch (error) {
      if (seq === this._permissionSeq && token === session.getToken()) this.setData({ permissionError: true })
    }
  },
  onHide() { this._permissionSeq = (this._permissionSeq || 0) + 1; this.setData({ systemItems: [] }) },
  retryPermission() { this.onShow() },
  openSystem(event) {
    if (!this.data.systemItems.length) return
    wx.navigateTo({ url: `/pagesBase/base/system-options?domain=${domain}&type=${event.currentTarget.dataset.type}` })
  }
})
