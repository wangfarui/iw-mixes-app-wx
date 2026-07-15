const dictStore = require('../../stores/dict')
const eatCartStore = require('../../stores/eat-cart')
const utils = require('../../utils/bookkeeping')

function dictName(type, code, fallback = '-') {
  return dictStore.getDictNameByCode(type, code, fallback)
}

function optionList(type, includeAllText) {
  const rows = dictStore.getDictDataArray(type).map((item) => ({
    value: item.dictCode,
    text: item.dictName
  }))
  return includeAllText ? [{ value: '', text: includeAllText }].concat(rows) : rows
}

function formatDish(item) {
  return {
    ...item,
    dishesTypeName: dictName(dictStore.dictTypeEnum.EAT_DISHES_TYPE, item.dishesType, '未分类'),
    statusName: dictName(dictStore.dictTypeEnum.EAT_DISHES_STATUS, item.status, Number(item.status) === 3 ? '售空' : '正常'),
    priceText: item.prices == null ? '0' : String(item.prices),
    image: item.dishesImage || ''
  }
}

function formatMeal(item) {
  return {
    ...item,
    mealTimeName: item.mealTimeDesc || dictName(dictStore.dictTypeEnum.EAT_MEAL_TIME, item.mealTime, '未设置')
  }
}

function formatFood(item) {
  const today = utils.today()
  const expireDate = item.expireDate || ''
  const diffDays = expireDate ? Math.ceil((new Date(expireDate).getTime() - new Date(today).getTime()) / 86400000) : null
  return {
    ...item,
    emoji: item.emoji || '🍎',
    categoryName: dictName(dictStore.dictTypeEnum.EAT_FRIDGE_CATEGORY, item.category, '未分类'),
    sectionName: dictName(dictStore.dictTypeEnum.EAT_FRIDGE_SECTION, item.section, '未分区'),
    isExpired: diffDays != null && diffDays < 0,
    isExpiring: diffDays != null && diffDays >= 0 && diffDays <= 3,
    expireText: expireDate || '-'
  }
}

function getCartItems() {
  return eatCartStore.getCartItems().map(formatDish)
}

function setCartItems(items) {
  eatCartStore.setCartItems((items || []).map(formatDish))
}

function hasCartItem(id) {
  return getCartItems().some((item) => String(item.id) === String(id))
}

function addCartItem(item) {
  const current = getCartItems()
  if (!current.some((dish) => String(dish.id) === String(item.id))) {
    current.push(formatDish(item))
    setCartItems(current)
  }
  return current
}

function removeCartItem(id) {
  const next = getCartItems().filter((item) => String(item.id) !== String(id))
  setCartItems(next)
  return next
}

function toggleCartItem(item) {
  if (hasCartItem(item.id)) {
    return {
      items: removeCartItem(item.id),
      selected: false
    }
  }
  return {
    items: addCartItem(item),
    selected: true
  }
}

function clearCartItems() {
  eatCartStore.clearCartItems()
  return []
}

function calcCartSummary(items = getCartItems()) {
  const rows = Array.isArray(items) ? items : []
  const totalPrice = rows.reduce((total, item) => total + Number(item.prices || 0), 0)
  const totalUseTime = rows.reduce((total, item) => total + Number(item.useTime || 0), 0)
  return {
    count: rows.length,
    totalPrice,
    totalPriceText: String(totalPrice),
    totalUseTime
  }
}

module.exports = {
  CART_KEY: eatCartStore.CART_KEY,
  dictName,
  optionList,
  formatDish,
  formatMeal,
  formatFood,
  getCartItems,
  setCartItems,
  hasCartItem,
  addCartItem,
  removeCartItem,
  toggleCartItem,
  clearCartItems,
  calcCartSummary
}
