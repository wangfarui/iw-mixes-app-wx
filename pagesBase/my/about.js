const aboutConfig = {
  logo: '/static/logo.png',
  desc: '为个人、家庭提供生活服务帮助的小帮手。',
  owner: 'Wray',
  features: [
    '多场景生活管理，帮助建立清晰习惯',
    '轻量记录与提醒，让日常更高效',
    '数据汇总与趋势洞察，辅助规划'
  ],
  contacts: [
    { label: '联系邮箱', value: 'wray20156294@gmail.com' }
  ],
  links: []
}

Page({
  data: {
    appName: '瑞菁小帮手',
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
        appName: info.appName || this.data.appName,
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
