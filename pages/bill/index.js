const http = require('../../api/request')
const dictStore = require('../../stores/dict')
const scopeStore = require('../../stores/family-shared-scope')

const functionButtons = [
  { type: 'records', text: '明细', icon: '/static/bookkeeping/zhangdanmingxi.png' },
  { type: 'budget', text: '预算', icon: '/static/bookkeeping/yusuan.png' },
  { type: 'consumeStatistics', text: '支出统计', icon: '/static/bookkeeping/zhichutongji.png' },
  { type: 'incomeStatistics', text: '收入统计', icon: '/static/bookkeeping/shourutongji.png' },
  { type: 'quick', text: '记账', icon: '/static/bookkeeping/jizhang.png' }
]

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeDate(value) {
  if (!value) {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
  }
  return value.length === 7 ? `${value}-01` : value
}

function getMonthParts(date) {
  const normalized = normalizeDate(date)
  const parsed = new Date(normalized)
  return {
    currentYear: parsed.getFullYear(),
    currentMonth: pad2(parsed.getMonth() + 1)
  }
}

function getMonthRange(date) {
  const normalized = normalizeDate(date)
  const parsed = new Date(normalized)
  const year = parsed.getFullYear()
  const month = parsed.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${lastDay}`
  }
}

function getRecordIcon(item) {
  if (item.recordIcon) {
    return `/static/bookkeeping${item.recordIcon}.svg`
  }
  if (item.recordCategory === 1) return '/static/bookkeeping/icon/zhichu.svg'
  if (item.recordCategory === 2) return '/static/bookkeeping/icon/shouru.svg'
  return '/static/bookkeeping/icon/amount.svg'
}

Page({
  data: {
    currentDate: normalizeDate(),
    ...getMonthParts(),
    statistics: {
      income: '0.00',
      consume: '0.00'
    },
    functionButtons,
    billList: [],
    loadMoreStatus: 'more',
    loadMoreText: '加载更多',
    isRefreshing: false,
    currentPage: 1,
    pageSize: 10,
    initialized: false
  },

  onShow() {
    if (!this.data.initialized) {
      this.setData({ initialized: true })
      this.initPage()
      return
    }
    this.getStatistics()
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  async initPage() {
    this.setData({ currentPage: 1 })
    await Promise.all([this.getStatistics(), this.getBillList(true)])
  },

  async getStatistics() {
    const dateRange = getMonthRange(this.data.currentDate)
    try {
      const res = await http.post('/bookkeeping-service/bookkeeping/records/statistics', {
        recordStartDate: dateRange.start,
        recordEndDate: dateRange.end,
        queryOnlyMyself: scopeStore.getQueryOnlyMyself()
      })
      const data = res.data || {}
      this.setData({
        statistics: {
          income: parseFloat(data.income || 0).toFixed(2),
          consume: parseFloat(data.consume || 0).toFixed(2)
        }
      })
    } catch (error) {
      this.setData({ statistics: { income: '0.00', consume: '0.00' } })
    }
  },

  async getBillList(reset = false) {
    const dateRange = getMonthRange(this.data.currentDate)
    this.setData({ loadMoreStatus: 'loading', loadMoreText: '加载中...' })
    try {
      const res = await http.post('/bookkeeping-service/bookkeeping/records/page', {
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize,
        recordStartDate: dateRange.start,
        recordEndDate: dateRange.end,
        queryOnlyMyself: scopeStore.getQueryOnlyMyself()
      })

      const records = ((res.data && res.data.records) || []).map((item) => this.formatRecord(item))
      const billList = reset ? records : this.data.billList.concat(records)
      this.setData({
        billList,
        loadMoreStatus: records.length >= this.data.pageSize ? 'more' : 'noMore',
        loadMoreText: records.length >= this.data.pageSize ? '加载更多' : '没有更多了'
      })
    } catch (error) {
      this.setData({ loadMoreStatus: 'more', loadMoreText: '加载更多' })
    } finally {
      this.setData({ isRefreshing: false })
    }
  },

  formatRecord(item) {
    const scope = scopeStore.getScopeState()
    const recordTypeName = dictStore.getDictNameByCode(
      dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TYPE,
      item.recordType,
      '未知'
    )
    const displaySource = item.recordSource || (item.recordCategory === 2 ? '收入' : '消费')
    const ownerText = scope.effectiveScope === 'shared' && item.userName && !item.canEdit
      ? ` · 来自${item.userName}`
      : ''

    return {
      ...item,
      recordTypeName,
      displaySource,
      ownerText,
      recordIconPath: getRecordIcon(item),
      amountText: `${item.recordCategory === 1 ? '-' : ''}${item.amount}`
    }
  },

  handleDateChange(event) {
    const currentDate = normalizeDate(event.detail.value)
    this.setData({
      currentDate,
      ...getMonthParts(currentDate),
      currentPage: 1
    })
    this.initPage()
  },

  handleFunctionClick(event) {
    const routes = {
      quick: '/pagesBookkeeping/bookkeeping/bookkeeping-quick',
      records: '/pagesBookkeeping/bookkeeping/bookkeeping-records',
      consumeStatistics: '/pagesBookkeeping/bookkeeping/bookkeeping-consume-statistics',
      budget: '/pagesBookkeeping/bookkeeping/bookkeeping-budget',
      incomeStatistics: '/pagesBookkeeping/bookkeeping/bookkeeping-income-statistics'
    }
    const url = routes[event.currentTarget.dataset.type]
    if (url) {
      wx.navigateTo({ url })
    }
  },

  handleRecordClick(event) {
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-detail?id=${event.currentTarget.dataset.id}`,
      success: (res) => {
        res.eventChannel.on('recordSaved', (record) => this.updateBillInPlace(record))
        res.eventChannel.on('recordDeleted', (id) => this.removeBillInPlace(id))
      }
    })
  },

  updateBillInPlace(record) {
    if (!record || record.id === undefined || record.id === null) return
    const index = this.data.billList.findIndex((current) => String(current.id) === String(record.id))
    if (index < 0) return

    const current = this.data.billList[index]
    const recordTime = record.recordDate || record.recordTime || current.recordTime
    const billList = this.data.billList.slice()
    billList[index] = this.formatRecord({
      ...current,
      ...record,
      recordTime,
      recordTimeStr: recordTime || current.recordTimeStr
    })
    this.setData({ billList })
  },

  removeBillInPlace(id) {
    const billList = this.data.billList.filter((record) => String(record.id) !== String(id))
    if (billList.length === this.data.billList.length) return
    this.setData({ billList })
  },

  handleScrollToLower() {
    if (this.data.loadMoreStatus !== 'more') return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.getBillList(false)
  },

  handleRefresh() {
    this.setData({ isRefreshing: true, currentPage: 1 })
    this.initPage()
  }
})
