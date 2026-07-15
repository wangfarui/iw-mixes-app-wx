const { getBaseUrl } = require('../config/env')
const sessionStore = require('../stores/session')
const { redirectToLogin } = require('../utils/auth')

function buildQuery(params) {
  if (!params) return ''

  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function appendQuery(url, params) {
  const queryString = buildQuery(params)
  if (!queryString) return url
  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`
}

function showToast(title, icon = 'none') {
  wx.showToast({
    title,
    icon,
    duration: 1800
  })
}

function handleUnauthorized(reject) {
  showToast('登录状态失效', 'error')
  sessionStore.clearLoginSession()
  redirectToLogin()
  reject(new Error('未授权，请登录'))
}

function request(url, method, data = {}, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBaseUrl()}${url}`,
      method: method.toUpperCase(),
      data,
      header: {
        ...sessionStore.tokenHeader(),
        ...(options.header || {})
      },
      success(res) {
        const result = res.data

        if (!result) {
          showToast('数据加载异常', 'error')
          reject(new Error('数据加载异常'))
          return
        }

        if (result.code === 401) {
          handleUnauthorized(reject)
          return
        }

        if (result.code !== 200) {
          const message = result.message || result.msg || '请求失败'
          showToast(message)
          reject(new Error(message))
          return
        }

        resolve(result)
      },
      fail(error) {
        showToast('请求异常', 'error')
        reject(error)
      }
    })
  })
}

function get(url, params) {
  return request(appendQuery(url, params), 'GET')
}

function del(url, params) {
  return request(appendQuery(url, params), 'DELETE')
}

function post(url, data) {
  return request(url, 'POST', data)
}

function put(url, data) {
  return request(url, 'PUT', data)
}

module.exports = {
  request,
  get,
  delete: del,
  post,
  put,
  appendQuery
}
