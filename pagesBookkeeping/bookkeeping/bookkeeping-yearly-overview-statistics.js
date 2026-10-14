const familyStore = require('../../stores/family')
const bookkeepingApi = require('../../api/bookkeeping')
const yearly = require('./yearly-statistics-helper')

function emptyOverview() {
  return yearly.formatOverview({})
}

Page({
  data: {
    selectedYear: yearly.currentYear(),
    selectedYearDate: yearly.yearDate(),
    ignoreNotStatistics: false,
    loading: false,
    overview: emptyOverview()
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

  onReady() {
    this._canvasReady = true
    this.renderTrendChart()
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

  async fetchData() {
    const requestId = (this._statisticsRequest || 0) + 1
    this._statisticsRequest = requestId
    try { await familyStore.ensureMyGroupLoaded() } catch (error) { return }
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearOverviewStatistics(
        yearly.buildParams(this.data.selectedYear, this.data.ignoreNotStatistics)
      )
      if (requestId !== this._statisticsRequest) return
      this.setData({ overview: yearly.formatOverview(res.data || {}) }, () => this.renderTrendChart())
    } catch (error) {
      if (requestId !== this._statisticsRequest) return
      this.setData({ overview: emptyOverview() }, () => this.renderTrendChart())
    } finally {
      if (requestId === this._statisticsRequest) this.setData({ loading: false })
    }
  },

  renderTrendChart() {
    yearly.drawTrendChart(this, 'yearOverviewTrendCanvas', this.data.overview.trendChart)
  }
})
