const { refreshDictCache } = require('../../api/login')
const baseApi = require('../../api/base')
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
    const cached = wx.getStorageSync('userInfo')
    if (cached) {
      this.setData({ isSuperAdmin: this.isSuperAdminUser(cached) })
    }
    try {
      const res = await baseApi.getUserInfo()
      const userInfo = res.data || {}
      wx.setStorageSync('userInfo', userInfo)
      this.setData({ isSuperAdmin: this.isSuperAdminUser(userInfo) })
    } catch (error) {
      this.setData({ isSuperAdmin: this.isSuperAdminUser(cached) })
    }
  },

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
    if (!this.data.isSuperAdmin || this.data.dictSyncing) return
    wx.showModal({
      title: '同步字典',
      content: '确认补齐所有用户的可见字典数据？',
      confirmText: '同步',
      success: async (res) => {
        if (!res.confirm) return
        await this.confirmSyncDict()
      }
    })
  },

  async confirmSyncDict() {
    if (!this.data.isSuperAdmin || this.data.dictSyncing) return
    this.setData({ dictSyncing: true })
    wx.showLoading({ title: '同步中...' })
    let success = false
    try {
      await baseApi.repairUserVisibleDictData()
      await refreshDictCache(true)
      success = true
    } catch (error) {
      // 请求封装会提示具体错误，这里只负责恢复页面状态。
    } finally {
      wx.hideLoading()
      this.setData({ dictSyncing: false })
    }
    if (success) {
      wx.showToast({ title: '同步完成', icon: 'success' })
    }
  },

  checkUpdate() {
    wx.showToast({ title: '已是最新版本', icon: 'none' })
  },

  navigateTo(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url })
  }
})
