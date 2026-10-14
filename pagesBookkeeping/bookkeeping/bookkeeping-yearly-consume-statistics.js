const familyStore = require('../../stores/family')
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
    const requestId = (this._statisticsRequest || 0) + 1
    this._statisticsRequest = requestId
    try { await familyStore.ensureMyGroupLoaded() } catch (error) { return }
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearConsumeStatistics(
        yearly.buildParams(this.data.selectedYear, this.data.ignoreNotStatistics)
      )
      if (requestId !== this._statisticsRequest) return
      this.setData({
        consume: yearly.formatConsume(
          res.data || {},
          this.data.showAllCategory,
          this.data.showAllTags,
          this.data.tagViewType
        )
      })
    } catch (error) {
      if (requestId !== this._statisticsRequest) return
      this.setData({ consume: emptyConsume(this.data.tagViewType) })
    } finally {
      if (requestId === this._statisticsRequest) this.setData({ loading: false })
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
