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
    calendarType: 'SOLAR',
    lunarYear: null,
    lunarMonth: null,
    lunarDay: null,
    leapMonth: false,
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
    loading: false,
    loadError: '',
    converting: false,
    calendarLoading: false,
    calendarError: '',
    years: Array.from({ length: 199 }, (_, i) => 1901 + i),
    yearIndex: 0,
    lunarMonths: [],
    lunarDays: [],
    lunarMonthIndex: 0,
    lunarDayIndex: 0,
    lunarMonthText: '请选择',
    lunarDayText: '请选择',
    preview: null,
    previewLoading: false,
    previewError: '',
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
    } else {
      this.refreshPreview()
    }
  },

  async loadTaskDetail() {
    this.setData({ loading: true, loadError: '' })
    try {
    const res = await pointsApi.getTaskPlanDetail(this.data.taskId)
    if (this._unloaded) return
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
        calendarType: detail.calendarType || 'SOLAR',
        planDate: String(detail.anchorDate || detail.planDate || utils.today()).split(' ')[0],
        cycleDays: detail.cycleDays == null ? '' : detail.cycleDays,
        remindDays: detail.remindDays == null ? '' : detail.remindDays,
        deadlineDays: detail.deadlineDays == null ? '' : detail.deadlineDays,
        rewardPoints: detail.rewardPoints == null ? '' : detail.rewardPoints,
        punishPoints: detail.punishPoints == null ? '' : detail.punishPoints
      },
      planCycleIndex: option ? this.data.planCycleOptions.indexOf(option) : 0,
      planCycleName: option ? option.text : '每日'
    })
    if (this.data.formData.calendarType === 'LUNAR') await this.loadCalendar()
    await this.refreshPreview()
    } catch (error) {
      if (!this._unloaded) this.setData({ loadError: '计划加载失败，点击重试' })
    } finally {
      if (!this._unloaded) this.setData({ loading: false })
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    if (this.data.saving || this.data.loading || this.data.converting) return
    this.setData({ [`formData.${field}`]: event.detail.value })
    if (['cycleDays', 'remindDays', 'deadlineDays'].includes(field)) this.queuePreview()
  },

  onPlanCycleChange(event) {
    if (this.data.saving || this.data.loading || this.data.converting) return
    const planCycleIndex = Number(event.detail.value)
    const option = this.data.planCycleOptions[planCycleIndex]
    this.setData({
      planCycleIndex,
      planCycleName: option ? option.text : '',
      'formData.planCycle': option ? option.value : 1,
      'formData.cycleDays': option && option.value === 5 ? this.data.formData.cycleDays : ''
    })
    this.refreshPreview()
  },

  onPlanDateChange(event) {
    if (this.data.saving || this.data.loading || this.data.converting) return
    this.setData({ 'formData.planDate': event.detail.value })
    this.refreshPreview()
  },

  onUnload() {
    this._unloaded = true
    this._previewSeq = (this._previewSeq || 0) + 1
    this._calendarSeq = (this._calendarSeq || 0) + 1
    clearTimeout(this._previewTimer)
  },

  schedulePayload() {
    const f = this.data.formData
    return {
      ...(this.data.isEdit ? { id: Number(this.data.taskId) } : {}),
      calendarType: f.calendarType,
      planDate: f.planDate,
      planCycle: Number(f.planCycle),
      lunarYear: f.lunarYear, lunarMonth: f.lunarMonth, lunarDay: f.lunarDay,
      leapMonth: Boolean(f.leapMonth),
      cycleDays: Number(f.planCycle) === 5 ? Number(f.cycleDays) : null,
      remindDays: this.toNumberOrZero(f.remindDays),
      deadlineDays: this.toNumberOrZero(f.deadlineDays)
    }
  },

  scheduleError() {
    const f = this.data.formData
    if (f.calendarType === 'LUNAR' && (!f.lunarYear || !f.lunarMonth || !f.lunarDay)) return '请选择完整的农历年月日'
    if (f.calendarType === 'SOLAR' && !f.planDate) return '请选择计划日期'
    if (Number(f.planCycle) === 5 && (!Number.isInteger(Number(f.cycleDays)) || Number(f.cycleDays) < 1 || Number(f.cycleDays) > 65535)) return '计划天数需为1至65535的整数'
    for (const field of ['remindDays', 'deadlineDays']) {
      const value = this.toNumberOrZero(f[field])
      if (!Number.isInteger(value) || value < 0 || value > 65535) return '天数需为0至65535的整数'
    }
    return ''
  },

  queuePreview() {
    clearTimeout(this._previewTimer)
    this._previewSeq = (this._previewSeq || 0) + 1
    this.setData({ preview: null, previewLoading: false, previewError: '' })
    this._previewTimer = setTimeout(() => this.refreshPreview(), 300)
  },

  async refreshPreview() {
    clearTimeout(this._previewTimer)
    const seq = this._previewSeq = (this._previewSeq || 0) + 1
    const error = this.scheduleError()
    this.setData({ preview: null, previewError: error, previewLoading: !error })
    if (error) return
    try {
      const res = await pointsApi.previewTaskPlan(this.schedulePayload())
      if (this._unloaded || seq !== this._previewSeq) return
      const preview = res.data
      this.setData({ preview, ...(preview ? { 'formData.planDate': preview.anchorDate } : {}) })
    } catch (error) {
      if (!this._unloaded && seq === this._previewSeq) this.setData({ previewError: '计划预览失败，点击重试' })
    } finally {
      if (!this._unloaded && seq === this._previewSeq) this.setData({ previewLoading: false })
    }
  },

  async changeCalendar(event) {
    const type = event.currentTarget.dataset.value
    if (type === this.data.formData.calendarType || this.data.saving || this.data.loading || this.data.converting || this.data.calendarLoading) return
    if (type === 'SOLAR' && this.scheduleError() === '请选择完整的农历年月日') {
      wx.showToast({ title: '请先选完整的农历日期', icon: 'none' }); return
    }
    this._previewSeq = (this._previewSeq || 0) + 1
    clearTimeout(this._previewTimer)
    this.setData({ converting: true, preview: null, previewLoading: false, previewError: '' })
    try {
      const res = await pointsApi.convertTaskPlanDate(this.schedulePayload())
      if (this._unloaded) return
      const date = res.data
      this.setData({
        'formData.calendarType': type, 'formData.planDate': date.solarDate,
        'formData.lunarYear': date.lunarYear, 'formData.lunarMonth': date.lunarMonth,
        'formData.lunarDay': date.lunarDay, 'formData.leapMonth': date.leapMonth,
        calendarError: ''
      })
      if (type === 'LUNAR') await this.loadCalendar()
      await this.refreshPreview()
    } catch (error) {
      if (!this._unloaded) this.setData({ previewError: '日期转换失败，请检查日期后重试' })
    } finally {
      if (!this._unloaded) this.setData({ converting: false })
    }
  },

  async loadCalendar() {
    const seq = this._calendarSeq = (this._calendarSeq || 0) + 1
    this._previewSeq = (this._previewSeq || 0) + 1
    clearTimeout(this._previewTimer)
    this.setData({ calendarLoading: true, calendarError: '', preview: null, previewLoading: false })
    try {
      const year = Number(this.data.formData.lunarYear)
      const res = await pointsApi.getTaskPlanCalendar(year)
      if (this._unloaded || seq !== this._calendarSeq || this.data.formData.calendarType !== 'LUNAR') return
      const months = res.data || [], f = this.data.formData
      const index = months.findIndex(m => m.month === Number(f.lunarMonth) && m.leap === Boolean(f.leapMonth))
      this.setData({ lunarMonths: months, yearIndex: year - 1901 })
      this.syncLunarDays(index)
    } catch (error) {
      if (!this._unloaded && seq === this._calendarSeq) this.setData({ calendarError: '农历日期加载失败，点击重试' })
    } finally {
      if (!this._unloaded && seq === this._calendarSeq) this.setData({ calendarLoading: false })
    }
  },

  syncLunarDays(index) {
    const month = this.data.lunarMonths[index], day = Number(this.data.formData.lunarDay)
    const days = month ? Array.from({ length: month.days }, (_, i) => i + 1) : []
    const valid = day >= 1 && day <= days.length
    this.setData({ lunarMonthIndex: Math.max(index, 0), lunarDayIndex: valid ? day - 1 : 0,
      lunarMonthText: month ? month.label : '请选择', lunarDayText: valid ? day + '日' : '请选择', lunarDays: days,
      'formData.lunarMonth': month ? month.month : null, 'formData.leapMonth': month ? month.leap : false,
      'formData.lunarDay': valid ? day : null })
  },

  async chooseLunarYear(event) {
    if (this.data.saving || this.data.converting || this.data.calendarLoading) return
    this.setData({ 'formData.lunarYear': this.data.years[Number(event.detail.value)] })
    await this.loadCalendar()
    this.refreshPreview()
  },

  chooseLunarMonth(event) {
    if (this.data.saving || this.data.converting || this.data.calendarLoading || this.data.calendarError) return
    this.syncLunarDays(Number(event.detail.value))
    this.refreshPreview()
  },

  chooseLunarDay(event) {
    if (this.data.saving || this.data.converting || this.data.calendarLoading || this.data.calendarError) return
    const day = this.data.lunarDays[Number(event.detail.value)]
    this.setData({ 'formData.lunarDay': day, lunarDayIndex: day - 1, lunarDayText: day + '日' })
    this.refreshPreview()
  },

  onBookkeepingChange(event) {
    if (this.data.saving || this.data.loading || this.data.converting) return
    this.setData({ hasBookkeepingConfig: true, 'formData.bookkeepingEnabled': Boolean(event.detail.value) })
  },

  editBookkeepingTemplate() {
    if (this.data.saving || this.data.loading || this.data.converting) return
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
    const error = this.scheduleError()
    if (error) return error
    if (this.data.calendarError) return '请先重新加载农历日期'
    if (Number(form.planCycle) === 5 && !form.cycleDays) return '请输入计划天数'
    return ''
  },

  toNumberOrZero(value) {
    return value == null || value === '' ? 0 : Number(value)
  },

  async handleSubmit() {
    if (this.data.saving || this.data.loading || this.data.loadError || this.data.converting || this.data.calendarLoading) return
    const message = this.validateForm()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }

    const form = this.data.formData
    const submitData = {
      ...this.schedulePayload(),
      taskRemark: form.taskRemark,
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

    clearTimeout(this._previewTimer)
    this._previewSeq = (this._previewSeq || 0) + 1
    this.setData({ saving: true })
    try {
      if (this.data.isEdit) {
        submitData.id = this.data.taskId
        await pointsApi.updateTaskPlan(submitData)
      } else {
        await pointsApi.addTaskPlan(submitData)
      }
      if (this._unloaded) return
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } finally {
      if (!this._unloaded) this.setData({ saving: false })
    }
  },

  handleCancel() {
    wx.navigateBack()
  }
})
