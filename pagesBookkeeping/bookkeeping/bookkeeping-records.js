const bookkeepingApi = require('../../api/bookkeeping')
const scopeStore = require('../../stores/family-shared-scope')
const familyStore = require('../../stores/family')
const bookkeepingUtils = require('../../utils/bookkeeping')

const recordCategoryOptions = [
  { value: '', text: '全部' },
  { value: 1, text: '支出' },
  { value: 2, text: '收入' }
]

const sortTypeOptions = [
  { value: 0, text: '默认' },
  { value: 1, text: '记账时间' },
  { value: 2, text: '记账金额' }
]

const sortWayOptions = [
  { value: 0, text: '降序' },
  { value: 1, text: '升序' }
]

function decodeCategoryName(value) {
  try {
    // Decode only at the route boundary; a literal "%26" must remain "%26".
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

function buildRecordTypeButtons(categories, selectedName) {
  const buttons = [{ name: '', dictName: '全部' }].concat(
    (categories || []).map((item) => ({ ...item, dictName: item.name }))
  )
  // A comparison-only category may have no records in the selected period.
  if (selectedName && !buttons.some((item) => item.name === selectedName)) {
    buttons.push({ name: selectedName, dictName: selectedName })
  }
  return buttons
}

function createDto() {
  return {
    currentPage: 1,
    pageSize: 20,
    recordStartDate: '',
    recordEndDate: '',
    categoryNames: [],
    categoryState: null,
    recordSource: '',
    mixAmount: '',
    maxAmount: '',
    tagNames: [],
    isSearchAll: '',
    recordCategory: '',
    sortType: 0,
    sortWay: 0,
    queryOnlyMyself: null
  }
}

Page({
  data: {
    selectedCategoryName: '',
    selectedCategoryState: null,
    recordTypeButtons: [],
    startDate: '',
    endDate: '',
    dto: createDto(),
    list: [],
    statistics: {
      consume: 0,
      income: 0
    },
    loadMoreStatus: 'more',
    loadMoreText: '加载更多',
    showFilter: false,
    ignoreNotStatistics: false,
    tagNames: [],
    filterTagOptions: [],
    recordCategoryOptions,
    recordCategoryIndex: 0,
    sortTypeOptions,
    sortTypeIndex: 0,
    sortWayOptions,
    sortWayIndex: 0,
    initialized: false
  },

  onLoad(options) {
    this.applyRouteOptions(options || {})
  },

  onShow() {
    this.refreshOptions()
    if (!this.data.initialized || this._refreshRecordsOnShow || (this._recordScope !== undefined && this._recordScope !== scopeStore.getQueryOnlyMyself())) {
      this._refreshRecordsOnShow = false
      this.setData({ initialized: true })
      this.initPage()
    }
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.loadMoreStatus !== 'more') return
    this.setData({
      'dto.currentPage': this.data.dto.currentPage + 1
    })
    this.searchPage(false)
  },

  async ensureFamilyGroupLoaded() {
    await familyStore.ensureMyGroupLoaded()
  },

  applyRouteOptions(options) {
    const update = {}
    if (options.recordDate) {
      const range = bookkeepingUtils.monthRange(`${options.recordDate}-01`)
      update.startDate = range.firstDay
      update.endDate = range.lastDay
    } else if (options.recordYear) {
      const range = bookkeepingUtils.yearRange(`${options.recordYear}-01-01`)
      update.startDate = range.firstDay
      update.endDate = range.lastDay
    } else {
      const range = bookkeepingUtils.monthRange()
      update.startDate = range.firstDay
      update.endDate = range.lastDay
    }

    if (['UNCATEGORIZED', 'PENDING'].includes(options.categoryState)) {
      update.selectedCategoryState = options.categoryState
    } else if (options.categoryName) {
      update.selectedCategoryName = decodeCategoryName(options.categoryName)
    }
    update.recordTypeButtons = buildRecordTypeButtons([], update.selectedCategoryName)

    if (options.ignoreNotStatistics !== undefined) {
      update.ignoreNotStatistics = options.ignoreNotStatistics === 'true'
    }

    if (options.recordCategory !== undefined) {
      const recordCategory = Number(options.recordCategory)
      const categoryIndex = recordCategoryOptions.findIndex((item) => item.value === recordCategory)
      update.recordCategoryIndex = categoryIndex >= 0 ? categoryIndex : 0
      update['dto.recordCategory'] = categoryIndex >= 0 ? recordCategory : ''
    }

    this.setData(update)
  },

  async refreshOptions() {
    const requestId = this._filterRequest = (this._filterRequest || 0) + 1
    try {
      await this.ensureFamilyGroupLoaded()
      const identity = require('../../stores/bookkeeping-options').identity()
      const res = await bookkeepingApi.getRecordFilterOptions({ queryOnlyMyself: scopeStore.getQueryOnlyMyself(), recordStartDate: this.data.startDate, recordEndDate: this.data.endDate, recordCategory: this.data.dto.recordCategory || undefined })
      if (requestId !== this._filterRequest || identity !== require('../../stores/bookkeeping-options').identity()) return
      const data = res.data || {}
      const tags = Number(this.data.dto.recordCategory) === 1 ? data.expenseTags || [] : Number(this.data.dto.recordCategory) === 2 ? data.incomeTags || [] : (data.expenseTags || []).concat(data.incomeTags || [])
      this._historicalTags = Array.from(new Set(tags.map((item) => item.name)))
      this.setData({ recordTypeButtons: buildRecordTypeButtons(data.categories, this.data.selectedCategoryName) })
      this.renderFilterTags()
    } catch (error) {
      if (requestId === this._filterRequest) {
        this._historicalTags = []
        this.setData({ recordTypeButtons: buildRecordTypeButtons([], this.data.selectedCategoryName) })
        this.renderFilterTags()
      }
    }
  },

  renderFilterTags() {
    this.setData({ filterTagOptions: (this._historicalTags || []).map((name) => ({ name, dictName: name, selected: this.data.tagNames.includes(name) })) })
  },

  initFormPageDto() {
    this.setData({
      list: [],
      loadMoreStatus: 'loading',
      loadMoreText: '加载中...',
      'dto.currentPage': 1,
      'dto.pageSize': 20,
      'dto.isSearchAll': this.data.ignoreNotStatistics ? 0 : 1,
      'dto.queryOnlyMyself': scopeStore.getQueryOnlyMyself()
    })
  },

  async initPage() {
    try { await this.ensureFamilyGroupLoaded() } catch (error) {
      this.setData({ initialized: false })
      return
    }
    await this.refreshOptions()
    this._recordScope = scopeStore.getQueryOnlyMyself()
    this.initFormPageDto()
    return this.searchData(true)
  },

  syncSearchDto() {
    this.setData({
      'dto.recordStartDate': this.data.startDate,
      'dto.recordEndDate': this.data.endDate,
      'dto.categoryNames': this.data.selectedCategoryState || this.data.selectedCategoryName === '' ? [] : [this.data.selectedCategoryName],
      'dto.categoryState': this.data.selectedCategoryState,
      'dto.tagNames': this.data.tagNames,
      'dto.isSearchAll': this.data.ignoreNotStatistics ? 0 : 1,
      'dto.queryOnlyMyself': scopeStore.getQueryOnlyMyself()
    })
  },

  async searchData(reset) {
    this.syncSearchDto()
    this._recordsRequest = (this._recordsRequest || 0) + 1
    await Promise.all([this.searchStatistics(this._recordsRequest), this.searchPage(reset, this._recordsRequest)])
  },

  async searchStatistics(requestId = this._recordsRequest) {
    try {
      const res = await bookkeepingApi.getRecordStatistics(this.data.dto)
      if (requestId !== this._recordsRequest) return
      this.setData({
        statistics: res.data || { consume: 0, income: 0 }
      })
    } catch (error) {
      if (requestId !== this._recordsRequest) return
      this.setData({
        statistics: { consume: 0, income: 0 }
      })
    }
  },

  async searchPage(reset, requestId = this._recordsRequest) {
    this.setData({
      loadMoreStatus: 'loading',
      loadMoreText: '加载中...'
    })

    try {
      const res = await bookkeepingApi.getRecordPage(this.data.dto)
      if (requestId !== this._recordsRequest) return
      const records = ((res.data && res.data.records) || []).map((item) => (
        bookkeepingUtils.formatListRecord(item, scopeStore.getScopeState())
      ))
      const list = reset ? records : this.data.list.concat(records)
      const hasMore = records.length === this.data.dto.pageSize
      this.setData({
        list,
        loadMoreStatus: hasMore ? 'more' : 'noMore',
        loadMoreText: hasMore ? '加载更多' : (list.length ? '没有更多了' : '暂无记录')
      })
    } catch (error) {
      if (requestId !== this._recordsRequest) return
      this.setData({
        loadMoreStatus: 'more',
        loadMoreText: '加载更多'
      })
    }
  },

  selectButton(event) {
    this.setData({
      selectedCategoryName: event.currentTarget.dataset.name || '',
      selectedCategoryState: null
    })
    this.initPage()
  },

  onStartDateChange(event) {
    const startDate = event.detail.value
    if (startDate && this.data.endDate && startDate > this.data.endDate) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      })
      this.setData({ list: [], statistics: { consume: 0, income: 0 } })
      return
    }
    this.setData({ startDate })
    this.initPage()
  },

  onEndDateChange(event) {
    const endDate = event.detail.value
    if (this.data.startDate && endDate && this.data.startDate > endDate) {
      wx.showToast({
        title: '结束日期不能小于开始日期',
        icon: 'none'
      })
      this.setData({ list: [], statistics: { consume: 0, income: 0 } })
      return
    }
    this.setData({ endDate })
    this.initPage()
  },

  clearDates() {
    const range = bookkeepingUtils.monthRange()
    this.setData({
      startDate: range.firstDay,
      endDate: range.lastDay
    })
    this.initPage()
  },

  openFilter() {
    this.refreshOptions()
    this.setData({ showFilter: true })
  },

  closeFilter() {
    this.setData({ showFilter: false })
  },

  noop() {},

  switchIgnoreStatistics(event) {
    this.setData({
      ignoreNotStatistics: Boolean(event.detail.value)
    })
  },

  handleFilterInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`dto.${field}`]: event.detail.value
    })
  },

  toggleTag(event) {
    const id = event.currentTarget.dataset.name
    const tagNames = this.data.tagNames.slice()
    const index = tagNames.indexOf(id)
    if (index >= 0) {
      tagNames.splice(index, 1)
    } else {
      tagNames.push(id)
    }
    this.setData({
      tagNames
    })
    this.renderFilterTags()
  },

  onCategoryPickerChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      recordCategoryIndex: index,
      'dto.recordCategory': recordCategoryOptions[index].value,
      tagNames: []
    })
    this.refreshOptions()
  },

  onSortTypeChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      sortTypeIndex: index,
      'dto.sortType': sortTypeOptions[index].value
    })
  },

  onSortWayChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      sortWayIndex: index,
      'dto.sortWay': sortWayOptions[index].value
    })
  },

  resetFilter() {
    const nextDto = {
      ...this.data.dto,
      recordSource: '',
      mixAmount: '',
      maxAmount: '',
      tagNames: [],
      isSearchAll: 1,
      recordCategory: '',
      sortType: 0,
      sortWay: 0
    }
    this.setData({
      dto: nextDto,
      selectedCategoryName: '',
      selectedCategoryState: null,
      tagNames: [],

      ignoreNotStatistics: false,
      recordCategoryIndex: 0,
      sortTypeIndex: 0,
      sortWayIndex: 0,
      showFilter: false
    })
    this.initPage()
  },

  applyFilter() {
    this.setData({ showFilter: false })
    this.initPage()
  },

  handleRecordClick(event) {
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-detail?id=${event.currentTarget.dataset.id}`,
      success: (res) => {
        res.eventChannel.on('recordSaved', (record) => this.updateRecordInPlace(record))
        res.eventChannel.on('recordDeleted', (id) => this.removeRecordInPlace(id))
      }
    })
  },

  updateRecordInPlace(record) {
    if (!record || record.id === undefined || record.id === null) return
    const index = this.data.list.findIndex((current) => String(current.id) === String(record.id))
    if (index < 0) return

    const current = this.data.list[index]
    if (record.expenseUserId != null && Number(record.expenseUserId) !== Number(current.expenseUserId == null ? current.userId : current.expenseUserId)) {
      this._refreshRecordsOnShow = true
      return
    }
    const recordTime = record.recordDate || record.recordTime || current.recordTime
    const list = this.data.list.slice()
    list[index] = bookkeepingUtils.formatListRecord({
      ...current,
      ...record,
      recordTime,
      recordTimeStr: recordTime || current.recordTimeStr
    }, scopeStore.getScopeState())
    this.setData({ list })
  },

  removeRecordInPlace(id) {
    const list = this.data.list.filter((record) => String(record.id) !== String(id))
    if (list.length === this.data.list.length) return
    this.setData({ list })
  }
})
