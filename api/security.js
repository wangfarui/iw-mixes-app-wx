const http = require('./request')

const CONTACT_TYPE = {
  PHONE: 1,
  EMAIL: 2
}

const VERIFY_METHOD = {
  PASSWORD: 1,
  PHONE: 2,
  EMAIL: 3
}

const SECURITY_OPERATION = {
  BIND_PHONE: 1,
  CHANGE_PHONE: 2,
  UNBIND_PHONE: 3,
  BIND_EMAIL: 4,
  CHANGE_EMAIL: 5,
  UNBIND_EMAIL: 6,
  EDIT_USERNAME: 7,
  SET_PASSWORD: 8,
  CHANGE_PASSWORD: 9,
  DELETE_ACCOUNT: 10
}

function getUserInfo() {
  return http.get('/auth-service/user/getUserInfo')
}

function sendSecurityVerificationCode(operation, method) {
  return http.post('/auth-service/user/security/verificationCode', { operation, method })
}

function verifySecurityIdentity(data) {
  return http.post('/auth-service/user/security/verify', data)
}

function sendContactVerificationCode(data) {
  return http.post('/auth-service/user/security/contact/verificationCode', data)
}

function updateContact(data) {
  return http.put('/auth-service/user/security/contact', data)
}

function unbindContact(data) {
  return http.post('/auth-service/user/security/contact/unbind', data)
}

function editUsername(data) {
  return http.put('/auth-service/user/editUsername', data)
}

function editPassword(data) {
  return http.put('/auth-service/user/security/password', data)
}

function deleteAccount(data) {
  return http.request('/auth-service/user/security/account', 'DELETE', data)
}

module.exports = {
  CONTACT_TYPE,
  VERIFY_METHOD,
  SECURITY_OPERATION,
  getUserInfo,
  sendSecurityVerificationCode,
  verifySecurityIdentity,
  sendContactVerificationCode,
  updateContact,
  unbindContact,
  editUsername,
  editPassword,
  deleteAccount
}
