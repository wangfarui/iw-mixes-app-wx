const bookkeepingApi = require('../../api/bookkeeping')
const yearly = require('./yearly-statistics-helper')

function emptyOverview() {
  return yearly.formatOverview({})
}

function emptyConsume(tagViewType) {
  return yearly.formatConsume({}, false, false, tagViewType || 'count')
}

function emptyIncome() {
  return yearly.formatIncome({}, false)
}

Page({
  data: {
    selectedYear: yearly.currentYear(),
    selectedYearDate: yearly.yearDate(),
    currentTab: 'overview',
    ignoreNotStatistics: false,
    loading: false,
    showAllCategory: false,
    showAllTags: false,
    showAllIncomeCategory: false,
    tagViewType: 'count',
    tagViewTypeText: '按次数',
    overview: emptyOverview(),
    consume: emptyConsume('count'),
    income: emptyIncome()
  },

  onLoad(options = {}) {
    const selectedYear = yearly.normalizeYear(options.year)
    const currentTab = ['overview', 'consume', 'income'].includes(options.tab) ? options.tab : 'overview'
    this.setData({
      selectedYear,
      selectedYearDate: yearly.yearDate(selectedYear),
      currentTab
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

  switchTab(event) {
    const currentTab = event.currentTarget.dataset.tab
    if (currentTab === this.data.currentTab) return
    this.setData({ currentTab })
    this.fetchData()
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
    this.fetchConsume()
  },

  toggleCategory() {
    this.setData({ showAllCategory: !this.data.showAllCategory })
    this.fetchConsume()
  },

  toggleTags() {
    this.setData({ showAllTags: !this.data.showAllTags })
    this.fetchConsume()
  },

  toggleIncomeCategory() {
    this.setData({ showAllIncomeCategory: !this.data.showAllIncomeCategory })
    this.fetchIncome()
  },

  async fetchData() {
    if (this.data.currentTab === 'consume') return this.fetchConsume()
    if (this.data.currentTab === 'income') return this.fetchIncome()
    return this.fetchOverview()
  },

  buildParams() {
    return yearly.buildParams(this.data.selectedYear, this.data.ignoreNotStatistics)
  },

  async fetchOverview() {
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearOverviewStatistics(this.buildParams())
      this.setData({ overview: yearly.formatOverview(res.data || {}) }, () => this.renderTrendChart())
    } catch (error) {
      this.setData({ overview: emptyOverview() }, () => this.renderTrendChart())
    } finally {
      this.setData({ loading: false })
    }
  },

  async fetchConsume() {
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearConsumeStatistics(this.buildParams())
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

  async fetchIncome() {
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearIncomeStatistics(this.buildParams())
      this.setData({
        income: yearly.formatIncome(res.data || {}, this.data.showAllIncomeCategory)
      })
    } catch (error) {
      this.setData({ income: emptyIncome() })
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
  },

  renderTrendChart() {
    if (this.data.currentTab !== 'overview') return
    yearly.drawTrendChart(this, 'yearTrendCanvas', this.data.overview.trendChart)
  }
})
