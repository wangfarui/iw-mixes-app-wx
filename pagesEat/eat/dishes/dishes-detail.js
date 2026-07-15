const eatApi = require('../../../api/eat')
const sessionStore = require('../../../stores/session')
const helper = require('../eat-helper')

Page({
  data: {
    id: '',
    mode: 'manage',
    isOrderMode: false,
    currentUserId: '',
    isOwner: false,
    canOrder: true,
    inCart: false,
    cartSummary: helper.calcCartSummary([]),
    detail: {
      dishesMaterialList: [],
      dishesCreationMethodList: []
    }
  },

  onLoad(options = {}) {
    this.refreshCurrentUser()
    const mode = options.mode === 'order' ? 'order' : 'manage'
    this.setData({
      mode,
      isOrderMode: mode === 'order'
    })
    if (options.id) {
      this.setData({ id: options.id })
      this.fetchDetail(options.id)
    }
  },

  onShow() {
    this.refreshCartState()
  },

  refreshCurrentUser() {
    const userInfo = sessionStore.getUserInfo() || {}
    this.setData({ currentUserId: userInfo.id || '' })
  },

  async fetchDetail(id) {
    const res = await eatApi.getDishesDetail(id)
    const detail = helper.formatDish(res.data || {})
    this.setData({
      detail: {
        ...detail,
        dishesMaterialList: (res.data && res.data.dishesMaterialList) || [],
        dishesCreationMethodList: (res.data && res.data.dishesCreationMethodList) || []
      },
      isOwner: this.isCurrentUserDish(detail.userId),
      canOrder: Number(detail.status || 1) === 1
    })
    this.refreshCartState()
  },

  refreshCartState(cartItems) {
    const items = cartItems || helper.getCartItems()
    this.setData({
      inCart: items.some((item) => String(item.id) === String(this.data.id)),
      cartSummary: helper.calcCartSummary(items)
    })
  },

  previewImage() {
    if (!this.data.detail.dishesImage) return
    wx.previewImage({ urls: [this.data.detail.dishesImage], current: this.data.detail.dishesImage })
  },

  previewStepImage(event) {
    const url = event.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url], current: url })
  },

  addToCart() {
    if (!this.data.canOrder) {
      wx.showToast({ title: '当前菜品不可加购', icon: 'none' })
      return
    }
    const cartItems = helper.addCartItem(this.data.detail)
    this.refreshCartState(cartItems)
    wx.showToast({ title: '已加入', icon: 'success' })
  },

  toggleCart() {
    if (!this.data.detail.id) return
    if (!this.data.canOrder && !this.data.inCart) {
      wx.showToast({ title: '当前菜品不可加购', icon: 'none' })
      return
    }
    const result = helper.toggleCartItem(this.data.detail)
    this.refreshCartState(result.items)
    wx.showToast({ title: result.selected ? '已加入' : '已移除', icon: 'success' })
  },

  goCartConfirm() {
    if (!this.data.cartSummary.count) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pagesEat/eat/dishes/cart-confirm' })
  },

  goEdit() {
    if (!this.data.isOwner) return
    wx.navigateTo({ url: `/pagesEat/eat/dishes/dishes-form?id=${this.data.id}` })
  },

  confirmDelete() {
    if (!this.data.isOwner) return
    wx.showModal({
      content: '确定要删除这个菜品吗？',
      success: async (res) => {
        if (!res.confirm) return
        await eatApi.deleteDishes(this.data.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  },

  isCurrentUserDish(userId) {
    return String(userId || '') === String(this.data.currentUserId || '')
  }
})
