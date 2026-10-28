const api = require('../api/system-options')
const session = require('../stores/session')
const links = [
  { name: '厨房设置', path: '/pagesEat/eat/kitchen-settings', types: [3002, 3003, 3004, 3010, 3011] },
  { name: '记账设置', path: '/pagesBookkeeping/bookkeeping/bookkeeping-settings', types: [4001, 4002, 4003, 4004, 4005, 4006, 4011] },
  { name: '衣柜设置', path: '/pagesWardrobe/wardrobe/wardrobe-settings', types: [5002, 5003, 5004, 5005, 5006] },
  { name: '账号管理', path: '/pagesBase/base/account-manage', types: [2010] }
]
module.exports = {
  data: { links, destination: '' },
  async onLoad(query) {
    wx.setNavigationBarTitle({ title: '设置入口已迁移' })
    const token = session.getToken()
    let type = Number(query.dictType || query.type)
    if (query.id) try { type = (await api.legacyType(query.id)).data } catch (_) {}
    if (token !== session.getToken()) return
    const link = links.find(item => item.types.includes(type))
    if (link) this.setData({ destination: link.name })
  },
  open(event) { wx.navigateTo({ url: event.currentTarget.dataset.path }) }
}
