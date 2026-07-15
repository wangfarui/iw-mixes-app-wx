const eatApi = require('../../../api/eat')
const helper = require('../eat-helper')

Page({
  data: {
    mealDate: '',
    list: [],
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多'
  },

  onShow() {
    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchMeal(false)
  },

  async initPage() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    await this.fetchMeal(true)
  },

  async fetchMeal(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await eatApi.getMealPage({
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize,
        mealDate: this.data.mealDate || null
      })
      const rows = ((res.data && res.data.records) || []).map(helper.formatMeal)
      const list = reset ? rows : this.data.list.concat(rows)
      const total = (res.data && res.data.total) || list.length
      this.setData({
        list,
        hasMore: list.length < total,
        loadMoreText: list.length < total ? '加载更多' : (list.length ? '没有更多了' : '暂无数据')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.list.length ? '加载更多' : '暂无数据' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onMealDateChange(event) {
    this.setData({ mealDate: event.detail.value })
    this.initPage()
  },

  resetDate() {
    this.setData({ mealDate: '' })
    this.initPage()
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pagesEat/eat/meal/meal-detail?id=${event.currentTarget.dataset.id}` })
  }
})
