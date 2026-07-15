const bookkeepingApi = require('../../api/bookkeeping')
const scopeStore = require('../../stores/family-shared-scope')
const utils = require('../../utils/bookkeeping')

function currentMonth() {
  return utils.formatMonth(new Date())
}

function currentYear() {
  return utils.formatYear(new Date())
}

function toMoney(value) {
  return utils.formatMoney(value)
}

function toNumber(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function buildOwnerText(item, scopeState) {
  return scopeState &&
    scopeState.effectiveScope === 'shared' &&
    item.userName
    ? ` · 来自${item.userName}`
    : ''
}

Page({
  data: {
    currentTab: 'month',
    selectedMonth: currentMonth(),
    selectedYear: currentYear(),
    selectedMonthText: '',
    totalAmount: '0.00',
    totalRecordNum: 0,
    barChartData: [],
    barChartSummary: '暂无趋势数据',
    rankList: [],
    loading: false
  },

  onLoad() {
    this.syncDateText()
  },

  onReady() {
    this._canvasReady = true
    this.renderBarChart()
  },

  onShow() {
    this.fetchStatistics()
  },

  syncDateText() {
    const [year, month] = this.data.selectedMonth.split('-')
    this.setData({ selectedMonthText: `${year}年${month}月` })
  },

  buildParams() {
    return {
      currentMonth: this.data.currentTab === 'month'
        ? utils.monthStart(this.data.selectedMonth)
        : `${this.data.selectedYear}-01-01`,
      statisticsType: this.data.currentTab === 'month' ? 1 : 2,
      limit: 10,
      queryOnlyMyself: scopeStore.getQueryOnlyMyself()
    }
  },

  buildBarChartSummary(values) {
    const max = Math.max(...values, 0)
    if (!values.length || max <= 0) return '暂无趋势数据'
    const total = values.reduce((sum, item) => sum + item, 0)
    const avg = total / values.length
    return `最高 ¥${toMoney(max)} · 平均 ¥${toMoney(avg)}`
  },

  async fetchStatistics() {
    if (this.data.loading) return
    this.setData({ loading: true })
    const params = this.buildParams()
    const scopeState = scopeStore.getScopeState()

    try {
      const [totalRes, chartRes, rankRes] = await Promise.all([
        bookkeepingApi.getIncomeTotalStatistics(params),
        bookkeepingApi.getIncomeChartStatistics(params),
        bookkeepingApi.getIncomeRankStatistics(params)
      ])

      const total = totalRes.data || {}
      const barChartData = (chartRes.data || []).map(toNumber)
      const rankList = (rankRes.data || []).map((item) => ({
        ...item,
        amount: toMoney(item.amount),
        recordTypeName: utils.getRecordTypeName(item.recordType, '收入'),
        ownerText: buildOwnerText(item, scopeState)
      }))

      this.setData({
        totalAmount: toMoney(total.totalAmount),
        totalRecordNum: total.totalRecordNum || 0,
        barChartData,
        barChartSummary: this.buildBarChartSummary(barChartData),
        rankList
      }, () => this.renderBarChart())
    } catch (error) {
      this.setData({
        totalAmount: '0.00',
        totalRecordNum: 0,
        barChartData: [],
        barChartSummary: '暂无趋势数据',
        rankList: []
      }, () => this.renderBarChart())
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(event) {
    const currentTab = event.currentTarget.dataset.tab
    if (currentTab === this.data.currentTab) return
    this.setData({ currentTab })
    this.fetchStatistics()
  },

  onMonthChange(event) {
    this.setData({ selectedMonth: event.detail.value })
    this.syncDateText()
    this.fetchStatistics()
  },

  onYearChange(event) {
    this.setData({ selectedYear: event.detail.value.split('-')[0] })
    this.fetchStatistics()
  },

  goToDetail(event) {
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  renderBarChart() {
    if (!this._canvasReady) return
    const query = wx.createSelectorQuery().in(this)
    query.select('#incomeBarCanvas').boundingClientRect((rect) => {
      if (!rect || !rect.width || !rect.height) return
      const values = this.data.barChartData || []
      const width = rect.width
      const height = rect.height
      const ctx = wx.createCanvasContext('incomeBarCanvas', this)
      const left = 38
      const right = 12
      const top = 24
      const bottom = 30
      const chartWidth = width - left - right
      const chartHeight = height - top - bottom
      const max = Math.max(...values, 0)
      const maxIndex = values.indexOf(max)

      ctx.clearRect(0, 0, width, height)
      ctx.setStrokeStyle('#edf0f5')
      ctx.setLineWidth(1)
      ctx.setFontSize(10)
      ctx.setFillStyle('#9aa1ad')
      ctx.setTextAlign('right')

      for (let i = 0; i <= 3; i++) {
        const y = top + chartHeight * (i / 3)
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(width - right, y)
        ctx.stroke()
        const labelValue = max * (1 - i / 3)
        ctx.fillText(this.formatAxisAmount(labelValue), left - 6, y + 3)
      }

      if (!values.length || max <= 0) {
        ctx.setTextAlign('center')
        ctx.setFillStyle('#a0a5ad')
        ctx.setFontSize(13)
        ctx.fillText('暂无趋势数据', width / 2, height / 2)
        ctx.draw()
        return
      }

      const step = chartWidth / values.length
      const barWidth = Math.max(3, Math.min(14, step * 0.56))
      values.forEach((value, index) => {
        const barHeight = Math.max(2, (value / max) * chartHeight)
        const x = left + index * step + (step - barWidth) / 2
        const y = top + chartHeight - barHeight
        const isMax = index === maxIndex
        ctx.setFillStyle(isMax ? '#07c160' : '#2f7cff')
        ctx.fillRect(x, y, barWidth, barHeight)

        const labelValue = index + 1
        const shouldShowLabel = this.data.currentTab === 'year'
          ? true
          : labelValue === 1 || labelValue === values.length || (labelValue % 5 === 0 && values.length - labelValue > 1)
        if (shouldShowLabel) {
          ctx.setFillStyle('#8a8f98')
          ctx.setFontSize(10)
          ctx.setTextAlign('center')
          ctx.fillText(String(labelValue), x + barWidth / 2, height - 10)
        }
      })

      if (maxIndex >= 0) {
        const x = left + maxIndex * step + step / 2
        const y = top + chartHeight - chartHeight
        ctx.setTextAlign('center')
        ctx.setFillStyle('#07c160')
        ctx.setFontSize(11)
        ctx.fillText(`¥${this.formatAxisAmount(max)}`, x, Math.max(12, y - 6))
      }
      ctx.draw()
    }).exec()
  },

  formatAxisAmount(value) {
    const amount = toNumber(value)
    if (amount >= 10000) return `${Number((amount / 10000).toFixed(1))}w`
    if (amount >= 1000) return `${Number((amount / 1000).toFixed(1))}k`
    return String(Math.round(amount))
  }
})
