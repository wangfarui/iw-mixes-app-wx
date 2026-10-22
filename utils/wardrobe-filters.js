const api = require('../api/wardrobe')
const options = require('../stores/wardrobe-options')
async function load(page, businessType = 'ITEM', params = {}) {
  const sequence = page._filterRequest = (page._filterRequest || 0) + 1
  const identity = options.identity()
  const result = await api.getFilters({ businessType, ...params })
  if (sequence !== page._filterRequest || identity !== options.identity()) return false
  page._historyFilters = result.data || {}
  return true
}
function choices(page, type) { return (page._historyFilters && page._historyFilters[type]) || [] }
function itemStyles(page, category) { return choices(page, 'itemStyles').filter(item => !category || item.parentKey === category) }
module.exports = { load, choices, itemStyles }
