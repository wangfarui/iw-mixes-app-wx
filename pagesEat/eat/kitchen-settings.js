const systemOptionsHome = require('../../utils/system-options-home')

Page({
  ...systemOptionsHome('kitchen'),
  data: {
    systemItems: [], permissionError: false,
    items: [
      { name: '食材分类', desc: '管理冰箱食材的分类选项', path: 'fridge-category' },
      { name: '食材分区', desc: '管理冰箱、冷冻区等存放位置', path: 'fridge-section' }
    ]
  },
  open(event) {
    wx.navigateTo({ url: `/pagesEat/eat/${event.currentTarget.dataset.path}-settings` })
  }
})
