const request = require('./request')

const base = '/auth-service/kitchen/dictionaries'
const header = { 'X-IW-Kitchen-Contract': '1' }

function send(path, method, data) {
  const query = method === 'GET' || method === 'DELETE'
  return request.request(
    query ? request.appendQuery(base + path, data) : base + path,
    method,
    query ? {} : data,
    { header }
  )
}

function management(page) {
  const versions = {}
  const groups = {}

  function context() {
    return {
      scopeVersion: page.data.scopeVersion,
      expectedFamilyGroupId: groups[page.data.scope] || null
    }
  }

  return {
    async list(type, scope) {
      const result = await send('/items', 'GET', { type, scope })
      const data = result.data || {}
      versions[scope] = data.scopeVersion
      groups[scope] = data.familyGroupId
      return result
    },
    add: (data) => send('/items', 'POST', { ...data, ...context() }),
    rename: (id, data) => send(`/items/${id}/name`, 'PUT', { ...data, ...context() }),
    status: (id, data) => send(`/items/${id}/status`, 'PUT', { ...data, ...context() }),
    remove: (id, revision) => send(`/items/${id}`, 'DELETE', { revision, ...context() }),
    order: (data) => send('/order', 'PUT', { ...context(), ...data }),
    copyPersonal: (data) => send('/copy-personal', 'POST', {
      ...data,
      personalScopeVersion: versions.PERSONAL,
      familyScopeVersion: page.data.scopeVersion,
      expectedFamilyGroupId: groups.FAMILY
    })
  }
}

module.exports = {
  management,
  initialize: (data) => send('/initialize', 'POST', data)
}
