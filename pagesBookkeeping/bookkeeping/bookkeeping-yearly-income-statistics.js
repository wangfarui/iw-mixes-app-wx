const bookkeepingApi = require('../../api/bookkeeping')
const yearly = require('./yearly-statistics-helper')

function emptyIncome() {
  return yearly.formatIncome({}, false)
}

Page({
  data: {
    selectedYear: yearly.currentYear(),
    selectedYearDate: yearly.yearDate(),
    ignoreNotStatistics: false,
    loading: false,
    showAllIncomeCategory: false,
    income: emptyIncome()
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

  toggleIncomeCategory() {
    this.setData({ showAllIncomeCategory: !this.data.showAllIncomeCategory })
    this.fetchData()
  },

  async fetchData() {
    this.setData({ loading: true })
    try {
      const res = await bookkeepingApi.getYearIncomeStatistics(
        yearly.buildParams(this.data.selectedYear, this.data.ignoreNotStatistics)
      )
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
  }
})
