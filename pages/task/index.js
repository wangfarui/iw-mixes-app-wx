const http = require('../../api/request')

const viewKeys = ['recent', 'inbox', 'done']

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getDeadlineStatus(task) {
  if (!task.deadlineDate) return 'normal'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const deadlineDate = new Date(task.deadlineDate)
  deadlineDate.setHours(0, 0, 0, 0)

  if (deadlineDate < today) return 'overdue'
  if (deadlineDate.getTime() === today.getTime() || deadlineDate.getTime() === tomorrow.getTime()) {
    return 'urgent'
  }
  return 'normal'
}

function normalizeTask(task) {
  const deadlineStatus = getDeadlineStatus(task)
  const deadlineLabel = deadlineStatus === 'overdue' ? '已截止' : deadlineStatus === 'urgent' ? '即将截止' : ''
  return {
    ...task,
    deadlineStatus,
    deadlineLabel,
    deadlineBadgeClass: `deadline-${deadlineStatus}`,
    showDeadlineBadge: deadlineStatus !== 'normal'
  }
}

Page({
  data: {
    viewKeys,
    currentView: 'recent',
    swiperCurrent: 0,
    taskList: [],
    loading: false,
    newTaskName: '',
    newTaskDeadline: '',
    newTaskDeadlineText: '选择截止日期',
    currentTask: null,
    showPointsDialog: false,
    pointsForm: {
      taskId: null,
      rewardPoints: '',
      punishPoints: ''
    },
    showDeadlineDialog: false,
    deadlineForm: {
      taskId: null,
      deadlineDate: ''
    },
    deadlineDateText: '选择截止日期'
  },

  onShow() {
    this.fetchCurrentTasks()
  },

  switchView(event) {
    this.setCurrentView(event.currentTarget.dataset.view)
  },

  onSwiperChange(event) {
    this.setCurrentView(viewKeys[event.detail.current])
  },

  setCurrentView(view) {
    const nextView = view || 'recent'
    const swiperCurrent = viewKeys.indexOf(nextView)
    this.setData({
      currentView: nextView,
      swiperCurrent: swiperCurrent < 0 ? 0 : swiperCurrent
    })
    this.fetchCurrentTasks()
  },

  fetchCurrentTasks() {
    if (this.data.currentView === 'recent') return this.fetchRecentTasks()
    if (this.data.currentView === 'inbox') return this.fetchInboxTasks()
    return this.fetchDoneTasks()
  },

  async fetchRecentTasks() {
    this.setData({ loading: true })
    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 7)
      const res = await http.post('/points-service/points/task/basics/list', {
        endDeadlineDate: formatDate(endDate),
        sortDeadline: true
      })
      this.setData({ taskList: (res.data || []).map(normalizeTask) })
    } catch (error) {
      wx.showToast({ title: '获取任务失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async fetchInboxTasks() {
    this.setData({ loading: true })
    try {
      const res = await http.post('/points-service/points/task/basics/list', {
        taskGroupId: 0,
        sortDeadline: true
      })
      this.setData({ taskList: (res.data || []).map(normalizeTask) })
    } catch (error) {
      wx.showToast({ title: '获取任务失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async fetchDoneTasks() {
    this.setData({ loading: true })
    try {
      const res = await http.get('/points-service/points/task/basics/doneList')
      this.setData({ taskList: (res.data || []).map(normalizeTask) })
    } catch (error) {
      wx.showToast({ title: '获取任务失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onTaskNameInput(event) {
    this.setData({ newTaskName: event.detail.value })
  },

  onDateChange(event) {
    this.setData({
      newTaskDeadline: event.detail.value,
      newTaskDeadlineText: event.detail.value || '选择截止日期'
    })
  },

  async addTask() {
    if (!this.data.newTaskName) return
    try {
      await http.post('/points-service/points/task/basics/add', {
        taskGroupId: 0,
        taskName: this.data.newTaskName,
        deadlineDate: this.data.newTaskDeadline
      })
      this.setData({
        newTaskName: '',
        newTaskDeadline: '',
        newTaskDeadlineText: '选择截止日期'
      })
      this.fetchCurrentTasks()
      wx.showToast({ title: '添加成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  findTask(taskId) {
    return this.data.taskList.find((task) => String(task.id) === String(taskId))
  },

  showActionSheet(event) {
    const task = this.findTask(event.currentTarget.dataset.id)
    if (!task) return

    const itemList = []
    if (this.data.currentView === 'done') {
      itemList.push('取消完成')
    } else {
      if (task.taskStatus === 0) itemList.push('完成')
      itemList.push(task.isTop === 1 ? '取消置顶' : '置顶')
      itemList.push('设置积分')
      itemList.push('设置截止日期')
      itemList.push('删除')
    }

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = itemList[res.tapIndex]
        if (action === '取消完成') this.cancelCompleteTask(task)
        if (action === '完成') this.completeTask(task)
        if (action === '置顶' || action === '取消置顶') this.toggleTaskTop(task)
        if (action === '设置积分') this.openPointsDialog(task)
        if (action === '设置截止日期') this.openDeadlineDialog(task)
        if (action === '删除') this.showDeleteConfirm(task)
      }
    })
  },

  showDeleteConfirm(task) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该任务吗？',
      success: (res) => {
        if (res.confirm) this.deleteTask(task)
      }
    })
  },

  async completeTask(task) {
    await this.updateTaskStatus(task, 1, '已完成')
  },

  async cancelCompleteTask(task) {
    await this.updateTaskStatus(task, 0, '已取消完成')
  },

  async deleteTask(task) {
    await this.updateTaskStatus(task, 3, '已删除')
  },

  async updateTaskStatus(task, taskStatus, successTitle) {
    try {
      await http.put('/points-service/points/task/basics/updateStatus', {
        id: task.id,
        taskStatus
      })
      this.fetchCurrentTasks()
      wx.showToast({ title: successTitle, icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async toggleTaskTop(task) {
    try {
      const isTop = task.isTop === 1 ? 0 : 1
      await http.put('/points-service/points/task/basics/updateTaskParam', {
        id: task.id,
        isTop
      })
      this.fetchCurrentTasks()
      wx.showToast({ title: isTop === 1 ? '已置顶' : '已取消置顶', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async openPointsDialog(task) {
    try {
      const res = await http.get('/points-service/points/task/relation/getByTaskId', { taskId: task.id })
      this.setData({
        showPointsDialog: true,
        pointsForm: {
          taskId: task.id,
          rewardPoints: res.data && res.data.rewardPoints ? String(res.data.rewardPoints) : '',
          punishPoints: res.data && res.data.punishPoints ? String(res.data.punishPoints) : ''
        }
      })
    } catch (error) {
      wx.showToast({ title: '获取积分失败', icon: 'none' })
    }
  },

  onRewardPointsInput(event) {
    this.setData({ 'pointsForm.rewardPoints': event.detail.value })
  },

  onPunishPointsInput(event) {
    this.setData({ 'pointsForm.punishPoints': event.detail.value })
  },

  closePointsDialog() {
    this.setData({
      showPointsDialog: false,
      pointsForm: { taskId: null, rewardPoints: '', punishPoints: '' }
    })
  },

  async savePoints() {
    const { taskId, rewardPoints, punishPoints } = this.data.pointsForm
    if (rewardPoints && (!Number.isInteger(Number(rewardPoints)) || Number(rewardPoints) < 0)) {
      wx.showToast({ title: '奖励积分必须为正整数', icon: 'none' })
      return
    }
    if (punishPoints && (!Number.isInteger(Number(punishPoints)) || Number(punishPoints) < 0)) {
      wx.showToast({ title: '处罚积分必须为正整数', icon: 'none' })
      return
    }

    try {
      await http.post('/points-service/points/task/relation/save', {
        taskId,
        rewardPoints: rewardPoints ? Number(rewardPoints) : 0,
        punishPoints: punishPoints ? Number(punishPoints) : 0
      })
      this.closePointsDialog()
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  openDeadlineDialog(task) {
    this.setData({
      showDeadlineDialog: true,
      deadlineForm: {
        taskId: task.id,
        deadlineDate: task.deadlineDate || ''
      },
      deadlineDateText: task.deadlineDate || '选择截止日期'
    })
  },

  onDeadlineDateChange(event) {
    this.setData({
      'deadlineForm.deadlineDate': event.detail.value,
      deadlineDateText: event.detail.value || '选择截止日期'
    })
  },

  closeDeadlineDialog() {
    this.setData({
      showDeadlineDialog: false,
      deadlineForm: { taskId: null, deadlineDate: '' },
      deadlineDateText: '选择截止日期'
    })
  },

  async saveDeadline() {
    try {
      await http.put('/points-service/points/task/basics/updateTaskParam', {
        id: this.data.deadlineForm.taskId,
        deadlineDate: this.data.deadlineForm.deadlineDate
      })
      this.closeDeadlineDialog()
      this.fetchCurrentTasks()
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  navigateToDetail(event) {
    wx.navigateTo({
      url: `/pagesPoints/task/task-edit-detail?taskId=${event.currentTarget.dataset.id}`
    })
  }
})
