const options = require('../stores/wardrobe-options')
const helper = require('../pagesWardrobe/wardrobe/wardrobe-helper')
function ids(tags) { return (tags || []).map(item => item.sourceId).filter(Boolean).join(',') }
function remember(page, detail) {
  page._originalDetails = new Map((detail.itemList || []).map(item => [Number(item.itemId), item.detailId]))
  page._historicalTags = {sceneIds:detail.sceneSnapshots || [],styleIds:detail.styleSnapshots || []}
  page.setData({savedSceneText:(detail.sceneSnapshots || []).map(row=>row.nameSnapshot).join('、'),savedStyleText:(detail.styleSnapshots || []).map(row=>row.nameSnapshot).join('、')})
  page._droppedDetails = new Set()
  page._itemSetVersion = detail.itemSetVersion
}
async function load(page, businessType, businessId) {
  const sequence = page._optionRequest = (page._optionRequest || 0) + 1
  try {
    const data = await options.load({ businessType, businessId: businessId || undefined })
    if (sequence !== page._optionRequest) return
    page._dictionaryContext = { contextToken: data.contextToken }
    const historicalOptions = (choices, key, selected) => {
      for (const tag of (page._historicalTags || {})[key] || []) if (tag.sourceId && !choices.some(row => row.value === tag.sourceId)) choices.push({value:tag.sourceId,text:tag.nameSnapshot + '（历史）',historical:true})
      return helper.enhanceTagOptions(choices,selected)
    }
    page.setData({ dictionaryError: '',
      sceneOptions: historicalOptions(helper.getSceneOptions(), 'sceneIds', page.data.formData.sceneTags),
      ...(businessType === 'OUTFIT' ? { styleOptions: historicalOptions(helper.getStyleOptions(), 'styleIds', page.data.formData.styleTags) } : {}) })
  } catch (error) {
    if (sequence === page._optionRequest) { page._dictionaryContext = null; page.setData({ dictionaryError: error.message || '选项加载失败' }) }
  }
}
function prepare(page, payload, edit, hasStyle) {
  const form = page.data.formData
  const selection = { sceneIds: helper.splitTags(form.sceneTags).map(Number) }
  if (hasStyle) selection.styleIds = helper.splitTags(form.styleTags).map(Number)
  delete payload.sceneTags; delete payload.styleTags
  payload.dictionaryContext = page._dictionaryContext
  if (edit) {
    payload.dictionaryChanges = {}
    for (const key of page._dictionaryDirty || []) payload.dictionaryChanges[key] = selection[key]
  } else {
    if (!page._dictionaryContext) throw new Error('请先加载当前衣柜选项后重试')
    payload.dictionarySelection = selection
  }
  return payload
}
function details(page, itemIds) {
  return (itemIds || []).map(value => {
    const id = Number(value)
    const original = page._originalDetails && page._originalDetails.get(id)
    return original && !(page._droppedDetails || new Set()).has(id) ? { detailId: original } : { itemId: id }
  })
}
function toggle(page, id, removing) {
  page._detailsDirty = true
  if (removing && page._originalDetails && page._originalDetails.has(id)) (page._droppedDetails || (page._droppedDetails = new Set())).add(id)
}
module.exports = { ids, remember, load, prepare, details, toggle }
