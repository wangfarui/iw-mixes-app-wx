const eatApi = require('../../../api/eat')
const dictStore = require('../../../stores/dict')
const sessionStore = require('../../../stores/session')
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
    currentUserId: ''
  },

  onShow() {
    this.refreshCurrentUser()
    this.refreshCategories()
    this.initPage()
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchDishes(false)
  },

  refreshCategories() {
    this.setData({ categories: helper.optionList(dictStore.dictTypeEnum.EAT_DISHES_TYPE, '全部') })
  },

  refreshCurrentUser() {
    const userInfo = sessionStore.getUserInfo() || {}
    this.setData({ currentUserId: userInfo.id || '' })
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
      const rows = ((res.data && res.data.records) || []).map((item) => ({
        ...helper.formatDish(item),
        imageLoadError: false,
        isOwner: this.isCurrentUserDish(item.userId)
      }))
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

  onSearchInput(event) {
    this.setData({ dishesName: event.detail.value })
  },

  onDishImageError(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    this.setData({ [`list[${index}].imageLoadError`]: true })
  },

  selectCategory(event) {
    this.setData({ currentType: event.currentTarget.dataset.value })
    this.initPage()
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pagesEat/eat/dishes/dishes-detail?id=${event.currentTarget.dataset.id}` })
  },

  openActions(event) {
    const item = this.data.list[Number(event.currentTarget.dataset.index)]
    if (!item) return
    if (!item.isOwner) {
      return
    }
    wx.showActionSheet({
      itemList: ['编辑菜品', '删除菜品'],
      success: (res) => {
        if (res.tapIndex === 0) wx.navigateTo({ url: `/pagesEat/eat/dishes/dishes-form?id=${item.id}` })
        if (res.tapIndex === 1) this.deleteDish(item)
      }
    })
  },

  deleteDish(item) {
    wx.showModal({
      content: '确定要删除这个菜品吗？',
      success: async (res) => {
        if (!res.confirm) return
        await eatApi.deleteDishes(item.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.initPage()
      }
    })
  },

  goAdd() {
    wx.navigateTo({ url: '/pagesEat/eat/dishes/dishes-form' })
  },

  isCurrentUserDish(userId) {
    return String(userId || '') === String(this.data.currentUserId || '')
  }
})
