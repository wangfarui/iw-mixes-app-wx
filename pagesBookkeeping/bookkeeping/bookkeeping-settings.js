const systemOptionsHome = require('../../utils/system-options-home')

Page({
  ...systemOptionsHome('bookkeeping'),
  data: {
    systemItems: [], permissionError: false,
    items: [
      { name: '记账分类', desc: '整理每笔账单的用途分类', icon: '/static/bookkeeping/settings/category.svg', path: 'bookkeeping-category-settings' },
      { name: '支出标签', desc: '标记外卖、聚餐等支出场景', icon: '/static/bookkeeping/settings/expense-tag.svg', path: 'bookkeeping-consume-tag-settings' },
      { name: '收入标签', desc: '标记工资、返现等收入来源', icon: '/static/bookkeeping/settings/income-tag.svg', path: 'bookkeeping-income-tag-settings' },
      { name: '会员类型', desc: '管理我的会员订阅类型', icon: '/static/bookkeeping/settings/membership-type.svg', path: 'bookkeeping-membership-type-settings' }
    ]
  },
  open(event) {
    wx.navigateTo({ url: `/pagesBookkeeping/bookkeeping/${event.currentTarget.dataset.path}` })
  }
})
