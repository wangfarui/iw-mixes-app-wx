const pointsApi = require('../../api/points')

function defaultForm() {
  return {
    id: null,
    taskName: '',
    taskPoints: '',
    taskRemark: ''
  }
}

function formatTask(item) {
  const taskPoints = Number(item.taskPoints || 0)
  return {
    ...item,
    taskPoints,
    taskNameText: item.taskName || '未命名任务',
    pointsClass: taskPoints >= 0 ? 'positive' : 'negative',
    pointsText: `${taskPoints > 0 ? '+' : ''}${taskPoints}`
  }
}

Page({
  data: {
    taskList: [],
    filteredTaskList: [],
    filterKeyword: '',
    showModal: false,
    isEdit: false,
    formData: defaultForm()
  },

  onShow() {
    this.getTaskList()
  },

  async getTaskList() {
    const res = await pointsApi.getFixedTaskList()
    this.setData({ taskList: (res.data || []).map(formatTask) })
    this.applyFilter()
  },

  onFilterInput(event) {
    this.setData({ filterKeyword: event.detail.value })
    this.applyFilter()
  },

  applyFilter() {
    const keyword = String(this.data.filterKeyword || '').trim()
    const filteredTaskList = keyword
      ? this.data.taskList.filter((item) => String(item.taskName || '').includes(keyword))
      : this.data.taskList
    this.setData({ filteredTaskList })
  },

  openAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      formData: defaultForm()
    })
  },

  closeModal() {
    this.setData({ showModal: false, formData: defaultForm() })
  },

  handleFormInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  openActions(event) {
    const item = this.data.filteredTaskList[Number(event.currentTarget.dataset.index)]
    if (!item) return
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) this.openEditModal(item)
        if (res.tapIndex === 1) this.deleteTask(item)
      }
    })
  },

  openEditModal(item) {
    this.setData({
      showModal: true,
      isEdit: true,
      formData: {
        id: item.id,
        taskName: item.taskName || '',
        taskPoints: item.taskPoints,
        taskRemark: item.taskRemark || ''
      }
    })
  },

  async saveTask() {
    const form = this.data.formData
    const taskPoints = Number(form.taskPoints)
    if (!String(form.taskName || '').trim() || !Number.isFinite(taskPoints)) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    const payload = {
      taskName: String(form.taskName).trim(),
      taskPoints,
      taskRemark: form.taskRemark || ''
    }
    if (this.data.isEdit) payload.id = form.id

    if (this.data.isEdit) {
      await pointsApi.updateFixedTask(payload)
    } else {
      await pointsApi.addFixedTask(payload)
    }
    wx.showToast({ title: this.data.isEdit ? '修改成功' : '添加成功', icon: 'success' })
    this.closeModal()
    this.getTaskList()
  },

  deleteTask(item) {
    wx.showModal({
      title: '提示',
      content: '确定要删除该任务吗？',
      success: async (res) => {
        if (!res.confirm) return
        await pointsApi.deleteFixedTask(item.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.getTaskList()
      }
    })
  },

  async submitTask(event) {
    await pointsApi.submitFixedTask(event.currentTarget.dataset.id)
    wx.showToast({ title: '提交成功', icon: 'success' })
    this.getTaskList()
  },

  noop() {}
})
