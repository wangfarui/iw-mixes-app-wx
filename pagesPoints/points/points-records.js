const pointsApi = require('../../api/points')

function formatRecord(item) {
  const points = Number(item.points || 0)
  return {
    ...item,
    points,
    pointsText: `${points > 0 ? '+' : ''}${points}`
  }
}

Page({
  data: {
    totalPoints: 0,
    statistics: {},
    list: [],
    rangeStart: '',
    rangeEnd: '',
    showCurrentMonth: true,
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多'
  },

  onShow() {
    this.refreshAll()
  },

  onPullDownRefresh() {
    this.refreshAll().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchPage(false)
  },

  async refreshAll() {
    await this.fetchBalance()
    this.resetPage()
    await Promise.all([this.fetchStatistics(), this.fetchPage(true)])
  },

  resetPage() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
  },

  buildParams() {
    return {
      createStartTime: this.data.rangeStart,
      createEndTime: this.data.rangeEnd,
      currentPage: this.data.currentPage,
      pageSize: this.data.pageSize
    }
  },

  async fetchBalance() {
    try {
      const res = await pointsApi.getPointsBalance()
      this.setData({ totalPoints: res.data || 0 })
    } catch (error) {
      this.setData({ totalPoints: 0 })
    }
  },

  async fetchStatistics() {
    try {
      const res = await pointsApi.getPointsRecordStatistics(this.buildParams())
      this.setData({ statistics: res.data || {} })
    } catch (error) {
      this.setData({ statistics: {} })
    }
  },

  async fetchPage(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await pointsApi.getPointsRecordPage(this.buildParams())
      const rows = ((res.data && res.data.records) || []).map(formatRecord)
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

  onStartDateChange(event) {
    this.setData({ rangeStart: event.detail.value, showCurrentMonth: false })
    this.refreshAll()
  },

  onEndDateChange(event) {
    this.setData({ rangeEnd: event.detail.value, showCurrentMonth: false })
    this.refreshAll()
  },

  resetRange() {
    this.setData({
      rangeStart: '',
      rangeEnd: '',
      showCurrentMonth: true
    })
    this.refreshAll()
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pagesPoints/points/points-detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
