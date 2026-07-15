const RUNTIME_ENV_STORAGE_KEY = 'iw_runtime_env'

const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production'
}

const ENV_CONFIG = {
  [ENV.DEVELOPMENT]: {
    name: '本地联调',
    baseUrl: 'http://localhost:18000'
  },
  [ENV.PRODUCTION]: {
    name: '生产环境',
    baseUrl: 'https://api.itwray.com'
  }
}

function getMiniProgramEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    return accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion
  } catch (error) {
    return ''
  }
}

function normalizeEnv(env) {
  return ENV_CONFIG[env] ? env : ENV.DEVELOPMENT
}

function getRuntimeEnv() {
  const envVersion = getMiniProgramEnvVersion()
  if (envVersion === 'trial' || envVersion === 'release') {
    return ENV.PRODUCTION
  }

  const storedEnv = wx.getStorageSync(RUNTIME_ENV_STORAGE_KEY)
  return normalizeEnv(storedEnv || ENV.DEVELOPMENT)
}

function setRuntimeEnv(env) {
  const normalizedEnv = normalizeEnv(env)
  wx.setStorageSync(RUNTIME_ENV_STORAGE_KEY, normalizedEnv)
  return normalizedEnv
}

function clearRuntimeEnv() {
  wx.removeStorageSync(RUNTIME_ENV_STORAGE_KEY)
}

function getEnvConfig() {
  return ENV_CONFIG[getRuntimeEnv()]
}

function getBaseUrl() {
  return getEnvConfig().baseUrl
}

module.exports = {
  ENV,
  ENV_CONFIG,
  RUNTIME_ENV_STORAGE_KEY,
  getRuntimeEnv,
  setRuntimeEnv,
  clearRuntimeEnv,
  getEnvConfig,
  getBaseUrl
}
