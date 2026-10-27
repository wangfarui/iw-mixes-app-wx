const http = require('./request')
const session = require('../stores/session')
const root = '/auth-service/application/account/categories'
function checked(promise, token) {
  return promise.then(res => {
    if (token !== session.getToken()) throw new Error('会话已变化，请重新进入页面')
    return res.data
  })
}
module.exports = {
  list: () => checked(http.get(root), session.getToken()),
  create: data => checked(http.post(root, data), session.getToken()),
  rename: (id, data) => checked(http.put(`${root}/${id}/name`, data), session.getToken()),
  status: (id, data) => checked(http.put(`${root}/${id}/status`, data), session.getToken()),
  remove: (id, data) => checked(http.delete(`${root}/${id}`, data), session.getToken()),
  order: data => checked(http.put(`${root}/order`, data), session.getToken())
}
