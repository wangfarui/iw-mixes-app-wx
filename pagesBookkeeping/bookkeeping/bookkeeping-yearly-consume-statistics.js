const bookkeepingApi = require('../../api/bookkeeping')
const yearly = require('./yearly-statistics-helper')

function emptyConsume(tagViewType) {
  return yearly.formatConsume({}, false, false, tagViewType || 'count')
}

Page({
  data: {
    selectedYear: yearly.currentYear(),
    selectedYearDate: yearly.yearDate(),
    ignoreNotStatistics: false,
    loading: false,
    showAllCategory: false,
    showAllTags: false,
    tagViewType: 'count',
    tagViewTypeText: '按次数',
    consume: emptyConsume('count')
  },

  onLoad(options = {}) {
    const selectedYear = yearly.normalizeYear(options.year)
    this.setData({
      selectedYear,
      selectedYearDate: yearly.yearDate(selectedYear)
    })
  },

  onShow() {
    this.fetchData()
  },

  onPullDownRefresh() {
    this.fetchData().finally(() => wx.stopPullDownRefresh())
  },

  onYearChange(event) {
    const selectedYear = yearly.normalizeYear(event.detail.value)
    this.setData({
      selectedYear,
      selectedYearDate: yearly.yearDate(selectedYear)
    })
    this.fetchData()
  },

  switchIgnoreStatistics(event) {
    this.setData({ ignoreNotStatistics: Boolean(event.detail.value) })
    this.fetchData()
  },

  switchTagViewType() {
    const tagViewType = this.data.tagViewType === 'count' ? 'amount' : 'count'
    this.setData({
      tagViewType,
      tagViewTypeText: tagViewType === 'count' ? '按次数' : '按金额'
    })
    this.fetchData()
  },

  toggleCategory() {
    this.setData({ showAllCategory: !this.data.showAllCategory })
    this.fetchData()
  },

  toggleTags() {
    this.setData({ showAllTags: !this.data.showAllTags })
    this.fetchData()
  },

  async fetchData() {
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearConsumeStatistics(
        yearly.buildParams(this.data.selectedYear, this.data.ignoreNotStatistics)
      )
      this.setData({
        consume: yearly.formatConsume(
          res.data || {},
          this.data.showAllCategory,
          this.data.showAllTags,
          this.data.tagViewType
        )
      })
    } catch (error) {
      this.setData({ consume: emptyConsume(this.data.tagViewType) })
    } finally {
      this.setData({ loading: false })
    }
  },

  goToDetail(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-detail?id=${id}`
    })
  }
})
