const PASSWORD_HISTORY_KEY = 'loginPasswordHistory'
const PHONE_HISTORY_KEY = 'loginPhoneHistory'
const EMAIL_HISTORY_KEY = 'loginEmailHistory'
const LEGACY_USERNAME_KEY = 'savedUsername'
const LEGACY_PASSWORD_KEY = 'savedPassword'

const LOGIN_WAY = {
  PHONE: '1',
  EMAIL: '2',
  PASSWORD: '3'
}

function normalizeAccount(account) {
  return String(account || '').trim()
}

function normalizePasswordHistory(value) {
  if (!Array.isArray(value)) return []

  const accounts = new Set()
  return value.reduce((records, item) => {
    const account = normalizeAccount(item && item.account)
    const password = String((item && item.password) || '')
    if (!account || !password || accounts.has(account)) return records

    accounts.add(account)
    records.push({ account, password, label: account })
    return records
  }, [])
}

function normalizeAccountHistory(value) {
  if (!Array.isArray(value)) return []

  const accounts = new Set()
  return value.reduce((records, item) => {
    const account = normalizeAccount(typeof item === 'string' ? item : item && item.account)
    if (!account || accounts.has(account)) return records

    accounts.add(account)
    records.push({ account, label: account })
    return records
  }, [])
}

function getPasswordHistory() {
  const stored = wx.getStorageSync(PASSWORD_HISTORY_KEY)
  if (Array.isArray(stored)) {
    wx.removeStorageSync(LEGACY_USERNAME_KEY)
    wx.removeStorageSync(LEGACY_PASSWORD_KEY)
    return normalizePasswordHistory(stored)
  }

  const account = normalizeAccount(wx.getStorageSync(LEGACY_USERNAME_KEY))
  const password = String(wx.getStorageSync(LEGACY_PASSWORD_KEY) || '')
  const records = account && password ? [{ account, password, label: account }] : []
  if (records.length) {
    wx.setStorageSync(PASSWORD_HISTORY_KEY, [{ account, password }])
  } else {
    wx.removeStorageSync(PASSWORD_HISTORY_KEY)
  }
  wx.removeStorageSync(LEGACY_USERNAME_KEY)
  wx.removeStorageSync(LEGACY_PASSWORD_KEY)
  return records
}

function getAccountHistory(key) {
  return normalizeAccountHistory(wx.getStorageSync(key))
}

function getHistory(loginWay) {
  if (loginWay === LOGIN_WAY.PASSWORD) return getPasswordHistory()
  if (loginWay === LOGIN_WAY.EMAIL) return getAccountHistory(EMAIL_HISTORY_KEY)
  return getAccountHistory(PHONE_HISTORY_KEY)
}

function savePassword(account, password) {
  const normalizedAccount = normalizeAccount(account)
  const normalizedPassword = String(password || '')
  if (!normalizedAccount || !normalizedPassword) return getPasswordHistory()

  const records = getPasswordHistory().filter((item) => item.account !== normalizedAccount)
  records.unshift({ account: normalizedAccount, password: normalizedPassword, label: normalizedAccount })
  wx.setStorageSync(PASSWORD_HISTORY_KEY, records.map((item) => ({
    account: item.account,
    password: item.password
  })))
  return records
}

function saveAccount(loginWay, account) {
  const key = loginWay === LOGIN_WAY.EMAIL ? EMAIL_HISTORY_KEY : PHONE_HISTORY_KEY
  const normalizedAccount = normalizeAccount(account)
  if (!normalizedAccount) return getAccountHistory(key)

  const records = getAccountHistory(key).filter((item) => item.account !== normalizedAccount)
  records.unshift({ account: normalizedAccount, label: normalizedAccount })
  wx.setStorageSync(key, records.map((item) => item.account))
  return records
}

function saveHistory(loginWay, account, password) {
  if (loginWay === LOGIN_WAY.PASSWORD) return savePassword(account, password)
  return saveAccount(loginWay, account)
}

function hasHistory(loginWay, account, password) {
  const normalizedAccount = normalizeAccount(account)
  return getHistory(loginWay).some((item) => {
    if (item.account !== normalizedAccount) return false
    return loginWay !== LOGIN_WAY.PASSWORD || item.password === String(password || '')
  })
}

function removeHistory(loginWay, account) {
  const normalizedAccount = normalizeAccount(account)
  const records = getHistory(loginWay).filter((item) => item.account !== normalizedAccount)

  if (loginWay === LOGIN_WAY.PASSWORD) {
    wx.setStorageSync(PASSWORD_HISTORY_KEY, records.map(({ account: itemAccount, password }) => ({
      account: itemAccount,
      password
    })))
  } else {
    const key = loginWay === LOGIN_WAY.EMAIL ? EMAIL_HISTORY_KEY : PHONE_HISTORY_KEY
    wx.setStorageSync(key, records.map((item) => item.account))
  }
  return records
}

function clearHistory() {
  wx.removeStorageSync(PASSWORD_HISTORY_KEY)
  wx.removeStorageSync(PHONE_HISTORY_KEY)
  wx.removeStorageSync(EMAIL_HISTORY_KEY)
  wx.removeStorageSync(LEGACY_USERNAME_KEY)
  wx.removeStorageSync(LEGACY_PASSWORD_KEY)
}

module.exports = {
  LOGIN_WAY,
  getHistory,
  saveHistory,
  hasHistory,
  removeHistory,
  clearHistory
}
