const runtimeEnv = require('../config/env')
const sessionStore = require('../stores/session')

module.exports = {
  ...runtimeEnv,
  token_key: sessionStore.TOKEN_KEY,
  getTokenValue: sessionStore.getToken,
  tokenHeader: sessionStore.tokenHeader
}
