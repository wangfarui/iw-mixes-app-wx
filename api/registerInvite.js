const http = require('./request')

function getRegisterInviteStatus() {
  return http.get('/auth-service/register/invite/status')
}

function updateRegisterInviteConfig(enabled) {
  return http.put('/auth-service/register/invite/config', { enabled })
}

function generateRegisterInvite() {
  return http.post('/auth-service/register/invite/generate')
}

function deleteRegisterInvite() {
  return http.delete('/auth-service/register/invite/current')
}

module.exports = {
  getRegisterInviteStatus,
  updateRegisterInviteConfig,
  generateRegisterInvite,
  deleteRegisterInvite
}
