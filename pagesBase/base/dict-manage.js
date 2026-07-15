const baseApi = require('../../api/base')
const loginApi = require('../../api/login')
const dictStore = require('../../stores/dict')

const statusOptions = [
  { value: '', text: '全部状态' },
  { value: 1, text: '启用' },
  { value: 0, text: '禁用' }
]

function buildDictTypeOptions() {
  return [{ value: '', text: '全部类型' }].concat(
    dictStore.getDictTypeArray().map((item) => ({
      value: item.code,
      text: item.name
    }))
  )
}

function normalizeDict(item) {
  return {
    ...item,
    dictStatus: Number(item.dictStatus),
    dictTypeName: dictStore.getDictTypeName(item.dictType) || item.dictType || '-',
    dictStatusName: Number(item.dictStatus) === 1 ? '启用' : '禁用',
    dictCodeText: item.dictCode == null ? '自动' : item.dictCode,
    sortText: item.sort == null ? '-' : item.sort,
    parentText: item.parentId == null ? '-' : item.parentId
  }
}

Page({
  data: {
    dictList: [],
    dictTypeOptions: [],
    statusOptions,
    dictTypeIndex: 0,
    statusIndex: 0,
    dictTypeName: '',
    statusName: '',
    filterForm: {
      dictType: '',
      dictName: '',
      dictStatus: ''
    },
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    activeCount: 0,
    disabledCount: 0,
    filterActive: false,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多'
  },

  pageRequestId: 0,

  onLoad() {
    this.refreshOptions()
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
    this.fetchPage(false)
  },

  refreshOptions() {
    this.setData({ dictTypeOptions: buildDictTypeOptions() })
  },

  async initPage() {
    this.pageRequestId += 1
    this.setData({
      currentPage: 1,
      dictList: [],
      totalCount: 0,
      activeCount: 0,
      disabledCount: 0,
      hasMore: true,
      loadMoreText: '加载中...'
    })
    await this.fetchPage(true, this.pageRequestId)
  },

  buildQuery() {
    const filter = this.data.filterForm
    const dictName = String(filter.dictName || '').trim()
    const query = {
      currentPage: this.data.currentPage,
      pageSize: this.data.pageSize
    }

    if (filter.dictType !== '') {
      query.dictType = Number(filter.dictType)
    }
    if (dictName) {
      query.dictName = dictName
    }
    if (filter.dictStatus !== '') {
      query.dictStatus = Number(filter.dictStatus)
    }

    return query
  },

  buildStats(dictList, totalCount) {
    const activeCount = dictList.filter((item) => Number(item.dictStatus) === 1).length
    const disabledCount = dictList.filter((item) => Number(item.dictStatus) === 0).length
    return {
      totalCount,
      activeCount,
      disabledCount
    }
  },

  async fetchPage(reset, requestId = this.pageRequestId) {
    if (this.data.loading && !reset) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await baseApi.getDictPage(this.buildQuery())
      if (requestId !== this.pageRequestId) return
      const rows = ((res.data && res.data.records) || []).map(normalizeDict)
      const dictList = reset ? rows : this.data.dictList.concat(rows)
      const total = (res.data && res.data.total) || dictList.length
      const stats = this.buildStats(dictList, total)
      this.setData({
        dictList,
        ...stats,
        hasMore: dictList.length < total,
        loadMoreText: dictList.length < total ? '上拉加载更多' : (dictList.length ? '没有更多了' : '暂无数据')
      })
    } catch (error) {
      if (requestId !== this.pageRequestId) return
      this.setData({ loadMoreText: this.data.dictList.length ? '加载更多' : '暂无数据' })
    } finally {
      if (requestId === this.pageRequestId) {
        this.setData({ loading: false })
      }
    }
  },

  onDictTypeChange(event) {
    const dictTypeIndex = Number(event.detail.value)
    const option = this.data.dictTypeOptions[dictTypeIndex]
    this.setData({
      dictTypeIndex,
      dictTypeName: option && option.value !== '' ? option.text : '',
      'filterForm.dictType': option ? option.value : ''
    })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value)
    const option = this.data.statusOptions[statusIndex]
    this.setData({
      statusIndex,
      statusName: option && option.value !== '' ? option.text : '',
      'filterForm.dictStatus': option ? option.value : ''
    })
  },

  onNameInput(event) {
    this.setData({ 'filterForm.dictName': event.detail.value })
  },

  applyFilter() {
    const filter = this.data.filterForm
    this.setData({
      filterActive: Boolean(filter.dictType !== '' || String(filter.dictName || '').trim() || filter.dictStatus !== '')
    })
    this.initPage()
  },

  resetFilter() {
    this.setData({
      dictTypeIndex: 0,
      statusIndex: 0,
      dictTypeName: '',
      statusName: '',
      filterActive: false,
      filterForm: {
        dictType: '',
        dictName: '',
        dictStatus: ''
      }
    })
    this.initPage()
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pagesBase/base/dict-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  editDict(event) {
    wx.navigateTo({
      url: `/pagesBase/base/dict-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  goAdd() {
    wx.navigateTo({ url: '/pagesBase/base/dict-detail' })
  },

  confirmDelete(event) {
    const id = event.currentTarget.dataset.id
    const name = event.currentTarget.dataset.name || '该字典项'
    wx.showModal({
      title: '删除字典项',
      content: `确认删除「${name}」吗？`,
      confirmText: '删除',
      confirmColor: '#dd524d',
      success: async (res) => {
        if (!res.confirm) return
        await baseApi.deleteDict(id)
        await loginApi.refreshDictCache(true)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.initPage()
      }
    })
  }
})
