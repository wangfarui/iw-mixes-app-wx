const http = require('./request')

function getMyGroup() {
  return http.get('/auth-service/family/group/myGroup')
}

function createGroup(data) {
  return http.post('/auth-service/family/group/add', data)
}

function updateGroup(data) {
  return http.put('/auth-service/family/group/update', data)
}

function deleteGroup(id) {
  return http.delete('/auth-service/family/group/delete', { id })
}

function getGroupDetail(id) {
  return http.get('/auth-service/family/group/detail', { id })
}

function generateInvite(data) {
  return http.post('/auth-service/family/group/generateInvite', data)
}

function validateInvite(inviteCode) {
  return http.get('/auth-service/family/group/validateInvite', { inviteCode })
}

function getInviteList(groupId) {
  return http.get('/auth-service/family/group/inviteList', { groupId })
}

function joinGroup(data) {
  return http.post('/auth-service/family/group/join', data)
}

function quitGroup(groupId) {
  return http.post(`/auth-service/family/group/quit?groupId=${groupId}`)
}

function removeMember(data) {
  return http.post('/auth-service/family/group/removeMember', data)
}

function getMemberList(groupId) {
  return http.get('/auth-service/family/group/memberList', { groupId })
}

function transferOwner(data) {
  return http.post('/auth-service/family/group/transferOwner', data)
}

function assignMemberRole(data) {
  return http.post('/auth-service/family/group/assignRole', data)
}

function getMyDefaultShared(groupId) {
  return http.get('/auth-service/family/group/myDefaultShared', { groupId })
}

function updateMyDefaultShared(data) {
  return http.post('/auth-service/family/group/updateMyDefaultShared', data)
}

function updateMyQueryScope(data) {
  return http.post('/auth-service/family/group/updateMyQueryScope', data)
}

module.exports = {
  getMyGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupDetail,
  generateInvite,
  validateInvite,
  getInviteList,
  joinGroup,
  quitGroup,
  removeMember,
  getMemberList,
  transferOwner,
  assignMemberRole,
  getMyDefaultShared,
  updateMyDefaultShared,
  updateMyQueryScope
}
