const familyApi = require('../api/family')

const MY_GROUP_KEY = 'myGroup'

let myGroup = wx.getStorageSync(MY_GROUP_KEY) || null
let loadingPromise = null
let loaded = false
let lastFetchError = null
let sessionKey = ''
let requestGeneration = 0
function currentSessionKey() { return `${wx.getStorageSync('iwtoken') || ''}:${(wx.getStorageSync('userInfo') || {}).id || ''}` }
function syncSession() {
  const key = currentSessionKey()
  if (key !== sessionKey) {
    sessionKey = key; requestGeneration += 1; myGroup = null; loaded = false; loadingPromise = null; lastFetchError = null
    wx.removeStorageSync(MY_GROUP_KEY)
  }
}
function invalidateOptions() { require('./bookkeeping-options').invalidate() }

function getMyGroupState() {
  syncSession()
  return myGroup
}

function hasGroup() {
  syncSession()
  return myGroup !== null
}

function groupName() {
  syncSession()
  return myGroup ? myGroup.groupName : '未加入'
}

function isOwner() {
  syncSession()
  if (!myGroup) return false
  const userInfo = wx.getStorageSync('userInfo')
  return myGroup.ownerUserId === (userInfo && userInfo.id)
}

function updateGroup(groupData) {
  syncSession()
  invalidateOptions()
  if (!groupData) {
    clearGroup()
    return
  }
  requestGeneration += 1
  loadingPromise = null
  loaded = true
  myGroup = groupData
  wx.setStorageSync(MY_GROUP_KEY, myGroup)
}

function clearGroup() {
  requestGeneration += 1
  loadingPromise = null
  invalidateOptions()
  loaded = false
  myGroup = null
  wx.removeStorageSync(MY_GROUP_KEY)
}

function fetchMyGroup() {
  syncSession()
  if (loadingPromise) return loadingPromise
  const key = sessionKey
  const requestId = requestGeneration
  const promise = (async () => {
    try {
      const res = await familyApi.getMyGroup()
      if (key !== currentSessionKey() || requestId !== requestGeneration) return null
      const previousGroup = myGroup && (myGroup.id || myGroup.familyGroupId)
      const nextGroup = res.data && (res.data.id || res.data.familyGroupId)
      if (String(previousGroup || '') !== String(nextGroup || '')) invalidateOptions()
      myGroup = res.data || null
      if (myGroup) wx.setStorageSync(MY_GROUP_KEY, myGroup)
      else wx.removeStorageSync(MY_GROUP_KEY)
      loaded = true
      lastFetchError = null
    } catch (error) {
      if (key !== currentSessionKey() || requestId !== requestGeneration) return null
      lastFetchError = error
    }
    return myGroup
  })().finally(() => { if (loadingPromise === promise) loadingPromise = null })
  loadingPromise = promise
  return promise
}

async function ensureMyGroupLoaded() {
  syncSession()
  if (loadingPromise) await loadingPromise
  else if (!loaded || lastFetchError) await fetchMyGroup()
  if (lastFetchError) throw lastFetchError
  return myGroup
}

module.exports = {
  getMyGroupState,
  hasGroup,
  groupName,
  isOwner,
  updateGroup,
  clearGroup,
  fetchMyGroup,
  ensureMyGroupLoaded
}
