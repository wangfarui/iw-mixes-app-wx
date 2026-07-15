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

function createDto() {
  return {
    currentPage: 1,
    pageSize: 20,
    recordStartDate: '',
    recordEndDate: '',
    recordType: '',
    recordSource: '',
    mixAmount: '',
    maxAmount: '',
    tagIdList: [],
    isSearchAll: '',
    recordCategory: '',
    sortType: 0,
    sortWay: 0,
    queryOnlyMyself: null
  }
}

Page({
  data: {
    selectedButtonCode: -1,
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
    tagIdList: [],
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
    if (!this.data.initialized) {
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
    if (familyStore.getMyGroupState() || wx.getStorageSync('myGroup')) return
    await familyStore.fetchMyGroup()
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

    if (options.recordType) {
      update.selectedButtonCode = Number(options.recordType)
    }

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

  refreshOptions() {
    this.setData({
      recordTypeButtons: bookkeepingUtils.getRecordTypeOptions(true),
      filterTagOptions: bookkeepingUtils.getAllTagOptions(this.data.tagIdList)
    })
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
    await this.ensureFamilyGroupLoaded()
    this.initFormPageDto()
    return this.searchData(true)
  },

  syncSearchDto() {
    this.setData({
      'dto.recordStartDate': this.data.startDate,
      'dto.recordEndDate': this.data.endDate,
      'dto.recordType': this.data.selectedButtonCode == -1 ? '' : this.data.selectedButtonCode,
      'dto.tagIdList': this.data.tagIdList,
      'dto.isSearchAll': this.data.ignoreNotStatistics ? 0 : 1,
      'dto.queryOnlyMyself': scopeStore.getQueryOnlyMyself()
    })
  },

  async searchData(reset) {
    this.syncSearchDto()
    await Promise.all([this.searchStatistics(), this.searchPage(reset)])
  },

  async searchStatistics() {
    try {
      const res = await bookkeepingApi.getRecordStatistics(this.data.dto)
      this.setData({
        statistics: res.data || { consume: 0, income: 0 }
      })
    } catch (error) {
      this.setData({
        statistics: { consume: 0, income: 0 }
      })
    }
  },

  async searchPage(reset) {
    this.setData({
      loadMoreStatus: 'loading',
      loadMoreText: '加载中...'
    })

    try {
      const res = await bookkeepingApi.getRecordPage(this.data.dto)
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
      this.setData({
        loadMoreStatus: 'more',
        loadMoreText: '加载更多'
      })
    }
  },

  selectButton(event) {
    this.setData({
      selectedButtonCode: Number(event.currentTarget.dataset.code)
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
    const id = Number(event.currentTarget.dataset.id)
    const tagIdList = this.data.tagIdList.slice()
    const index = tagIdList.indexOf(id)
    if (index >= 0) {
      tagIdList.splice(index, 1)
    } else {
      tagIdList.push(id)
    }
    this.setData({
      tagIdList,
      filterTagOptions: bookkeepingUtils.getAllTagOptions(tagIdList)
    })
  },

  onCategoryPickerChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      recordCategoryIndex: index,
      'dto.recordCategory': recordCategoryOptions[index].value
    })
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
      tagIdList: [],
      isSearchAll: 1,
      recordCategory: '',
      sortType: 0,
      sortWay: 0
    }
    this.setData({
      dto: nextDto,
      tagIdList: [],
      filterTagOptions: bookkeepingUtils.getAllTagOptions([]),
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
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
