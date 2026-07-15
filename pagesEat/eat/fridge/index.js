const eatApi = require('../../../api/eat')
const dictStore = require('../../../stores/dict')
const utils = require('../../../utils/bookkeeping')
const helper = require('../eat-helper')

const expireOptions = [
  { value: '', text: '全部' },
  { value: 'expiring', text: '即将过期' },
  { value: 'expired', text: '已过期' }
]
const sortOptions = [
  { value: 0, text: '创建时间' },
  { value: 1, text: '入库日期' },
  { value: 2, text: '过期日期' }
]

function addDays(dateText, days) {
  const date = new Date(dateText)
  date.setDate(date.getDate() + days)
  return utils.formatDate(date)
}

Page({
  data: {
    list: [],
    filters: {
      name: '',
      expireType: '',
      section: '',
      category: ''
    },
    expireOptions,
    sortOptions,
    sectionOptions: [],
    categoryOptions: [],
    expireIndex: 0,
    sortIndex: 0,
    sectionIndex: 0,
    categoryIndex: 0,
    expireName: '',
    sortName: '创建时间',
    sectionName: '',
    categoryName: '',
    sortWay: 2,
    isFilterExpanded: false,
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多'
  },

  onShow() {
    this.refreshOptions()
    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchFoods(false)
  },

  refreshOptions() {
    this.setData({
      sectionOptions: helper.optionList(dictStore.dictTypeEnum.EAT_FRIDGE_SECTION, '全部分区'),
      categoryOptions: helper.optionList(dictStore.dictTypeEnum.EAT_FRIDGE_CATEGORY, '全部分类')
    })
  },

  buildParams() {
    const params = {
      name: this.data.filters.name,
      section: this.data.filters.section || null,
      category: this.data.filters.category || null,
      sortType: this.data.sortOptions[this.data.sortIndex].value,
      sortWay: this.data.sortWay,
      currentPage: this.data.currentPage,
      pageSize: this.data.pageSize
    }
    const today = utils.today()
    if (this.data.filters.expireType === 'expiring') {
      params.expireStartDate = today
      params.expireEndDate = addDays(today, 3)
    } else if (this.data.filters.expireType === 'expired') {
      params.expireEndDate = today
    }
    return params
  },

  async initPage() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    await this.fetchFoods(true)
  },

  async fetchFoods(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await eatApi.getFridgeFoodPage(this.buildParams())
      const rows = ((res.data && res.data.records) || []).map(helper.formatFood)
      const list = reset ? rows : this.data.list.concat(rows)
      const total = (res.data && res.data.total) || list.length
      this.setData({
        list,
        hasMore: list.length < total,
        loadMoreText: list.length < total ? '加载更多' : (list.length ? '没有更多了' : '暂无数据')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.list.length ? '加载更多' : '暂无数据' })
    } finally {
      this.setData({ loading: false })
    }
  },

  toggleFilter() {
    this.setData({ isFilterExpanded: !this.data.isFilterExpanded })
  },

  handleFilterInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`filters.${field}`]: event.detail.value })
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.value)
    const sortWay = sortIndex === this.data.sortIndex ? (this.data.sortWay === 1 ? 2 : 1) : 2
    this.setData({
      sortIndex,
      sortWay,
      sortName: `${this.data.sortOptions[sortIndex].text}${sortWay === 1 ? '↑' : '↓'}`
    })
    this.initPage()
  },

  onExpireChange(event) {
    const expireIndex = Number(event.detail.value)
    const option = this.data.expireOptions[expireIndex]
    this.setData({
      expireIndex,
      expireName: option && option.value ? option.text : '',
      'filters.expireType': option ? option.value : ''
    })
    this.initPage()
  },

  onSectionChange(event) {
    const sectionIndex = Number(event.detail.value)
    const option = this.data.sectionOptions[sectionIndex]
    this.setData({
      sectionIndex,
      sectionName: option && option.value !== '' ? option.text : '',
      'filters.section': option ? option.value : ''
    })
    this.initPage()
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const option = this.data.categoryOptions[categoryIndex]
    this.setData({
      categoryIndex,
      categoryName: option && option.value !== '' ? option.text : '',
      'filters.category': option ? option.value : ''
    })
    this.initPage()
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pagesEat/eat/fridge/detail?id=${event.currentTarget.dataset.id}` })
  },

  openActions(event) {
    const item = this.data.list[Number(event.currentTarget.dataset.index)]
    if (!item) return
    wx.showActionSheet({
      itemList: ['用完', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) this.markAsUsed(item)
        if (res.tapIndex === 1) this.deleteFood(item)
      }
    })
  },

  async markAsUsed(item) {
    await eatApi.markFridgeFoodAsUsed(item.id)
    wx.showToast({ title: '已用完', icon: 'success' })
    this.initPage()
  },

  deleteFood(item) {
    wx.showModal({
      content: `确定删除【${item.name}】吗？`,
      success: async (res) => {
        if (!res.confirm) return
        await eatApi.deleteFridgeFood(item.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.initPage()
      }
    })
  },

  goAdd() {
    wx.navigateTo({ url: '/pagesEat/eat/fridge/detail' })
  }
})
