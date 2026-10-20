const api = require('../api/bookkeeping-dictionaries')
const session = require('./session')
const family = require('./family')
const TYPES = { '4002': 'CATEGORY', '4001': 'EXPENSE_TAG', '4011': 'INCOME_TAG' }
let generation = 0
let partition = ''
let values = {}
function identity() {
  const user = session.getUserInfo() || {}
  const group = family.getMyGroupState() || {}
  return `${user.id || ''}:${session.getToken() || ''}:${group.id || group.familyGroupId || ''}`
}
function invalidate() { generation += 1; partition = ''; values = {} }
function get(type) {
  if (partition !== identity()) return []
  return values[TYPES[type] || type] || []
}
async function refresh() {
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
  const types = Object.keys(TYPES).map((key) => TYPES[key])
  const responses = await Promise.all(types.map((type) => api.options(type)))
  if (requestId !== generation || key !== identity()) return false
  const next = {}
  responses.forEach((response, index) => {
    next[types[index]] = (response.data || []).map((item) => ({ ...item, dictName: item.name }))
  })
  values = next
  return true
}
module.exports = { get, refresh, invalidate, identity }
