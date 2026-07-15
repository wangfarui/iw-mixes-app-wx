const eatApi = require('../../../api/eat')
const dictStore = require('../../../stores/dict')
const helper = require('../eat-helper')

Page({
  data: {
    categories: [],
    currentType: '',
    dishesName: '',
    list: [],
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多',
    cartItems: [],
    cartCount: 0,
    cartSummary: helper.calcCartSummary([]),
    showCartDrawer: false
  },

  onShow() {
    this.refreshCategories()
    this.refreshCart()
    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchDishes(false)
  },

  refreshCategories() {
    this.setData({
      categories: helper.optionList(dictStore.dictTypeEnum.EAT_DISHES_TYPE, '全部')
    })
  },

  async initPage() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    await this.fetchDishes(true)
  },

  async fetchDishes(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await eatApi.getDishesPage({
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize,
        dishesType: this.data.currentType || 0,
        dishesName: this.data.dishesName
      })
      const rows = this.formatDishesRows((res.data && res.data.records) || [])
      const list = reset ? rows : this.data.list.concat(rows)
      const total = (res.data && res.data.total) || list.length
      this.setData({
        list,
        hasMore: list.length < total,
        loadMoreText: list.length < total ? '加载更多' : (list.length ? '没有更多菜品了' : '暂无数据')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.list.length ? '加载更多' : '暂无数据' })
    } finally {
      this.setData({ loading: false })
    }
  },

  formatDishesRows(rows) {
    const cartIds = new Set(this.data.cartItems.map((item) => String(item.id)))
    return rows.map((item) => {
      const dish = helper.formatDish(item)
      return {
        ...dish,
        imageLoadError: false,
        canOrder: Number(dish.status || 1) === 1,
        inCart: cartIds.has(String(dish.id))
      }
    })
  },

  refreshCart(cartItems) {
    const items = cartItems || helper.getCartItems()
    const summary = helper.calcCartSummary(items)
    const cartIds = new Set(items.map((item) => String(item.id)))
    const nextData = {
      cartItems: items,
      cartCount: summary.count,
      cartSummary: summary,
      list: this.data.list.map((item) => ({
        ...item,
        inCart: cartIds.has(String(item.id))
      }))
    }
    if (!summary.count) {
      nextData.showCartDrawer = false
    }
    this.setData(nextData)
  },

  onSearchInput(event) {
    this.setData({ dishesName: event.detail.value })
  },

  clearSearch() {
    if (!this.data.dishesName) return
    this.setData({ dishesName: '' })
    this.initPage()
  },

  onDishImageError(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    this.setData({ [`list[${index}].imageLoadError`]: true })
  },

  selectCategory(event) {
    const currentType = event.currentTarget.dataset.value
    if (currentType === this.data.currentType) return
    this.setData({ currentType })
    this.initPage()
  },

  goDetail(event) {
    if (this.data.showCartDrawer) {
      this.setData({ showCartDrawer: false })
    }
    wx.navigateTo({ url: `/pagesEat/eat/dishes/dishes-detail?id=${event.currentTarget.dataset.id}&mode=order` })
  },

  toggleCart(event) {
    const item = this.data.list[Number(event.currentTarget.dataset.index)]
    if (!item) return
    if (!item.canOrder && !item.inCart) {
      wx.showToast({ title: '当前菜品不可加购', icon: 'none' })
      return
    }
    const result = helper.toggleCartItem(item)
    this.refreshCart(result.items)
    wx.showToast({ title: result.selected ? '已加入' : '已移除', icon: 'success' })
  },

  removeCartItem(event) {
    const cartItems = helper.removeCartItem(event.currentTarget.dataset.id)
    this.refreshCart(cartItems)
  },

  clearCart() {
    if (!this.data.cartItems.length) return
    wx.showModal({
      content: '确定清空购物车吗？',
      success: (res) => {
        if (!res.confirm) return
        this.refreshCart(helper.clearCartItems())
        this.setData({ showCartDrawer: false })
      }
    })
  },

  openCartDrawer() {
    if (!this.data.cartItems.length) return
    this.setData({ showCartDrawer: true })
  },

  closeCartDrawer() {
    this.setData({ showCartDrawer: false })
  },

  noop() {
  },

  goCartConfirm() {
    if (!this.data.cartItems.length) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pagesEat/eat/dishes/cart-confirm' })
  }
})
