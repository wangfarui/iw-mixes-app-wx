const api = require('../api/bookkeeping-dictionaries')
const session = require('./session')
let generation = 0
let cache = null
let flight = null
function identity() { return `${(session.getUserInfo() || {}).id || ''}:${session.getToken() || ''}` }
function invalidate() { generation += 1; cache = null; flight = null }
function get() { return cache && cache.key === identity() ? cache.items : [] }
function ensureLoaded(force = false) {
  const key = identity()
  if (!session.getToken()) { invalidate(); return Promise.resolve(false) }
  if (!force && cache && cache.key === key && Date.now() - cache.time < 30000) return Promise.resolve(true)
  if (flight && flight.key === key) return flight.promise
  const seq = ++generation
  cache = null
  const request = { key }
  request.promise = api.options('MEMBERSHIP_TYPE').then((res) => {
    if (seq !== generation || key !== identity()) return false
    cache = { key, time: Date.now(), items: (res.data || []).map(item => ({ ...item, dictName: item.name })) }
    return true
  }).finally(() => { if (flight === request) flight = null })
  flight = request
  return request.promise
}
module.exports = { get, ensureLoaded, invalidate, identity }
