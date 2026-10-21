const api = require('../api/bookkeeping-dictionaries')
const session = require('./session')
const family = require('./family')
const TYPES = { '4002': 'CATEGORY', '4001': 'EXPENSE_TAG', '4011': 'INCOME_TAG' }
let generation = 0
let partition = ''
let values = {}
let loadedAt = 0
let inFlight = null
const MAX_AGE_MS = 30 * 1000
function identity() {
  const user = session.getUserInfo() || {}
  const group = family.getMyGroupState() || {}
  return `${user.id || ''}:${session.getToken() || ''}:${group.id || group.familyGroupId || ''}`
}
function invalidate() { generation += 1; partition = ''; values = {}; loadedAt = 0; inFlight = null }
function get(type) {
  if (partition !== identity()) return []
  return values[TYPES[type] || type] || []
}
function refresh() {
  const key = identity()
  if (inFlight && inFlight.key === key) return inFlight.promise
  const request = { key }
  request.promise = load().finally(() => { if (inFlight === request) inFlight = null })
  inFlight = request
  return request.promise
}
function ensureLoaded() {
  if (partition === identity() && loadedAt && Date.now() - loadedAt < MAX_AGE_MS) return Promise.resolve(true)
  return refresh()
}
async function load() {
  const token = session.getToken()
  if (!token) { invalidate(); return false }
  const userId = (session.getUserInfo() || {}).id
  await family.fetchMyGroup()
  await family.ensureMyGroupLoaded()
  if (token !== session.getToken() || userId !== (session.getUserInfo() || {}).id) return false
  const key = identity()
  const requestId = ++generation
  partition = key
  values = {}
  loadedAt = 0
  const types = Object.keys(TYPES).map((key) => TYPES[key])
  const responses = await Promise.all(types.map((type) => api.options(type)))
  if (requestId !== generation || key !== identity()) return false
  const next = {}
  responses.forEach((response, index) => {
    next[types[index]] = (response.data || []).map((item) => ({ ...item, dictName: item.name }))
  })
  values = next
  loadedAt = Date.now()
  return true
}
module.exports = { get, refresh, ensureLoaded, invalidate, identity }
