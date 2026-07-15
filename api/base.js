const http = require('./request')

function getDictPage(data) {
  return http.post('/auth-service/dict/page', data)
}

function getDictDetail(id) {
  return http.get('/auth-service/dict/detail', { id })
}

function addDict(data) {
  return http.post('/auth-service/dict/add', data)
}

function updateDict(data) {
  return http.put('/auth-service/dict/update', data)
}

function deleteDict(id) {
  return http.delete('/auth-service/dict/delete', { id })
}

function isAdminUser() {
  return http.get('/auth-service/user/isAdminUser')
}

function getUserInfo() {
  return http.get('/auth-service/user/getUserInfo')
}

function repairUserVisibleDictData() {
  return http.post('/auth-service/dict/repairUserVisibleDictData')
}

function getAccountPage(data) {
  return http.post('/auth-service/application/account/page', data)
}

function getAccountDetail(id) {
  return http.get('/auth-service/application/account/detail', { id })
}

function addAccount(data) {
  return http.post('/auth-service/application/account/add', data)
}

function updateAccount(data) {
  return http.put('/auth-service/application/account/update', data)
}

function deleteAccount(id) {
  return http.delete('/auth-service/application/account/delete', { id })
}

function viewAccountPassword(id) {
  return http.get('/auth-service/application/account/viewPassword', { id })
}

module.exports = {
  getDictPage,
  getDictDetail,
  addDict,
  updateDict,
  deleteDict,
  isAdminUser,
  getUserInfo,
  repairUserVisibleDictData,
  getAccountPage,
  getAccountDetail,
  addAccount,
  updateAccount,
  deleteAccount,
  viewAccountPassword
}
