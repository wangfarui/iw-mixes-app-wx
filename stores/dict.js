const DICT_TYPE_KEY = 'dictTypeArray'
const DICT_DATA_KEY = 'dictArrayMap'

const dictTypeEnum = Object.freeze({
  BASE_DICT_TYPE: 'dictType',
  AUTH_APPLICATION_ACCOUNT_TYPE: '2010',
  EAT_MEAL_TIME: '3002',
  EAT_DISHES_TYPE: '3003',
  EAT_DISHES_STATUS: '3004',
  EAT_FRIDGE_CATEGORY: '3010',
  EAT_FRIDGE_SECTION: '3011',
  BOOKKEEPING_RECORD_TAG_CONSUME: '4001',
  BOOKKEEPING_RECORD_TAG_INCOME: '4011',
  BOOKKEEPING_RECORD_TYPE: '4002',
  BOOKKEEPING_RECORD_CATEGORY: '4003',
  BOOKKEEPING_MEMBERSHIP_TYPE: '4004',
  BOOKKEEPING_MEMBERSHIP_BILLING_CYCLE: '4005',
  BOOKKEEPING_MEMBERSHIP_CYCLE_UNIT: '4006',
  WARDROBE_ITEM_CATEGORY: '5002',
  WARDROBE_ITEM_COLOR: '5003',
  WARDROBE_ITEM_SCENE: '5004',
  WARDROBE_ITEM_STYLE: '5005',
  WARDROBE_ITEM_SUBCATEGORY: '5006'
})

let dictTypeArray = wx.getStorageSync(DICT_TYPE_KEY) || []
let dictArrayMap = wx.getStorageSync(DICT_DATA_KEY) || {}

function setDictTypeArray(data) {
  dictTypeArray = Array.isArray(data) ? data : []
  wx.setStorageSync(DICT_TYPE_KEY, dictTypeArray)
}

function getDictTypeArray() {
  return dictTypeArray
}

function getDictTypeName(code) {
  const item = dictTypeArray.find((dictType) => dictType.code === code)
  return item ? item.name : ''
}

function setDictDataArrayMap(data) {
  dictArrayMap = data || {}
  wx.setStorageSync(DICT_DATA_KEY, dictArrayMap)
}

function getDictDataArray(dictType) {
  return dictArrayMap[dictType] || []
}

function getDictDataWithDataSelectCode(dictType) {
  return getDictDataArray(dictType).map((item) => ({
    text: item.dictName,
    value: item.dictCode
  }))
}

function getDictDataWithDataSelectId(dictType) {
  return getDictDataArray(dictType).map((item) => ({
    text: item.dictName,
    value: item.id
  }))
}

function getDictNameById(dictType, id) {
  const item = getDictDataArray(dictType).find((dict) => dict.id === id)
  return item ? item.dictName : ''
}

function getDictNameByCode(dictType, dictCode, defaultName = '') {
  const item = getDictDataArray(dictType).find((dict) => dict.dictCode === dictCode)
  return item ? item.dictName : defaultName
}

function clearDictCache() {
  dictTypeArray = []
  dictArrayMap = {}
  wx.removeStorageSync(DICT_TYPE_KEY)
  wx.removeStorageSync(DICT_DATA_KEY)
}

module.exports = {
  dictTypeEnum,
  setDictTypeArray,
  getDictTypeArray,
  getDictTypeName,
  setDictDataArrayMap,
  getDictDataArray,
  getDictDataWithDataSelectCode,
  getDictDataWithDataSelectId,
  getDictNameById,
  getDictNameByCode,
  clearDictCache
}
