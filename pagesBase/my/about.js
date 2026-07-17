const aboutConfig = {
  logo: '/static/logo.png',
  desc: '面向个人与家庭的日常生活管理助手，集中打理财务、餐食、穿搭与任务。',
  owner: 'Wray',
  features: [
    '钱、饭、衣、事集中管理，让日常信息更清楚',
    '支持个人记录与家庭共享，协作安排更省心',
    '通过统计、提醒与智能建议，帮助生活更有序'
  ],
  contacts: [
    { label: '联系邮箱', value: 'wray20156294@gmail.com' }
  ],
  links: []
}

Page({
  data: {
    appName: '瑞菁日常',
    appVersion: '1.0.0',
    aboutConfig,
    contactList: aboutConfig.contacts.filter((item) => item.value),
    linkList: aboutConfig.links.filter((item) => item.url),
    currentYear: new Date().getFullYear()
  },

  onLoad() {
    if (typeof wx.getAppBaseInfo === 'function') {
      const info = wx.getAppBaseInfo()
      this.setData({
        appVersion: info.appVersion || this.data.appVersion
      })
    }
  },

  openLink(event) {
    const url = event.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'none' })
      }
    })
  }
})
