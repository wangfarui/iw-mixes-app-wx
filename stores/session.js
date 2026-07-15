const TOKEN_KEY = 'iwtoken'
const USER_INFO_KEY = 'userInfo'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY)
}

function getUserInfo() {
  return wx.getStorageSync(USER_INFO_KEY)
}

function setLoginSession(userInfo) {
  const token = userInfo && userInfo.tokenValue
  if (token) {
    wx.setStorageSync(TOKEN_KEY, token)
  }
  wx.setStorageSync(USER_INFO_KEY, userInfo || null)
}

function clearLoginSession() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_INFO_KEY)
}

function tokenHeader() {
  const token = getToken()
  return token ? { [TOKEN_KEY]: token } : {}
}

module.exports = {
  TOKEN_KEY,
  USER_INFO_KEY,
  getToken,
  getUserInfo,
  setLoginSession,
  clearLoginSession,
  tokenHeader
}
