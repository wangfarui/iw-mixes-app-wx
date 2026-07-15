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

  onLaunch() {
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
