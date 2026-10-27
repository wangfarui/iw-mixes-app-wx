const session = require('./session')
const family = require('./family')
const eatApi = require('../api/eat')

let generation = 0
const optionsCache = new Map()
let filtersCache = null

function identity() {
  const user = session.getUserInfo() || {}
  const group = family.getMyGroupState()
  return JSON.stringify([
    user.id || user.userId,
    session.getToken(),
    group && (group.id || group.familyGroupId),
    group && group.currentUserRole,
    group && group.defaultShared,
    group && group.queryOnlyMyself
  ])
}

function invalidate() {
  generation += 1
  optionsCache.clear()
  filtersCache = null
}

function assertCurrent(before, requestGeneration) {
  if (before !== identity() || requestGeneration !== generation) {
    throw new Error('所属人或家庭已变化，请重新加载')
  }
}

async function loadOptions(params = {}) {
  const before = identity()
  const requestGeneration = generation
  const result = await eatApi.getFridgeFoodOptions(params)
  assertCurrent(before, requestGeneration)
  const data = result.data || {}
  const owner = Number(data.ownerUserId || ((session.getUserInfo() || {}).id || (session.getUserInfo() || {}).userId) || 0)
  const key = `${owner}:${params.foodId || ''}`
  optionsCache.set(key, { identity: before, data })
  return data
}

function getOptions(params = {}) {
  const user = session.getUserInfo() || {}
  const owner = Number(params.ownerUserId || user.id || user.userId || 0)
  const key = `${owner}:${params.foodId || ''}`
  const entry = optionsCache.get(key)
  return entry && entry.identity === identity() ? entry.data : null
}

async function loadFilters() {
  const before = identity()
  const requestGeneration = generation
  const result = await eatApi.getFridgeFoodFilters()
  assertCurrent(before, requestGeneration)
  const data = result.data || {}
  filtersCache = { identity: before, data }
  return data
}

function getFilters() {
  return filtersCache && filtersCache.identity === identity() ? filtersCache.data : null
}

module.exports = { identity, invalidate, loadOptions, getOptions, loadFilters, getFilters }
