const { refreshDictCache, startVersionPolling } = require('./api/login')
const familyStore = require('./stores/family')
const sessionStore = require('./stores/session')
const env = require('./config/env')
const { redirectToLogin } = require('./utils/auth')

App({
  globalData: {
    env: env.getRuntimeEnv(),
    baseUrl: env.getBaseUrl(),
    userInfo: null
  },

  setupUpdateManager() {
    if (!wx.getUpdateManager) return
    const manager = wx.getUpdateManager()
    manager.onUpdateReady(() => {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      if (current && (current.data.formData || current.data.activeSheet || current.data.sorting || current.data.bulkText)) {
        wx.showToast({ title: '新版已准备好，保存内容后重新进入即可更新', icon: 'none', duration: 3000 })
        return
      }
      wx.showModal({ title: '新版已准备好', content: '是否重启小程序使用新版本？', confirmText: '重启', cancelText: '稍后',
        success: result => { if (result.confirm) manager.applyUpdate() } })
    })
    manager.onUpdateFailed(() => { /* Continue the running version; server validates wardrobe requests. */ })
  },
  onLaunch() {
    this.setupUpdateManager()
    this.globalData.env = env.getRuntimeEnv()
    this.globalData.baseUrl = env.getBaseUrl()
    this.globalData.userInfo = sessionStore.getUserInfo()

    const token = sessionStore.getToken()
    const userInfo = sessionStore.getUserInfo()

    if (token && userInfo) {
      startVersionPolling()
      familyStore.fetchMyGroup()
      refreshDictCache(true)
    } else {
      familyStore.clearGroup()
      redirectToLogin()
    }
  }
})
