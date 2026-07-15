const utils = require('../../utils/bookkeeping')
const scopeStore = require('../../stores/family-shared-scope')

const colors = ['#5470c6', '#07c160', '#ff6b35', '#1989fa', '#ff976a', '#9a60b4', '#00b578', '#ee6666']
const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const trendSeriesColors = {
  consume: '#ff6b35',
  income: '#07c160',
  net: '#2f7cff',
  negative: '#f04438'
}

function currentYear() {
  return utils.formatYear(new Date())
}

function yearDate(year) {
  return `${year || currentYear()}-01-01`
}

function normalizeYear(value) {
  if (!value) return currentYear()
  return String(value).replace('年', '').split('-')[0]
}

function toMoney(value) {
  return utils.formatMoney(value)
}

function toNumber(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function toInt(value) {
  return parseInt(value || 0, 10) || 0
}

function buildParams(year, ignoreNotStatistics) {
  return {
    year: parseInt(normalizeYear(year), 10),
    ignoreNotStatistics: ignoreNotStatistics ? 0 : 1,
    queryOnlyMyself: scopeStore.getQueryOnlyMyself()
  }
}

function formatRatio(value) {
  return utils.percent(value)
}

function fillMonths(values, color) {
  const source = Array.isArray(values) ? values : []
  const max = Math.max(...source.map(toNumber), 0)
  return monthNames.map((month, index) => {
    const amount = toNumber(source[index])
    return {
      month,
      amount: toMoney(amount),
      rawAmount: amount,
      ratio: max > 0 ? Math.max(4, Math.round((amount / max) * 100)) : 0,
      color: color || colors[index % colors.length]
    }
  })
}

function readMonthlyValues(values) {
  const source = Array.isArray(values) ? values : []
  return monthNames.map((_, index) => toNumber(source[index]))
}

function buildTrendChart(monthlyData, yearStatistics) {
  const consumeValues = readMonthlyValues(monthlyData.consumeTrendData)
  const incomeValues = readMonthlyValues(monthlyData.incomeTrendData)
  const netValues = readMonthlyValues(monthlyData.netIncomeTrendData)
  const hasData = consumeValues.concat(incomeValues, netValues).some((value) => value !== 0)
  const negativeMonths = netValues
    .map((value, index) => value < 0 ? monthNames[index] : '')
    .filter(Boolean)
  const netIncome = toNumber(yearStatistics.netIncome)
  const netPrefix = netIncome >= 0 ? '+' : '-'

  return {
    months: monthNames,
    consumeValues,
    incomeValues,
    netValues,
    hasData,
    negativeMonths,
    negativeMonthsText: negativeMonths.join('、'),
    summary: hasData
      ? `全年净收入 ${netPrefix}¥${toMoney(Math.abs(netIncome))} · 负净收入 ${negativeMonths.length} 个月`
      : '暂无趋势数据'
  }
}

function formatOverview(data) {
  const yearStatistics = data.yearStatistics || {}
  const monthlyData = data.monthlyData || {}
  const recordingHabits = data.recordingHabits || {}
  return {
    yearStatistics: {
      totalConsume: toMoney(yearStatistics.totalConsume),
      consumeCount: toInt(yearStatistics.consumeCount),
      totalIncome: toMoney(yearStatistics.totalIncome),
      incomeCount: toInt(yearStatistics.incomeCount),
      netIncome: toMoney(Math.abs(toNumber(yearStatistics.netIncome))),
      netIncomeRaw: toNumber(yearStatistics.netIncome),
      netIncomePrefix: toNumber(yearStatistics.netIncome) >= 0 ? '+' : '-'
    },
    trendChart: buildTrendChart(monthlyData, yearStatistics),
    trendList: monthNames.map((month, index) => {
      const consume = toNumber((monthlyData.consumeTrendData || [])[index])
      const income = toNumber((monthlyData.incomeTrendData || [])[index])
      const net = toNumber((monthlyData.netIncomeTrendData || [])[index])
      const max = Math.max(consume, income, Math.abs(net), 0)
      return {
        month,
        consume: toMoney(consume),
        income: toMoney(income),
        net: toMoney(Math.abs(net)),
        netRaw: net,
        consumeRatio: max > 0 ? Math.max(4, Math.round((consume / max) * 100)) : 0,
        incomeRatio: max > 0 ? Math.max(4, Math.round((income / max) * 100)) : 0,
        netRatio: max > 0 ? Math.max(4, Math.round((Math.abs(net) / max) * 100)) : 0
      }
    }),
    recordingHabits: {
      recordingDays: toInt(recordingHabits.recordingDays),
      maxContinuousDays: toInt(recordingHabits.maxContinuousDays),
      maxContinuousStartDate: recordingHabits.maxContinuousStartDate || '',
      maxContinuousEndDate: recordingHabits.maxContinuousEndDate || '',
      peakMonth: recordingHabits.peakMonth || '-',
      peakCount: toInt(recordingHabits.peakCount),
      missingCount: toInt(recordingHabits.missingCount),
      missingRate: toMoney(recordingHabits.missingRate),
      recordingCount: toInt(recordingHabits.recordingCount),
      avgPerDay: toMoney(recordingHabits.avgPerDay),
      evaluation: recordingHabits.evaluation || '暂无评价'
    }
  }
}

function formatAxisAmount(value) {
  const amount = Math.abs(toNumber(value))
  if (amount >= 10000) return `${Number((amount / 10000).toFixed(1))}w`
  if (amount >= 1000) return `${Number((amount / 1000).toFixed(1))}k`
  return String(Math.round(amount))
}

function drawSmoothLine(ctx, points) {
  if (!points.length) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  if (points.length === 1) {
    ctx.lineTo(points[0].x + 1, points[0].y)
    return
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const midX = (previous.x + current.x) / 2
    const midY = (previous.y + current.y) / 2
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
}

function drawTrendChart(page, canvasId, trendChart) {
  if (!page || !page._canvasReady) return
  const chart = trendChart || buildTrendChart({}, {})
  const query = wx.createSelectorQuery().in(page)
  query.select(`#${canvasId}`).boundingClientRect((rect) => {
    if (!rect || !rect.width || !rect.height) return
    const width = rect.width
    const height = rect.height
    const ctx = wx.createCanvasContext(canvasId, page)
    const left = 46
    const right = 14
    const top = 26
    const bottom = 34
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const months = chart.months || monthNames
    const consumeValues = chart.consumeValues || []
    const incomeValues = chart.incomeValues || []
    const netValues = chart.netValues || []
    const allValues = consumeValues.concat(incomeValues, netValues)
    const max = Math.max(...allValues, 0)
    const min = Math.min(...allValues, 0)
    const range = max === min ? 1 : max - min
    const step = months.length > 1 ? chartWidth / (months.length - 1) : chartWidth
    const yOf = (value) => top + ((max - value) / range) * chartHeight
    const xOf = (index) => left + step * index

    ctx.clearRect(0, 0, width, height)
    ctx.setLineWidth(1)
    ctx.setStrokeStyle('#edf0f5')
    ctx.setFillStyle('#9aa1ad')
    ctx.setFontSize(10)
    ctx.setTextAlign('right')

    for (let index = 0; index <= 4; index += 1) {
      const value = max - range * (index / 4)
      const y = top + chartHeight * (index / 4)
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(width - right, y)
      ctx.stroke()
      const prefix = value < 0 ? '-' : ''
      ctx.fillText(`${prefix}${formatAxisAmount(value)}`, left - 6, y + 3)
    }

    const zeroY = yOf(0)
    ctx.setStrokeStyle('#c9d1df')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(left, zeroY)
    ctx.lineTo(width - right, zeroY)
    ctx.stroke()

    if (!chart.hasData) {
      ctx.setTextAlign('center')
      ctx.setFillStyle('#a0a5ad')
      ctx.setFontSize(13)
      ctx.fillText('暂无趋势数据', width / 2, height / 2)
      ctx.draw()
      return
    }

    const drawSeries = (values, color, widthValue) => {
      const points = values.map((value, index) => ({ x: xOf(index), y: yOf(value), value }))
      ctx.setStrokeStyle(color)
      ctx.setLineWidth(widthValue || 2)
      drawSmoothLine(ctx, points)
      ctx.stroke()
      points.forEach((point) => {
        ctx.setFillStyle('#ffffff')
        ctx.beginPath()
        ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.setFillStyle(color)
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    drawSeries(consumeValues, trendSeriesColors.consume, 2)
    drawSeries(incomeValues, trendSeriesColors.income, 2)

    const netPoints = netValues.map((value, index) => ({ x: xOf(index), y: yOf(value), value }))
    ctx.setStrokeStyle(trendSeriesColors.net)
    ctx.setLineWidth(2.4)
    drawSmoothLine(ctx, netPoints)
    ctx.stroke()
    netPoints.forEach((point) => {
      const isNegative = point.value < 0
      const color = isNegative ? trendSeriesColors.negative : trendSeriesColors.net
      ctx.setFillStyle('#ffffff')
      ctx.beginPath()
      ctx.arc(point.x, point.y, isNegative ? 5 : 3.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.setFillStyle(color)
      ctx.beginPath()
      ctx.arc(point.x, point.y, isNegative ? 3.5 : 2.6, 0, Math.PI * 2)
      ctx.fill()
    })

    months.forEach((month, index) => {
      const shortMonth = month.replace('月', '')
      ctx.setTextAlign('center')
      ctx.setFontSize(10)
      ctx.setFillStyle(netValues[index] < 0 ? trendSeriesColors.negative : '#8a8f98')
      ctx.fillText(shortMonth, xOf(index), height - 10)
    })

    ctx.draw()
  }).exec()
}

function formatConsume(data, showAllCategory, showAllTags, tagViewType) {
  const yearStatistics = data.yearStatistics || {}
  const categories = (data.consumeCategories || []).map((item, index) => ({
    ...item,
    name: item.name || '其他',
    amount: toMoney(item.amount),
    ratio: formatRatio(item.ratio),
    color: colors[index % colors.length]
  }))
  const sortedTags = (data.consumeTags || []).map((item, index) => ({
    ...item,
    name: item.name || '未命名',
    count: toInt(item.count),
    amount: toMoney(item.amount),
    ratio: formatRatio(item.ratio),
    amountRatio: formatRatio(item.amountRatio),
    displayRatio: tagViewType === 'count' ? formatRatio(item.ratio) : formatRatio(item.amountRatio),
    displayText: tagViewType === 'count'
      ? `${formatRatio(item.ratio)}% (${toInt(item.count)}次)`
      : `${formatRatio(item.amountRatio)}% (¥${toMoney(item.amount)})`,
    color: colors[index % colors.length]
  })).sort((a, b) => tagViewType === 'count' ? b.count - a.count : toNumber(b.amount) - toNumber(a.amount))

  return {
    yearStatistics: {
      totalConsume: toMoney(yearStatistics.totalConsume),
      consumeCount: toInt(yearStatistics.consumeCount)
    },
    monthlyList: fillMonths(data.monthlyData, '#ff6b35'),
    consumeCategories: showAllCategory ? categories : categories.slice(0, 5),
    hasMoreCategory: categories.length > 5,
    consumeTags: showAllTags ? sortedTags : sortedTags.slice(0, 5),
    hasMoreTags: sortedTags.length > 5,
    topConsumeList: (data.topConsumeList || []).map((item) => ({
      ...item,
      category: item.category || '支出',
      date: item.date || '',
      ownerText: item.userName ? ` · ${item.userName}` : '',
      description: item.description || '无备注',
      amount: toMoney(item.amount)
    })),
    insights: formatConsumeInsights(data.insights || {})
  }
}

function formatConsumeInsights(insights) {
  return {
    maxDayAmount: toMoney(insights.maxDayAmount),
    maxDayDate: insights.maxDayDate || '-',
    maxMonthAmount: toMoney(insights.maxMonthAmount),
    maxMonthName: insights.maxMonthName || '-',
    topTag: insights.topTag || '-',
    topTagCount: toInt(insights.topTagCount),
    topTagAmount: toMoney(insights.topTagAmount),
    bottomTag: insights.bottomTag || '-',
    bottomTagCount: toInt(insights.bottomTagCount),
    bottomTagAmount: toMoney(insights.bottomTagAmount),
    largeExpenseRatio: formatRatio(insights.largeExpenseRatio),
    avgMonthAmount: toMoney(insights.avgMonthAmount)
  }
}

function formatIncome(data, showAllCategory) {
  const yearStatistics = data.yearStatistics || {}
  const categories = (data.incomeCategories || []).map((item, index) => ({
    ...item,
    name: item.name || '其他',
    amount: toMoney(item.amount),
    ratio: formatRatio(item.ratio),
    color: colors[index % colors.length]
  }))

  return {
    yearStatistics: {
      totalIncome: toMoney(yearStatistics.totalIncome),
      incomeCount: toInt(yearStatistics.incomeCount)
    },
    monthlyList: fillMonths(data.monthlyData, '#07c160'),
    incomeCategories: showAllCategory ? categories : categories.slice(0, 5),
    hasMoreIncomeCategory: categories.length > 5,
    topIncomeList: (data.topIncomeList || []).map((item) => ({
      ...item,
      category: item.category || '收入',
      date: item.date || '',
      ownerText: item.userName ? ` · ${item.userName}` : '',
      description: item.description || '无备注',
      amount: toMoney(item.amount)
    })),
    insights: {
      maxDayAmount: toMoney((data.insights || {}).maxDayAmount),
      maxDayDate: (data.insights || {}).maxDayDate || '-',
      maxMonthAmount: toMoney((data.insights || {}).maxMonthAmount),
      maxMonthName: (data.insights || {}).maxMonthName || '-',
      largeIncomeRatio: formatRatio((data.insights || {}).largeIncomeRatio),
      avgMonthAmount: toMoney((data.insights || {}).avgMonthAmount)
    }
  }
}

module.exports = {
  currentYear,
  yearDate,
  normalizeYear,
  buildParams,
  formatOverview,
  formatConsume,
  formatIncome,
  drawTrendChart
}
