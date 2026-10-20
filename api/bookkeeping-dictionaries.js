const request = require('./request')
const base = '/bookkeeping-service/bookkeeping/dictionaries'
module.exports = {
  list: (type, scope) => request.get(`${base}/items`, { type, scope }),
  options: (type) => request.get(`${base}/options`, { type }),
  add: (data) => request.post(`${base}/items`, data),
  rename: (id, data) => request.put(`${base}/items/${id}/name`, data),
  status: (id, data) => request.put(`${base}/items/${id}/status`, data),
  order: (data) => request.put(`${base}/order`, data),
  remove: (id, revision) => request.delete(`${base}/items/${id}`, { revision }),
  copyPersonal: (data) => request.post(`${base}/copy-personal`, data)
}
