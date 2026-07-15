const http = require('./request')
const dictStore = require('../stores/dict')

function loginByPasswordApi(loginForm) {
  return http.post('/auth-service/login/password', loginForm)
}

function loginByVerificationCodeApi(loginForm) {
  return http.post('/auth-service/login/verificationCode', loginForm)
}

function registerByVerificationCodeInviteApi(loginForm) {
  return http.post('/auth-service/login/verificationCode/invite', loginForm)
}

function registerAndLoginApi(loginForm) {
  return http.post('/auth-service/register/form', loginForm)
}

function getPhoneVerificationCodeApi(phoneNumber) {
  return http.get('/auth-service/register/getPhoneVerificationCode', { phoneNumber })
}

function getEmailVerificationCodeApi(emailAddress) {
  return http.get('/auth-service/register/getEmailVerificationCode', { emailAddress })
}

function getVerificationCodeByActionApi(action) {
  return http.get('/auth-service/user/getVerificationCode', { action })
}

function editPasswordApi(passwordEditDto) {
  return http.post('/auth-service/user/editPassword', passwordEditDto)
}

function getDictTypeList() {
  return http.get('/auth-service/dict/getDictTypeList')
}

function getAllDictList(latest) {
  return http.get('/auth-service/dict/getAllDictList', { latest: latest ? 'true' : 'false' })
}

function getDictVersionApi() {
  return http.get('/auth-service/dict/version')
}

function refreshDictCache(latest) {
  return Promise.all([
    getDictTypeList().then((res) => {
      dictStore.setDictTypeArray(res.data)
      return res.data
    }),
    getAllDictList(latest).then((res) => {
      dictStore.setDictDataArrayMap(res.data)
      return res.data
    })
  ]).catch(() => {})
}

let versionPollingTimer = null
let currentDictVersion = null

function stopVersionPolling() {
  if (versionPollingTimer) {
    clearInterval(versionPollingTimer)
    versionPollingTimer = null
  }
  currentDictVersion = null
}

async function checkDictVersion() {
  try {
    const res = await getDictVersionApi()
    const newVersion = res.data

    if (currentDictVersion === null) {
      currentDictVersion = newVersion
      return
    }

    if (currentDictVersion !== newVersion) {
      currentDictVersion = newVersion
      refreshDictCache(true)
    }
  } catch (error) {
    // 字典版本轮询不打断用户主流程。
  }
}

function startVersionPolling() {
  stopVersionPolling()
  checkDictVersion()
  versionPollingTimer = setInterval(checkDictVersion, 30 * 60 * 1000)
}

function logout() {
  return http.get('/auth-service/login/logout')
}

module.exports = {
  loginByPasswordApi,
  loginByVerificationCodeApi,
  registerByVerificationCodeInviteApi,
  registerAndLoginApi,
  getPhoneVerificationCodeApi,
  getEmailVerificationCodeApi,
  getVerificationCodeByActionApi,
  editPasswordApi,
  getDictTypeList,
  getAllDictList,
  refreshDictCache,
  getDictVersionApi,
  startVersionPolling,
  stopVersionPolling,
  logout
}
