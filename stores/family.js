const familyApi = require('../api/family')

const MY_GROUP_KEY = 'myGroup'

let myGroup = wx.getStorageSync(MY_GROUP_KEY) || null
let isLoading = false

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
  myGroup = groupData
  wx.setStorageSync(MY_GROUP_KEY, myGroup)
}

function clearGroup() {
  myGroup = null
  wx.removeStorageSync(MY_GROUP_KEY)
}

async function fetchMyGroup() {
  if (isLoading) return myGroup
  isLoading = true

  try {
    const res = await familyApi.getMyGroup()
    if (res.data) {
      updateGroup(res.data)
    } else {
      clearGroup()
    }
  } catch (error) {
    myGroup = wx.getStorageSync(MY_GROUP_KEY) || null
  } finally {
    isLoading = false
  }

  return myGroup
}

module.exports = {
  getMyGroupState,
  hasGroup,
  groupName,
  isOwner,
  updateGroup,
  clearGroup,
  fetchMyGroup
}
