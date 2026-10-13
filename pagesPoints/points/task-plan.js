const pointsApi = require('../../api/points')
const sessionStore = require('../../stores/session')
const taskBookkeeping = require('../../utils/task-bookkeeping')

function shanghaiDate(offsetDays = 0, timestamp = Date.now()) {
  return new Date(timestamp + 8 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function showModal(options) {
  return new Promise((resolve, reject) => wx.showModal({ ...options, success: resolve, fail: reject }))
}

function newRequestId() {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
}

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
    generating: false,
    generationConfirmVisible: false,
    generationPreview: {},
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

  onUnload() {
    this._unloaded = true
    const resolve = this._generationConfirmResolve
    this._generationConfirmResolve = null
    if (resolve) resolve(false)
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
    if (this.data.generating) return
    const item = this.data.list[Number(event.currentTarget.dataset.index)]
    if (!item) return
    wx.showActionSheet({
      itemList: ['立即生成', '编辑', item.status === 1 ? '禁用' : '启用', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) this.handleGenerate(item)
        if (res.tapIndex === 1) this.handleEdit(item)
        if (res.tapIndex === 2) this.handleUpdateStatus(item)
        if (res.tapIndex === 3) this.handleDelete(item)
      }
    })
  },

  async handleGenerate(item) {
    if (this.data.generating) return
    this.setData({ generating: true })
    let submitting = false
    try {
      const user = sessionStore.getUserInfo()
      if (!user || !user.id) {
        wx.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      // Keep an uncertain request across page exits and app restarts, scoped to its owner.
      const pendingKey = `task-plan-generate:${user.id}:${item.id}`
      const pendingRequestId = wx.getStorageSync(pendingKey)
      const res = await pointsApi.getTaskPlanDetail(item.id)
      if (this._unloaded) return
      const plan = res.data || {}
      const previewTime = Date.now()
      const confirmed = await new Promise(resolve => {
        this._generationConfirmResolve = resolve
        this.setData({
          generationConfirmVisible: true,
          generationPreview: {
            taskName: plan.taskName || '未命名任务',
            planDate: shanghaiDate(0, previewTime),
            deadlineDate: shanghaiDate(Number(plan.deadlineDays) || 0, previewTime),
            rewardPoints: Number(plan.rewardPoints) || 0,
            punishPoints: Number(plan.punishPoints) || 0,
            bookkeepingText: plan.bookkeepingEnabled ? taskBookkeeping.templateSummary(plan.bookkeepingTemplate) : '关闭',
            retry: Boolean(pendingRequestId)
          }
        })
      })
      if (!confirmed) return
      const requestId = pendingRequestId || newRequestId()
      wx.setStorageSync(pendingKey, requestId)
      submitting = true
      wx.showLoading({ title: '正在生成', mask: true })
      const generated = await pointsApi.generateTaskPlanNow({ id: item.id, requestId })
      wx.removeStorageSync(pendingKey)
      submitting = false
      wx.hideLoading()
      if (this._unloaded) return
      const result = generated.data || {}
      if (result.taskDeleted) {
        await showModal({ title: '本次操作已完成', content: '该次操作生成的任务已被删除。再次选择立即生成可创建新任务。', showCancel: false })
        return
      }
      const viewed = await showModal({
        title: '已生成待办',
        content: `截止日期：${dateText(result.deadlineDate)}`,
        confirmText: '查看任务',
        cancelText: '留在此页'
      })
      if (viewed.confirm) wx.navigateTo({ url: `/pagesPoints/task/task-edit-detail?taskId=${result.taskId}` })
    } catch (error) {
      if (submitting) {
        wx.hideLoading()
        wx.showToast({ title: '结果未确认，请再次长按重试', icon: 'none' })
      }
    } finally {
      if (!this._unloaded) this.setData({ generating: false })
    }
  },

  finishGenerationConfirm(confirmed) {
    const resolve = this._generationConfirmResolve
    this._generationConfirmResolve = null
    this.setData({ generationConfirmVisible: false })
    if (resolve) resolve(confirmed)
  },

  cancelGenerationConfirm() { this.finishGenerationConfirm(false) },

  confirmGeneration() { this.finishGenerationConfirm(true) },

  stopGenerationTap() {},

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
