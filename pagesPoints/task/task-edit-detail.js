const pointsApi = require('../../api/points')

Page({
  data: {
    loading: true,
    saving: false,
    error: '',
    taskId: '',
    taskDetail: {
      id: null,
      taskName: '',
      taskRemark: ''
    }
  },

  onLoad(options = {}) {
    const taskId = options.taskId || options.id || ''
    this.setData({ taskId })
    this.fetchTaskDetail()
  },

  async fetchTaskDetail() {
    if (!this.data.taskId) {
      this.setData({ loading: false, error: '无效的任务ID' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const res = await pointsApi.getTaskBasicsDetail(this.data.taskId)
      this.setData({ taskDetail: res.data || {}, loading: false })
    } catch (error) {
      this.setData({ loading: false, error: '加载任务详情失败' })
    }
  },

  onTaskNameInput(event) {
    this.setData({ 'taskDetail.taskName': event.detail.value })
  },

  onRemarkInput(event) {
    this.setData({ 'taskDetail.taskRemark': event.detail.value })
  },

  async saveTask() {
    if (this.data.saving || !this.data.taskDetail.id) return
    const taskName = String(this.data.taskDetail.taskName || '').trim()
    if (!taskName) {
      wx.showToast({ title: '请输入任务名称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await pointsApi.updateTaskParam({
        id: this.data.taskDetail.id,
        taskName,
        taskRemark: this.data.taskDetail.taskRemark || ''
      })
      this.setData({ 'taskDetail.taskName': taskName })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
