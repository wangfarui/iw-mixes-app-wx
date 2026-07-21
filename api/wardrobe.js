const http = require('./request')

function getItemPage(data) {
  return http.post('/wardrobe/item/page', data)
}

function getItemDetail(id) {
  return http.get('/wardrobe/item/detail', { id })
}

function addItem(data) {
  return http.post('/wardrobe/item/add', data)
}

function batchAddItems(data) {
  return http.post('/wardrobe/item/batchAdd', data)
}

function updateItem(data) {
  return http.put('/wardrobe/item/update', data)
}

function deleteItem(id) {
  return http.delete('/wardrobe/item/delete', { id })
}

function deleteOptimizedItemImage(id) {
  return http.delete('/wardrobe/item/optimized-image/delete', { id })
}

function getItemTags() {
  return http.get('/wardrobe/item/tags')
}

function getOutfitPage(data) {
  return http.post('/wardrobe/outfit/page', data)
}

function getOutfitDetail(id) {
  return http.get('/wardrobe/outfit/detail', { id })
}

function addOutfit(data) {
  return http.post('/wardrobe/outfit/add', data)
}

function updateOutfit(data) {
  return http.put('/wardrobe/outfit/update', data)
}

function deleteOutfit(id) {
  return http.delete('/wardrobe/outfit/delete', { id })
}

function copyOutfit(id) {
  return http.post(`/wardrobe/outfit/copy?id=${id}`)
}

function aiSuggestOutfits(data) {
  return http.post('/wardrobe/assistant/suggest', data)
}

function recognizeItemDraft(data) {
  return http.post('/wardrobe/assistant/item-draft', data)
}

function startOptimizeItemImage(data) {
  return http.post('/wardrobe/assistant/item-image/optimize/start', data)
}

function retryOptimizeItemImage(taskId) {
  return http.post(`/wardrobe/assistant/item-image/optimize/retry?taskId=${encodeURIComponent(taskId)}`)
}

function getOptimizeItemImageStatus(taskId) {
  return http.get('/wardrobe/assistant/item-image/optimize/status', { taskId })
}

function getLatestOptimizeItemImageTask(itemId) {
  return http.get('/wardrobe/assistant/item-image/optimize/latest', { itemId })
}

function markOutfitWorn(data) {
  return http.post('/wardrobe/outfit/markWorn', data)
}

function addWearRecord(data) {
  return http.post('/wardrobe/wear-record/add', data)
}

function updateWearRecord(data) {
  return http.put('/wardrobe/wear-record/update', data)
}

function deleteWearRecord(id) {
  return http.delete('/wardrobe/wear-record/delete', { id })
}

function getWearRecordDetail(id) {
  return http.get('/wardrobe/wear-record/detail', { id })
}

function copyWearRecord(data) {
  return http.post('/wardrobe/wear-record/copy', data)
}

function getWearRecordMonth(data) {
  return http.post('/wardrobe/wear-record/month', data)
}

function getTodayWearRecords() {
  return http.get('/wardrobe/wear-record/today')
}

function markWearRecordWorn(id) {
  return http.put(`/wardrobe/wear-record/markRecordWorn?id=${id}`)
}

function markItemsWorn(data) {
  return http.post('/wardrobe/wear-record/markWorn', data)
}

function getStatisticsOverview() {
  return http.get('/wardrobe/statistics/overview')
}

module.exports = {
  getItemPage,
  getItemDetail,
  addItem,
  batchAddItems,
  updateItem,
  deleteItem,
  deleteOptimizedItemImage,
  getItemTags,
  getOutfitPage,
  getOutfitDetail,
  addOutfit,
  updateOutfit,
  deleteOutfit,
  copyOutfit,
  aiSuggestOutfits,
  recognizeItemDraft,
  startOptimizeItemImage,
  retryOptimizeItemImage,
  getOptimizeItemImageStatus,
  getLatestOptimizeItemImageTask,
  markOutfitWorn,
  addWearRecord,
  updateWearRecord,
  deleteWearRecord,
  getWearRecordDetail,
  copyWearRecord,
  getWearRecordMonth,
  getTodayWearRecords,
  markWearRecordWorn,
  markItemsWorn,
  getStatisticsOverview
}
