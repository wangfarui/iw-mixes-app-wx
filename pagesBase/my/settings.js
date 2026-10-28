const loginHistoryStore = require('../../stores/login-history')
const eatCartStore = require('../../stores/eat-cart')

const SETTINGS_KEY = 'systemSettings'
const SUPER_ADMIN_ROLE = 20
const DEFAULT_SETTINGS = {
  notify: true,
  autoUpdate: true,
  wifiOnly: false
}

Page({
  data: {
    settings: DEFAULT_SETTINGS,
    isSuperAdmin: false,
    dictSyncing: false
  },

  onLoad() {
    const cached = wx.getStorageSync(SETTINGS_KEY)
    this.setData({
      settings: cached ? { ...DEFAULT_SETTINGS, ...cached } : DEFAULT_SETTINGS
    })
  },

  onShow() {
    this.loadUserRole()
  },

  isSuperAdminUser(userInfo) {
    return Number(userInfo && userInfo.roleType) === SUPER_ADMIN_ROLE
  },

  async loadUserRole() {
    const token = require('../../stores/session').getToken()
    const seq = this._roleSeq = (this._roleSeq || 0) + 1
    this.setData({ isSuperAdmin: false })
    try {
      const result = await require('../../api/system-options').capabilities()
      if (seq === this._roleSeq && token === require('../../stores/session').getToken()) this.setData({ isSuperAdmin: result.data.repairSystemOptions })
    } catch (_) {}
  },
  onHide() { this._roleSeq = (this._roleSeq || 0) + 1; this.setData({ isSuperAdmin: false }) },

  saveSettings(settings) {
    wx.setStorageSync(SETTINGS_KEY, settings)
    this.setData({ settings })
  },

  toggleSetting(event) {
    const key = event.currentTarget.dataset.key
    this.saveSettings({
      ...this.data.settings,
      [key]: event.detail.value
    })
  },

  clearCache() {
    try {
      loginHistoryStore.clearHistory()
      eatCartStore.clearCartItems()
      wx.showToast({ title: '缓存已清除', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '清除失败', icon: 'error' })
    }
  },

  syncDict() {
    if (this.data.isSuperAdmin) wx.navigateTo({ url: '/pagesBase/base/system-options?domain=all' })
  },

  checkUpdate() {
    wx.showToast({ title: '已是最新版本', icon: 'none' })
  },

  navigateTo(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url })
  }
})
