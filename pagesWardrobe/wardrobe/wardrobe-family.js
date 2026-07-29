const familyApi = require('../../api/family')
const familyStore = require('../../stores/family')
const familyScope = require('../../stores/family-shared-scope')

function currentUserId() {
  const userInfo = wx.getStorageSync('userInfo') || {}
  return Number(userInfo.id || 0)
}

async function loadOwnerOptions() {
  const userId = currentUserId()
  const group = familyStore.getMyGroupState()
  if (!group || !group.id) return [{ value: userId, text: '我' }]
  const res = await familyApi.getMemberList(group.id)
  const members = res.data || []
  return members.map((member) => ({
    value: Number(member.userId),
    text: Number(member.userId) === userId ? '我' : (member.name || member.username || '未命名成员'),
    avatar: member.avatar || ''
  }))
}

function canChooseOwner() {
  return familyScope.hasGroup() && !familyScope.isChildRole()
}

module.exports = {
  currentUserId,
  loadOwnerOptions,
  canChooseOwner
}
