const http = require('./request')
const base = '/auth-service/business-settings'
module.exports = {
  capabilities: () => http.get(`${base}/capabilities`),
  preview: (domain, type) => http.get(`${base}/${domain}/preview`, { type }),
  sync: (domain, type, scopeVersion) => http.post(http.appendQuery(`${base}/${domain}/sync`, { type }), { scopeVersion }),
  refresh: (domain) => http.post(`${base}/${domain}/refresh-cache`),
  legacyType: (id) => http.get(`${base}/legacy-type`, { id })
}
