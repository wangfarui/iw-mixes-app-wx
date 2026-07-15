const pointsApi = require('../../api/points')

const statusOptions = [
  { value: '', text: '全部状态' },
  { value: 1, text: '启用' },
  { value: 0, text: '禁用' }
]

function dateText(value) {
  if (!value) return '-'
  return String(value).split(' ')[0]
}

function formatTaskPlan(item) {
  const status = Number(item.status)
  return {
    ...item,
    status,
    taskNameText: item.taskName || '未命名任务',
    statusText: status === 1 ? '启用' : '禁用',
    statusClass: status === 1 ? 'is-active' : 'is-inactive',
    planDateText: dateText(item.planDate),
    nextPlanDateText: dateText(item.nextPlanDate),
    createTimeText: item.createTime || ''
  }
}

Page({
  data: {
    list: [],
    total: 0,
    currentPage: 1,
    pageSize: 10,
    loading: false,
    hasMore: true,
    loadMoreText: '加载更多',
    searchForm: {
      taskName: '',
      status: ''
    },
    statusOptions,
    statusIndex: 0,
    statusName: ''
  },

  onShow() {
    this.search()
  },

  onPullDownRefresh() {
    this.search().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.loadTaskPlanList(true)
  },

  async search() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    await this.loadTaskPlanList(false)
  },

  async loadTaskPlanList(isLoadMore) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await pointsApi.getTaskPlanPage({
        ...this.data.searchForm,
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize
      })
      const records = ((res.data && res.data.records) || []).map(formatTaskPlan)
      const list = isLoadMore ? this.data.list.concat(records) : records
      const total = (res.data && res.data.total) || list.length
      this.setData({
        list,
        total,
        hasMore: list.length < total,
        loadMoreText: list.length < total ? '加载更多' : (list.length ? '没有更多了' : '暂无数据')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.list.length ? '加载更多' : '暂无数据' })
    } finally {
      this.setData({ loading: false })
    }
  },

  handleSearchInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`searchForm.${field}`]: event.detail.value })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value)
    const option = this.data.statusOptions[statusIndex]
    this.setData({
      statusIndex,
      statusName: option && option.value !== '' ? option.text : '',
      'searchForm.status': option ? option.value : ''
    })
    this.search()
  },

  openActions(event) {
    const item = this.data.list[Number(event.currentTarget.dataset.index)]
    if (!item) return
    wx.showActionSheet({
      itemList: ['编辑', item.status === 1 ? '禁用' : '启用', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) this.handleEdit(item)
        if (res.tapIndex === 1) this.handleUpdateStatus(item)
        if (res.tapIndex === 2) this.handleDelete(item)
      }
    })
  },

  async handleUpdateStatus(item) {
    const status = item.status === 1 ? 0 : 1
    await pointsApi.updateTaskPlanStatus({ id: item.id, status })
    wx.showToast({ title: status === 1 ? '已启用' : '已禁用', icon: 'success' })
    this.search()
  },

  handleEdit(item) {
    wx.navigateTo({ url: `/pagesPoints/points/task-plan-add?id=${item.id}` })
  },

  handleDelete(item) {
    wx.showModal({
      content: `是否删除【${item.taskName}】任务计划？`,
      success: async (res) => {
        if (!res.confirm) return
        await pointsApi.deleteTaskPlan(item.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.search()
      }
    })
  },

  navigateToAdd() {
    wx.navigateTo({ url: '/pagesPoints/points/task-plan-add' })
  }
})
