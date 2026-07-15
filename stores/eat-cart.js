const CART_KEY = 'eatDishesCart'

function getCartItems() {
  const items = wx.getStorageSync(CART_KEY)
  return Array.isArray(items) ? items : []
}

function setCartItems(items) {
  wx.setStorageSync(CART_KEY, Array.isArray(items) ? items : [])
}

function clearCartItems() {
  wx.removeStorageSync(CART_KEY)
}

module.exports = {
  CART_KEY,
  getCartItems,
  setCartItems,
  clearCartItems
}
