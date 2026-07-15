const familyStore = require('./family')

const QUERY_SCOPE_SHARED = 'shared'
const QUERY_SCOPE_MYSELF = 'myself'
const CHILD_ROLE_CODE = 4

function getCurrentGroup() {
  return familyStore.getMyGroupState() || wx.getStorageSync('myGroup') || null
}

function getCurrentUserRole() {
  const group = getCurrentGroup()
  const role = group && group.currentUserRole
  return role == null ? null : Number(role)
}

function isChildRole() {
  return getCurrentUserRole() === CHILD_ROLE_CODE
}

function hasGroup() {
  return Boolean(getCurrentGroup())
}

function getEffectiveScope() {
  const group = getCurrentGroup()
  if (!group || isChildRole()) {
    return QUERY_SCOPE_MYSELF
  }
  return Number(group.queryOnlyMyself) === 1 ? QUERY_SCOPE_MYSELF : QUERY_SCOPE_SHARED
}

function getQueryOnlyMyself() {
  return getEffectiveScope() === QUERY_SCOPE_MYSELF ? 1 : null
}

function getScopeText() {
  return getEffectiveScope() === QUERY_SCOPE_MYSELF ? '仅自己' : '家庭共享'
}

function getDefaultShared() {
  const group = getCurrentGroup()
  if (!group) return false
  if (isChildRole()) return true
  return Number(group.defaultShared) === 1
}

function canControlRecordShared() {
  return hasGroup() && !isChildRole()
}

function getDefaultRecordShared() {
  if (!hasGroup()) return 0
  return getDefaultShared() ? 1 : 0
}

function setScope(scope) {
  const group = getCurrentGroup()
  if (!group || isChildRole()) return

  familyStore.updateGroup({
    ...group,
    queryOnlyMyself: scope === QUERY_SCOPE_MYSELF ? 1 : 0
  })
}

function setDefaultShared(enabled) {
  const group = getCurrentGroup()
  if (!group) return

  familyStore.updateGroup({
    ...group,
    defaultShared: enabled ? 1 : 0
  })
}

function getScopeState() {
  return {
    hasGroup: hasGroup(),
    effectiveScope: getEffectiveScope(),
    queryOnlyMyself: getQueryOnlyMyself(),
    scopeText: getScopeText(),
    canChangeScope: hasGroup() && !isChildRole(),
    defaultShared: getDefaultShared(),
    canControlRecordShared: canControlRecordShared(),
    defaultRecordShared: getDefaultRecordShared()
  }
}

module.exports = {
  QUERY_SCOPE_SHARED,
  QUERY_SCOPE_MYSELF,
  CHILD_ROLE_CODE,
  getCurrentGroup,
  getCurrentUserRole,
  isChildRole,
  hasGroup,
  getEffectiveScope,
  getQueryOnlyMyself,
  getScopeText,
  getDefaultShared,
  canControlRecordShared,
  getDefaultRecordShared,
  setScope,
  setDefaultShared,
  getScopeState
}
