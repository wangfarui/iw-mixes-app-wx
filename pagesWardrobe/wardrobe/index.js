const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDate(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatShortDate(dateText) {
  const parts = String(dateText || '').split('-')
  if (parts.length < 3) return dateText || ''
  return `${parts[1]}-${parts[2]}`
}

function parseDate(dateText) {
  const date = new Date(`${dateText}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function monthKey(date) {
  return formatDate(date).slice(0, 7)
}

function dateLabel(dateText, todayText, yesterdayText) {
  if (dateText === todayText) return '今天'
  if (dateText === yesterdayText) return '昨天'
  const tomorrowText = formatDate(addDays(parseDate(todayText), 1))
  if (dateText === tomorrowText) return '明天'
  const date = parseDate(dateText)
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return date ? `${formatShortDate(dateText)} ${weekNames[date.getDay()]}` : dateText
}

function compactJoin(values) {
  return (values || []).filter(Boolean).join(' · ')
}

function visibleTagNames(options, tags) {
  const values = helper.splitTags(tags)
  if (!values.length) return ''
  return values.map((value) => helper.optionText(options, value, value)).join('、')
}

function formatRecordForList(record) {
  const formatted = helper.formatRecord(record)
  const sceneNames = visibleTagNames(helper.getSceneOptions(), record.sceneTags)
  return {
    ...formatted,
    sceneNames,
    weatherMoodText: compactJoin([record.weatherText, record.moodText]),
    itemCountText: `${Number(record.itemCount || (record.itemList || []).length || 0)}件`
  }
}

function buildGroups(records, todayText, yesterdayText) {
  const groupMap = records.reduce((map, record) => {
    const date = record.wearDate || record.dateText
    if (!date) return map
    if (!map[date]) {
      map[date] = {
        date,
        dateText: formatShortDate(date),
        label: dateLabel(date, todayText, yesterdayText),
        records: []
      }
    }
    map[date].records.push(record)
    return map
  }, {})
  return Object.keys(groupMap)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => groupMap[date])
}

const RANGE_OPTIONS = [
  { value: 'near3', text: '近三天', before: 3, after: 3 },
  { value: 'near7', text: '近一周', before: 7, after: 7 },
  { value: 'near30', text: '近一个月', before: 30, after: 30 }
]

function rangeOption(value) {
  return RANGE_OPTIONS.find((item) => item.value === value) || RANGE_OPTIONS[1]
}

function buildDateRange(rangeValue) {
  const option = rangeOption(rangeValue)
  const today = startOfDay(new Date())
  return {
    option,
    today,
    startDate: addDays(today, -option.before),
    endDate: addDays(today, option.after)
  }
}

function monthKeysBetween(startDate, endDate) {
  const months = []
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  while (cursor <= endCursor) {
    months.push(monthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

Page({
  data: {
    loading: false,
    rangeText: '',
    rangeType: 'near7',
    rangeOptions: RANGE_OPTIONS,
    recordGroups: []
  },

  onShow() {
    this.loadRecentRecords()
  },

  onPullDownRefresh() {
    this.loadRecentRecords().finally(() => wx.stopPullDownRefresh())
  },

  async loadRecentRecords() {
    if (this.data.loading) return
    const { option, today, startDate, endDate } = buildDateRange(this.data.rangeType)
    const startText = formatDate(startDate)
    const endText = formatDate(endDate)
    const todayText = formatDate(today)
    const yesterdayText = formatDate(addDays(today, -1))
    const months = monthKeysBetween(startDate, endDate)
    this.setData({
      loading: true,
      rangeText: `${option.text} · ${formatShortDate(startText)} 至 ${formatShortDate(endText)}`
    })
    try {
      const responses = await Promise.all(months.map((month) => wardrobeApi.getWearRecordMonth({ month })))
      const records = responses
        .flatMap((res) => res.data || [])
        .filter((record) => {
          const wearDate = record.wearDate || ''
          return Number(record.recordType) === 2 && wearDate >= startText && wearDate <= endText
        })
        .sort((a, b) => {
          const dateCompare = String(b.wearDate || '').localeCompare(String(a.wearDate || ''))
          if (dateCompare !== 0) return dateCompare
          return Number(b.id || 0) - Number(a.id || 0)
        })
        .map(formatRecordForList)
      this.setData({
        recordGroups: buildGroups(records, todayText, yesterdayText)
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onRangeChange(event) {
    const rangeType = event.currentTarget.dataset.value
    if (!rangeType || rangeType === this.data.rangeType) return
    this.setData({ rangeType })
    this.loadRecentRecords()
  },

  goRecordForm() {
    wx.navigateTo({ url: '/pagesWardrobe/wardrobe/wear-record-form' })
  },

  editRecord(event) {
    const id = Number(event.currentTarget.dataset.id)
    if (!id) return
    wx.navigateTo({ url: `/pagesWardrobe/wardrobe/wear-record-form?id=${id}` })
  },

  previewRecordImage(event) {
    const recordId = Number(event.currentTarget.dataset.recordId)
    const current = event.currentTarget.dataset.url
    if (!current) return
    const records = this.data.recordGroups.flatMap((group) => group.records || [])
    const record = records.find((item) => Number(item.id) === recordId)
    const urls = ((record && record.itemList) || [])
      .map((item) => item.itemImage)
      .filter(Boolean)
    wx.previewImage({
      urls: urls.length ? urls : [current],
      current
    })
  }
})
