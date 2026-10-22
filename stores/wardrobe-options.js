const session = require('./session')
const family = require('./family')
let generation = 0
const loaded = new Map()
function identity() {
  const user = session.getUserInfo() || {}
  const group = family.getMyGroupState()
  return JSON.stringify([user.id || user.userId, session.getToken(), group && (group.id || group.familyGroupId), group && group.currentUserRole, group && group.defaultShared, group && group.queryOnlyMyself])
}
function invalidate() { generation += 1; loaded.clear() }
async function load(params = {}) {
  const before = identity()
  const requestGeneration = generation
  const result = await require('../api/wardrobe').getOptions({ businessType: 'ITEM', ...params })
  if (before !== identity() || requestGeneration !== generation) throw new Error('所属人或家庭已变化，请重新加载')
  const data = result.data || {}
  loaded.set(Number(data.ownerUserId), {identity:before,data})
  return data
}
function get(owner) {
  const user = session.getUserInfo() || {}
  const entry = loaded.get(Number(owner || user.id || user.userId))
  return entry && entry.identity === identity() ? entry.data : null
}
module.exports = { identity, invalidate, load, get }
