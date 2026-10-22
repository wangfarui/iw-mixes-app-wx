const request = require('./request')
const base = '/auth-service/wardrobe/dictionaries'
function send(path, method, data) {
  const query = method === 'GET' || method === 'DELETE'
  return request.request(query ? request.appendQuery(base + path, data) : base + path, method, query ? {} : data,
    { header: { 'X-IW-Wardrobe-Contract': '2' } })
}
function management(page) {
  const versions = {}
  const groups = {}
  function context() { return { scopeVersion: page.data.scopeVersion, expectedFamilyGroupId: groups[page.data.scope] || null } }
  return {
    async list(type, scope, allParents = false) {
      const identity = require('../stores/wardrobe-options').identity()
      const sequence = page._request
      let parent = null
      if (type === 'ITEM_STYLE') {
        const categories = (await send('/items', 'GET', { type: 'CATEGORY', scope })).data || {}
        const parents = categories.items || []
        const selected = allParents ? null : parents.find(item => Number(item.id) === Number(page.data.selectedParentId)) || parents[0]
        parent = selected || null
        if (!allParents && scope === page.data.scope && sequence === page._request && identity === require('../stores/wardrobe-options').identity()) page.setData({ parentItems: parents, parentIndex: selected ? parents.indexOf(selected) : 0, selectedParentId: selected ? selected.id : null, selectedParent: selected || null })
      }
      const result = await send('/items', 'GET', { type, scope, categoryLineageId: parent ? parent.categoryLineageId : null })
      if (type === 'ITEM_STYLE' && !parent && !allParents) result.data.items = []
      if (type === 'ITEM_STYLE' && allParents) {
        const categories = (await send('/items', 'GET', {type:'CATEGORY',scope})).data.items || []
        const byLineage = new Map(categories.map(row => [row.categoryLineageId,row]))
        result.data.items = (result.data.items || []).map(row => {const parentRow=byLineage.get(row.categoryLineageId); return {...row, parentName:parentRow && parentRow.name, parentKind:parentRow && parentRow.matchKind, name:(parentRow ? parentRow.name + ' / ' : '') + row.name, enabled:row.enabled && Boolean(parentRow && parentRow.enabled)} })
      }
      versions[scope] = result.data.scopeVersion; groups[scope] = result.data.familyGroupId
      return result
    },
    add: data => send('/items', 'POST', { ...data, ...context(), parentId: data.type === 'ITEM_STYLE' ? page.data.selectedParentId : null,
      parentRevision: data.type === 'ITEM_STYLE' && page.data.selectedParent ? page.data.selectedParent.revision : null,
      matchKind: data.type === 'CATEGORY' ? page.data.matchKindIndex + 1 : null }),
    rename: (id, data) => send(`/items/${id}/name`, 'PUT', { ...data, ...context() }),
    status: (id, data) => send(`/items/${id}/status`, 'PUT', { ...data, ...context() }),
    remove: (id, revision) => send(`/items/${id}`, 'DELETE', { revision, ...context() }),
    order: data => send('/order', 'PUT', { ...context(), ...data, categoryLineageId: page.data.selectedParent ? page.data.selectedParent.categoryLineageId : null }),
    copyPersonal: data => send('/copy-personal', 'POST', { ...data, personalScopeVersion: versions.PERSONAL, familyScopeVersion: page.data.scopeVersion, expectedFamilyGroupId: groups.FAMILY })
  }
}
module.exports = { management, initialize: data => send('/initialize', 'POST', data) }
