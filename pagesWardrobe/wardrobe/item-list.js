const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')
const familyScope = require('../../stores/family-shared-scope')
const wardrobeFamily = require('./wardrobe-family')

Page({
  data: {
    categories: [{ value: '', text: '全部品类' }].concat(helper.getCategoryOptions()),
    currentCategory: '',
    itemStyleOptions: [{ value: '', text: '全部款式' }],
    itemStyleIndex: 0,
    statusOptions: [{ value: '', text: '全部状态' }].concat(helper.STATUS_OPTIONS),
    statusIndex: 0,
    wearStateOptions: helper.WEAR_STATE_OPTIONS,
    wearStateIndex: 0,
    sortOptions: helper.SORT_OPTIONS,
    sortIndex: 0,
    keyword: '',
    ownerOptions: [{ value: '', text: '全部成员' }],
    ownerIndex: 0,
    showOwnerFilter: false,
    showOwnerLabels: true,
    ownerScopeFallback: false,
    list: [],
    currentPage: 1,
    pageSize: 12,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多',
    initialized: false
  },

  onShow() {
    this.refreshDictOptions()
    if (!this.data.initialized) {
      this.setData({ initialized: true })
      this.loadOwnerOptions().then(() => this.initPage())
    }
  },

  async loadOwnerOptions() {
    const queryOnlyMyself = familyScope.getQueryOnlyMyself()
    const state = await wardrobeFamily.loadOwnerState()
    const ownerOptions = state.fallbackToMyself
      ? state.ownerOptions
      : [{ value: '', text: '全部成员' }].concat(state.ownerOptions)
    this.setData({
      ownerOptions,
      ownerIndex: 0,
      showOwnerFilter: !queryOnlyMyself && state.canChooseOwner && !state.fallbackToMyself,
      showOwnerLabels: !familyScope.isChildRole(),
      ownerScopeFallback: state.fallbackToMyself
    })
    if (state.fallbackToMyself) {
      wx.showToast({ title: '家庭成员加载失败，已仅显示自己', icon: 'none' })
    }
  },

  refreshDictOptions() {
    const itemStyleValue = (this.data.itemStyleOptions[this.data.itemStyleIndex] || {}).value
    const itemStyleOptions = this.itemStyleOptions(this.data.currentCategory)
    this.setData({
      categories: [{ value: '', text: '全部品类' }].concat(helper.getCategoryOptions()),
      itemStyleOptions,
      itemStyleIndex: helper.optionIndex(itemStyleOptions, itemStyleValue)
    })
  },

  itemStyleOptions(category) {
    return [{ value: '', text: '全部款式' }].concat(helper.getItemStyleOptions(category))
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchItems(false)
  },

  initPage() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    return this.fetchItems(true)
  },

  async fetchItems(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await wardrobeApi.getItemPage({
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize,
        keyword: this.data.keyword,
        category: this.data.currentCategory || null,
        itemStyle: this.data.itemStyleOptions[this.data.itemStyleIndex].value || null,
        status: this.data.statusOptions[this.data.statusIndex].value || null,
        wearState: this.data.wearStateOptions[this.data.wearStateIndex].value || null,
        sortType: this.data.sortOptions[this.data.sortIndex].value,
        queryOnlyMyself: this.data.ownerScopeFallback || familyScope.getQueryOnlyMyself() === 1,
        ownerUserId: this.data.ownerOptions[this.data.ownerIndex].value || null
      })
      const rows = ((res.data && res.data.records) || []).map((item) => {
        const owner = this.data.ownerOptions.find((option) => String(option.value) === String(item.ownerUserId))
        return helper.formatItem({
          ...item,
          ownerText: owner ? owner.text : (item.ownerName || ''),
          ownerAvatar: item.ownerAvatar || (owner && owner.avatar) || ''
        })
      })
      const list = reset ? rows : this.data.list.concat(rows)
      const total = (res.data && res.data.total) || list.length
      this.setData({
        list,
        hasMore: list.length < total,
        loadMoreText: list.length < total ? '加载更多' : (list.length ? '没有更多衣物了' : '')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.list.length ? '加载更多' : '' })
    } finally {
      this.setData({ loading: false })
    }
  },

  handleKeywordInput(event) {
    this.setData({ keyword: event.detail.value })
  },

  selectCategory(event) {
    const value = event.currentTarget.dataset.value
    if (value === this.data.currentCategory) return
    this.setData({
      currentCategory: value,
      itemStyleOptions: this.itemStyleOptions(value),
      itemStyleIndex: 0
    })
    this.initPage()
  },

  onItemStyleChange(event) {
    this.setData({ itemStyleIndex: Number(event.detail.value) })
    this.initPage()
  },

  onStatusChange(event) {
    this.setData({ statusIndex: Number(event.detail.value) })
    this.initPage()
  },

  onWearStateChange(event) {
    this.setData({ wearStateIndex: Number(event.detail.value) })
    this.initPage()
  },

  onSortChange(event) {
    this.setData({ sortIndex: Number(event.detail.value) })
    this.initPage()
  },

  onOwnerChange(event) {
    this.setData({ ownerIndex: Number(event.detail.value) })
    this.initPage()
  },

  resetFilters() {
    this.setData({
      currentCategory: '',
      itemStyleOptions: this.itemStyleOptions(''),
      itemStyleIndex: 0,
      statusIndex: 0,
      wearStateIndex: 0,
      sortIndex: 0,
      ownerIndex: 0,
      keyword: ''
    })
    this.initPage()
  },

  goAdd() {
    this.openItemForm('/pagesWardrobe/wardrobe/item-form')
  },

  goBatchAdd() {
    wx.navigateTo({ url: '/pagesWardrobe/wardrobe/item-batch' })
  },

  goEdit(event) {
    this.openItemForm(`/pagesWardrobe/wardrobe/item-form?id=${event.currentTarget.dataset.id}`)
  },

  openItemForm(url) {
    wx.navigateTo({
      url,
      success: (res) => {
        res.eventChannel.on('itemSaved', (item) => this.updateItemInPlace(item))
      }
    })
  },

  updateItemInPlace(item) {
    if (!item || item.id === undefined || item.id === null) return
    const index = this.data.list.findIndex((current) => String(current.id) === String(item.id))
    if (index < 0) return

    const list = this.data.list.slice()
    list[index] = helper.formatItem({
      ...list[index],
      ...item
    })
    this.setData({ list })
  },

  markWorn(event) {
    if (!event.currentTarget.dataset.canMarkWorn) return
    const id = event.currentTarget.dataset.id
    wx.showModal({
      content: '标记这件衣物今天已穿？',
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.markItemsWorn({
          wearDate: helper.today(),
          itemIds: [Number(id)]
        })
        wx.showToast({ title: '已记录', icon: 'success' })
        this.initPage()
      }
    })
  },

  deleteItem(event) {
    if (!event.currentTarget.dataset.canDelete) return
    const id = event.currentTarget.dataset.id
    wx.showModal({
      content: '确定删除这件衣物吗？',
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.deleteItem(id)
        wx.showToast({ title: '已删除', icon: 'success' })
        this.initPage()
      }
    })
  }
})
