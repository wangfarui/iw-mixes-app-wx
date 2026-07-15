const bookkeepingApi = require('../../api/bookkeeping')
const scopeStore = require('../../stores/family-shared-scope')
const utils = require('../../utils/bookkeeping')

const CHART_COLORS = [
  '#2f7cff',
  '#ff6b35',
  '#07c160',
  '#ffc300',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#64748b',
  '#ec4899',
  '#22c55e'
]

function currentMonth() {
  return utils.formatMonth(new Date())
}

function currentYear() {
  return utils.formatYear(new Date())
}

function toNumber(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function toMoney(value) {
  return utils.formatMoney(value)
}

function buildOwnerText(item, scopeState) {
  return scopeState &&
    scopeState.effectiveScope === 'shared' &&
    item.userName
    ? ` · 来自${item.userName}`
    : ''
}

function normalizeBarValue(value) {
  return toNumber(value)
}

Page({
  data: {
    currentTab: 'month',
    selectedMonth: currentMonth(),
    selectedYear: currentYear(),
    selectedMonthText: '',
    totalAmount: '0.00',
    totalRecordNum: 0,
    ignoreNotStatistics: false,
    compareLastMonth: false,
    tagViewType: 'count',
    categoryHiddenMap: {},
    tagHiddenMap: {},
    categoryList: [],
    categoryLegend: [],
    categoryChartData: [],
    tagList: [],
    displayTagList: [],
    tagLegend: [],
    rankList: [],
    barChartData: [],
    barChartSummary: '暂无趋势数据',
    loading: false
  },

  onLoad() {
    this.syncDateText()
  },

  onReady() {
    this._canvasReady = true
    this.renderCharts()
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
      isSearchAll: this.data.ignoreNotStatistics ? 0 : 1,
      queryOnlyMyself: scopeStore.getQueryOnlyMyself()
    }
  },

  buildCategoryList(source) {
    const rawList = source || []
    return rawList.map((item, index) => {
      const key = `category-${item.recordType == null ? index : item.recordType}`
      const rawAmount = toNumber(item.amount)
      const ratio = utils.percent(item.ratio)
      const color = CHART_COLORS[index % CHART_COLORS.length]
      const lastAmount = item.lastAmount == null ? null : toNumber(item.lastAmount)
      return {
        ...item,
        key,
        name: utils.getRecordTypeName(item.recordType, '其他'),
        rawAmount,
        chartValue: rawAmount,
        amount: toMoney(rawAmount),
        ratio,
        color,
        recordNum: item.recordNum || 0,
        lastAmountText: lastAmount == null ? '' : toMoney(lastAmount),
        isGreaterThan: item.isGreaterThan !== false
      }
    })
  },

  buildTagList(source, tagViewType) {
    const list = (source || []).map((item, index) => {
      const id = item.dictId == null ? (item.tagId == null ? (item.name || index) : item.tagId) : item.dictId
      const count = Number(item.count || item.recordNum || 0)
      const rawAmount = toNumber(item.amount)
      const ratio = utils.percent(item.ratio)
      const amountRatio = utils.percent(item.amountRatio)
      const displayRatio = tagViewType === 'count' ? ratio : amountRatio
      const chartValue = tagViewType === 'count' ? count : rawAmount
      return {
        ...item,
        key: `tag-${id}`,
        name: item.name || item.tagName || utils.getTagName(1, item.tagId || item.dictId) || '未命名',
        count,
        rawAmount,
        amount: toMoney(rawAmount),
        ratio,
        amountRatio,
        displayRatio,
        displayText: tagViewType === 'count' ? `${count}次` : `¥${toMoney(rawAmount)}`,
        chartValue,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }
    })

    return list.sort((a, b) => {
      if (tagViewType === 'count') return b.count - a.count
      return b.rawAmount - a.rawAmount
    })
  },

  applyHiddenState(list, hiddenMap) {
    return (list || []).map((item) => ({
      ...item,
      hidden: Boolean(hiddenMap && hiddenMap[item.key])
    }))
  },

  getVisibleChartData(list) {
    return (list || []).filter((item) => !item.hidden && item.chartValue > 0)
  },

  buildBarChartSummary(values) {
    if (!values.length) return '暂无趋势数据'
    const total = values.reduce((sum, item) => sum + item, 0)
    const max = Math.max(...values)
    const avg = total / values.length
    return `最高 ¥${toMoney(max)} · 平均 ¥${toMoney(avg)}`
  },

  async fetchStatistics() {
    if (this.data.loading) return
    this.setData({ loading: true })
    const params = this.buildParams()
    const scopeState = scopeStore.getScopeState()

    try {
      const [totalRes, categoryRes, rankRes, tagsRes, barRes] = await Promise.all([
        bookkeepingApi.getConsumeTotalStatistics(params),
        bookkeepingApi.getConsumePieChartStatistics({
          ...params,
          isQueryLastMonth: this.data.currentTab === 'month' && this.data.compareLastMonth
        }),
        bookkeepingApi.getConsumeRankStatistics(params),
        bookkeepingApi.getConsumeTagsStatistics(params),
        bookkeepingApi.getConsumeBarChartStatistics(params)
      ])

      const total = totalRes.data || {}
      const categoryList = this.applyHiddenState(
        this.buildCategoryList(categoryRes.data || []),
        this.data.categoryHiddenMap
      )
      const tagList = tagsRes.data || []
      const displayTagList = this.applyHiddenState(
        this.buildTagList(tagList, this.data.tagViewType),
        this.data.tagHiddenMap
      )
      const rankList = (rankRes.data || []).map((item) => ({
        ...item,
        amount: toMoney(item.amount),
        recordTypeName: utils.getRecordTypeName(item.recordType, '其他'),
        ownerText: buildOwnerText(item, scopeState)
      }))
      const barChartData = (barRes.data || []).map(normalizeBarValue)

      this.setData({
        totalAmount: toMoney(total.totalAmount),
        totalRecordNum: total.totalRecordNum || 0,
        categoryList,
        categoryLegend: categoryList.slice(0, 6),
        categoryChartData: this.getVisibleChartData(categoryList),
        tagList,
        displayTagList,
        tagLegend: displayTagList.slice(0, 6),
        rankList,
        barChartData,
        barChartSummary: this.buildBarChartSummary(barChartData)
      }, () => this.renderCharts())
    } catch (error) {
      this.setData({
        totalAmount: '0.00',
        totalRecordNum: 0,
        categoryList: [],
        categoryLegend: [],
        categoryChartData: [],
        tagList: [],
        displayTagList: [],
        tagLegend: [],
        rankList: [],
        barChartData: [],
        barChartSummary: '暂无趋势数据'
      }, () => this.renderCharts())
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(event) {
    const currentTab = event.currentTarget.dataset.tab
    if (currentTab === this.data.currentTab) return
    this.setData({
      currentTab,
      compareLastMonth: false,
      selectedMonth: currentMonth(),
      selectedYear: currentYear()
    })
    this.syncDateText()
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

  switchIgnoreStatistics(event) {
    const hasSwitchValue = event && event.detail && typeof event.detail.value === 'boolean'
    this.setData({
      ignoreNotStatistics: hasSwitchValue ? event.detail.value : !this.data.ignoreNotStatistics
    })
    this.fetchStatistics()
  },

  toggleCompareLastMonth(event) {
    if (this.data.currentTab !== 'month') return
    const hasSwitchValue = event && event.detail && typeof event.detail.value === 'boolean'
    this.setData({
      compareLastMonth: hasSwitchValue ? event.detail.value : !this.data.compareLastMonth
    })
    this.fetchStatistics()
  },

  switchTagViewType(event) {
    const tagViewType = event.currentTarget.dataset.type
    if (!tagViewType || tagViewType === this.data.tagViewType) return
    const displayTagList = this.applyHiddenState(
      this.buildTagList(this.data.tagList, tagViewType),
      this.data.tagHiddenMap
    )
    this.setData({
      tagViewType,
      displayTagList,
      tagLegend: displayTagList.slice(0, 6)
    }, () => this.renderTagPie())
  },

  toggleCategoryLegend(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    const categoryHiddenMap = {
      ...this.data.categoryHiddenMap,
      [key]: !this.data.categoryHiddenMap[key]
    }
    const categoryList = this.applyHiddenState(this.data.categoryList, categoryHiddenMap)
    this.setData({
      categoryHiddenMap,
      categoryList,
      categoryLegend: categoryList.slice(0, 6),
      categoryChartData: this.getVisibleChartData(categoryList)
    }, () => this.renderCategoryPie())
  },

  toggleTagLegend(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    const tagHiddenMap = {
      ...this.data.tagHiddenMap,
      [key]: !this.data.tagHiddenMap[key]
    }
    const displayTagList = this.applyHiddenState(this.data.displayTagList, tagHiddenMap)
    this.setData({
      tagHiddenMap,
      displayTagList,
      tagLegend: displayTagList.slice(0, 6)
    }, () => this.renderTagPie())
  },

  goToRecords(event) {
    const recordType = event.currentTarget.dataset.recordType
    let url = `/pagesBookkeeping/bookkeeping/bookkeeping-records?recordType=${recordType}&ignoreNotStatistics=${this.data.ignoreNotStatistics}&recordCategory=1`
    if (this.data.currentTab === 'month') {
      url += `&recordDate=${this.data.selectedMonth}`
    } else {
      url += `&recordYear=${this.data.selectedYear}`
    }
    wx.navigateTo({ url })
  },

  goToDetail(event) {
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  renderCharts() {
    if (!this._canvasReady) return
    this.renderCategoryPie()
    this.renderTagPie()
    this.renderBarChart()
  },

  renderCategoryPie() {
    this.drawPieChart('categoryPieCanvas', this.data.categoryChartData, {
      label: '分类',
      subLabel: `${this.data.categoryChartData.length}项`
    })
  },

  renderTagPie() {
    const visibleList = this.getVisibleChartData(this.data.displayTagList)
    this.drawPieChart('tagPieCanvas', visibleList, {
      label: this.data.tagViewType === 'count' ? '次数' : '金额',
      subLabel: `${visibleList.length}项`
    })
  },

  drawPieChart(canvasId, list, center) {
    const query = wx.createSelectorQuery().in(this)
    query.select(`#${canvasId}`).boundingClientRect((rect) => {
      if (!rect || !rect.width || !rect.height) return
      const width = rect.width
      const height = rect.height
      const ctx = wx.createCanvasContext(canvasId, this)
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) / 2 - 8
      const innerRadius = radius * 0.58
      const total = list.reduce((sum, item) => sum + toNumber(item.chartValue), 0)

      ctx.clearRect(0, 0, width, height)
      ctx.setFillStyle('#edf1f7')
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      if (total > 0) {
        let start = -Math.PI / 2
        list.forEach((item, index) => {
          const value = toNumber(item.chartValue)
          if (value <= 0) return
          const angle = (value / total) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, radius, start, start + angle)
          ctx.closePath()
          ctx.setFillStyle(item.color || CHART_COLORS[index % CHART_COLORS.length])
          ctx.fill()
          start += angle
        })
      }

      ctx.setFillStyle('#ffffff')
      ctx.beginPath()
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.setTextAlign('center')
      ctx.setFillStyle('#1f2329')
      ctx.setFontSize(13)
      ctx.fillText(center.label, cx, cy - 2)
      ctx.setFillStyle('#8a8f98')
      ctx.setFontSize(11)
      ctx.fillText(center.subLabel, cx, cy + 16)
      ctx.draw()
    }).exec()
  },

  renderBarChart() {
    if (!this._canvasReady) return
    const query = wx.createSelectorQuery().in(this)
    query.select('#consumeBarCanvas').boundingClientRect((rect) => {
      if (!rect || !rect.width || !rect.height) return
      const values = this.data.barChartData || []
      const width = rect.width
      const height = rect.height
      const ctx = wx.createCanvasContext('consumeBarCanvas', this)
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
        ctx.setFillStyle(isMax ? '#ff6b35' : '#2f7cff')
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
        const y = top + chartHeight - (max / max) * chartHeight
        ctx.setTextAlign('center')
        ctx.setFillStyle('#ff6b35')
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
