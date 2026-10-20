const pointsApi = require('../../api/points')
const utils = require('../../utils/bookkeeping')
const taskBookkeeping = require('../../utils/task-bookkeeping')

const planCycleOptions = [
  { value: 1, text: '每日' },
  { value: 2, text: '每周' },
  { value: 3, text: '每月' },
  { value: 4, text: '每年' },
  { value: 5, text: '自定义' }
]

function defaultForm() {
  return {
    taskName: '',
    taskRemark: '',
    planCycle: 1,
    planDate: utils.today(),
    cycleDays: '',
    remindDays: '',
    deadlineDays: '',
    rewardPoints: '',
    punishPoints: '',
    bookkeepingEnabled: false,
    bookkeepingTemplate: null
  }
}

Page({
  data: {
    saving: false,
    templateSummary: '',
    templateTypeName: '',
    hasBookkeepingConfig: false,
    isEdit: false,
    taskId: '',
    formData: defaultForm(),
    planCycleOptions,
    planCycleIndex: 0,
    planCycleName: '每日'
  },

  onLoad(options = {}) {
    if (options.id) {
      this.setData({ isEdit: true, taskId: options.id })
      this.loadTaskDetail()
    }
  },

  async loadTaskDetail() {
    const res = await pointsApi.getTaskPlanDetail(this.data.taskId)
    const detail = res.data || {}
    const planCycleIndex = this.data.planCycleOptions.findIndex((item) => Number(item.value) === Number(detail.planCycle))
    const option = this.data.planCycleOptions[planCycleIndex >= 0 ? planCycleIndex : 0]
    this.setData({
      hasBookkeepingConfig: Object.prototype.hasOwnProperty.call(detail, 'bookkeepingEnabled'),
      templateSummary: taskBookkeeping.templateSummary(detail.bookkeepingTemplate),
      templateTypeName: taskBookkeeping.parseTemplate(detail.bookkeepingTemplate) ? taskBookkeeping.parseTemplate(detail.bookkeepingTemplate).recordTypeName || '待确认' : '',
      formData: {
        ...defaultForm(),
        ...detail,
        bookkeepingEnabled: Boolean(detail.bookkeepingEnabled),
        planDate: String(detail.planDate || utils.today()).split(' ')[0],
        cycleDays: detail.cycleDays == null ? '' : detail.cycleDays,
        remindDays: detail.remindDays == null ? '' : detail.remindDays,
        deadlineDays: detail.deadlineDays == null ? '' : detail.deadlineDays,
        rewardPoints: detail.rewardPoints == null ? '' : detail.rewardPoints,
        punishPoints: detail.punishPoints == null ? '' : detail.punishPoints
      },
      planCycleIndex: option ? this.data.planCycleOptions.indexOf(option) : 0,
      planCycleName: option ? option.text : '每日'
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  onPlanCycleChange(event) {
    const planCycleIndex = Number(event.detail.value)
    const option = this.data.planCycleOptions[planCycleIndex]
    this.setData({
      planCycleIndex,
      planCycleName: option ? option.text : '',
      'formData.planCycle': option ? option.value : 1,
      'formData.cycleDays': option && option.value === 5 ? this.data.formData.cycleDays : ''
    })
  },

  onPlanDateChange(event) {
    this.setData({ 'formData.planDate': event.detail.value })
  },

  onBookkeepingChange(event) {
    this.setData({ hasBookkeepingConfig: true, 'formData.bookkeepingEnabled': Boolean(event.detail.value) })
  },

  editBookkeepingTemplate() {
    wx.navigateTo({
      url: '/pagesBookkeeping/bookkeeping/bookkeeping-action?mode=template',
      events: {
        templateSaved: (template) => this.setData({
          hasBookkeepingConfig: true,
          'formData.bookkeepingTemplate': taskBookkeeping.parseTemplate(template),
          templateSummary: taskBookkeeping.templateSummary(template),
          templateTypeName: taskBookkeeping.parseTemplate(template).recordTypeName || utils.getOptionName(taskBookkeeping.parseTemplate(template).recordTypeId, '未分类')
        })
      },
      success: (res) => res.eventChannel.emit('templateInit', this.data.formData.bookkeepingTemplate)
    })
  },

  validateForm() {
    const form = this.data.formData
    if (!String(form.taskName || '').trim()) return '请输入任务名称'
    if (form.bookkeepingEnabled && !form.bookkeepingTemplate) return '请设置记账模板'
    if (!form.planCycle) return '请选择计划周期'
    if (!form.planDate) return '请选择计划日期'
    if (Number(form.planCycle) === 5 && !form.cycleDays) return '请输入计划天数'
    return ''
  },

  toNumberOrZero(value) {
    return value == null || value === '' ? 0 : Number(value)
  },

  async handleSubmit() {
    if (this.data.saving) return
    const message = this.validateForm()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }

    const form = this.data.formData
    const { bookkeepingEnabled, bookkeepingTemplate, ...legacyForm } = form
    const submitData = {
      ...legacyForm,
      taskName: String(form.taskName).trim(),
      planCycle: Number(form.planCycle),
      planDate: String(form.planDate).split(' ')[0],
      cycleDays: Number(form.planCycle) === 5 ? this.toNumberOrZero(form.cycleDays) : null,
      remindDays: this.toNumberOrZero(form.remindDays),
      deadlineDays: this.toNumberOrZero(form.deadlineDays),
      rewardPoints: this.toNumberOrZero(form.rewardPoints),
      punishPoints: this.toNumberOrZero(form.punishPoints),
      ...(this.data.isEdit && !this.data.hasBookkeepingConfig ? {} : {
        bookkeepingEnabled: Boolean(form.bookkeepingEnabled),
        bookkeepingTemplate: form.bookkeepingEnabled ? taskBookkeeping.templateFields(form.bookkeepingTemplate) : null
      })
    }

    this.setData({ saving: true })
    try {
      if (this.data.isEdit) {
        submitData.id = this.data.taskId
        await pointsApi.updateTaskPlan(submitData)
      } else {
        await pointsApi.addTaskPlan(submitData)
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } finally {
      this.setData({ saving: false })
    }
  },

  handleCancel() {
    wx.navigateBack()
  }
})
