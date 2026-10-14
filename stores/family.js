const familyApi = require('../api/family')

const MY_GROUP_KEY = 'myGroup'

let myGroup = wx.getStorageSync(MY_GROUP_KEY) || null
let loadingPromise = null
let loaded = false
let lastFetchError = null

function getMyGroupState() {
  return myGroup
}

function hasGroup() {
  return myGroup !== null
}

function groupName() {
  return myGroup ? myGroup.groupName : '未加入'
}

function isOwner() {
  if (!myGroup) return false
  const userInfo = wx.getStorageSync('userInfo')
  return myGroup.ownerUserId === (userInfo && userInfo.id)
}

function updateGroup(groupData) {
  if (!groupData) {
    clearGroup()
    return
  }
  loaded = true
  myGroup = groupData
  wx.setStorageSync(MY_GROUP_KEY, myGroup)
}

function clearGroup() {
  loaded = false
  myGroup = null
  wx.removeStorageSync(MY_GROUP_KEY)
}

function fetchMyGroup() {
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    try {
      const res = await familyApi.getMyGroup()
      if (res.data) updateGroup(res.data)
      else clearGroup()
      loaded = true
      lastFetchError = null
    } catch (error) {
      lastFetchError = error
      myGroup = wx.getStorageSync(MY_GROUP_KEY) || null
    }
    return myGroup
  })().finally(() => { loadingPromise = null })
  return loadingPromise
}

async function ensureMyGroupLoaded() {
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
