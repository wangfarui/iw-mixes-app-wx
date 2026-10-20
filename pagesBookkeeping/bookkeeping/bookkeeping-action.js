const optionsStore = require('../../stores/bookkeeping-options')
const bookkeepingApi = require('../../api/bookkeeping')
const payer = require('../../utils/bookkeeping-payer')
const bookkeepingUtils = require('../../utils/bookkeeping')
const taskBookkeeping = require('../../utils/task-bookkeeping')
const pointsApi = require('../../api/points')
const familyStore = require('../../stores/family')
const sharedScopeStore = require('../../stores/family-shared-scope')
const { uploadFile } = require('../../stores/file')
const { getIconUrl, getIconList } = require('../../utils/icon')

function defaultFormData(category, shared) {
  return {
    fileList: [],
    recordDate: bookkeepingUtils.today(),
    expenseUserId: payer.currentUserId(),
    recordCategory: category || 1,
    recordSource: '',
    amount: '',
    recordTypeId: null,
    remark: '',
    recordTags: [],
    isStatistics: 1,
    isExcitationRecord: 0,
    shared: shared || 0
  }
}

function chooseImage(sourceType, count, callback) {
  wx.chooseImage({
    count,
    sizeType: ['original', 'compressed'],
    sourceType,
    success(res) {
      ;(res.tempFilePaths || []).forEach(callback)
    }
  })
}

Page({
  ...payer.methods,
  data: {
    ...payer.data,
    isTemplateMode: false,
    templateTaskId: '',
    isUpdateForm: false,
    updateFormId: '',
    formData: defaultFormData(1, 0),
    isExcitationRecord: false,
    isNotStatistics: false,
    showSharedSwitch: false,
    isShared: false,
    recordTypeOptions: [],
    recordTypeIndex: 0,
    recordTypeName: '',
    tagOptions: [],
    selectedIconUrl: '',
    iconList: [],
    showIconPopup: false,
    showUploadPopup: false,
    todayRecords: [],
    todayConsume: '0.00',
    isSubmitting: false
  },

  onLoad(options = {}) {
    this.setData({
      isTemplateMode: options.mode === 'template',
      templateTaskId: options.taskId || '',
      isUpdateForm: Boolean(options.id),
      updateFormId: options.id || ''
    })
    if (this.data.isTemplateMode) {
      wx.setNavigationBarTitle({ title: '记账模板' })
      this.getOpenerEventChannel().on('templateInit', (template) => {
        this.initialTemplate = template
        this.applyTemplate(template)
      })
    }
    this._initializing = this.initPage().then(() => {
      if (!this.data.isTemplateMode) this.loadTodayConsume()
    }).catch(() => wx.showToast({ title: '家庭信息加载失败，请重新进入', icon: 'none' }))
  },

  async onShow() {
    this.setData({ recordTypeOptions: [], tagOptions: [] })
    if (this._initializing) await this._initializing
    try { await optionsStore.refresh() } catch (error) {}
    this.refreshOptions()
  },

  async ensureFamilyGroupLoaded() {
    await familyStore.ensureMyGroupLoaded()
  },

  async initPage() {
    await this.ensureFamilyGroupLoaded()
    await optionsStore.refresh()
    await this.initPayerSelector()
    const scopeState = sharedScopeStore.getScopeState()
    this.setData({
      showSharedSwitch: Boolean(scopeState.canControlRecordShared)
    })

    if (this.data.isTemplateMode) {
      this.applyTemplate(this.initialTemplate)
    } else if (this.data.isUpdateForm) {
      await this.loadDetail()
    } else {
      this.setData({
        formData: defaultFormData(1, sharedScopeStore.getDefaultRecordShared())
      })
      this.refreshOptions()
      this.refreshSwitchState()
    }
  },

  applyTemplate(template) {
    this.setData({
      formData: {
        ...defaultFormData(1, sharedScopeStore.getDefaultRecordShared()),
        ...(template ? taskBookkeeping.templateFields(template) : {}),
        recordTypeName: template && template.recordTypeName || '',
        recordTagSnapshots: template && template.recordTagSnapshots || []
      },
      isExcitationRecord: Boolean(template && Number(template.isExcitationRecord) === 1),
      isNotStatistics: Boolean(template && Number(template.isStatistics) === 0)
    })
    this.refreshOptions()
    this.refreshSwitchState()
  },

  async loadDetail() {
    try {
      const res = await bookkeepingApi.getRecordDetail(this.data.updateFormId)
      const detail = res.data || {}
      if (detail.canEdit === false) {
        wx.showToast({
          title: '不能修改他人记账记录',
          icon: 'none'
        })
        setTimeout(() => wx.navigateBack(), 600)
        return
      }
      this.setData({
        formData: {
          ...defaultFormData(Number(detail.recordCategory) || 1, 0),
          ...detail,
          shared: Number(detail.shared) === 1 ? 1 : 0,
          recordTags: (detail.recordTagSnapshots || []).map((tag) => tag.id),
          fileList: detail.fileList || []
        },
        isExcitationRecord: Number(detail.isExcitationRecord) === 1,
        isNotStatistics: Number(detail.isStatistics) === 0
      })
      this._categoryChanged = false
      this._tagsChanged = false
      this.refreshOptions()
      this.refreshSwitchState()
    } catch (error) {}
  },

  refreshOptions() {
    const formData = this.data.formData
    const recordTypeOptions = (this.data.isUpdateForm || this.data.isTemplateMode) ? bookkeepingUtils.getEditorTypeOptions(formData) : bookkeepingUtils.getRecordTypeOptions(false)
    const foundIndex = recordTypeOptions.findIndex((item) => item.id === formData.recordTypeId)
    const recordTypeIndex = foundIndex >= 0 ? foundIndex : 0
    this.setData({
      recordTypeOptions,
      recordTypeIndex,
      recordTypeName: (this.data.isUpdateForm || this.data.isTemplateMode) && !this._categoryChanged ? bookkeepingUtils.getRecordTypeName(formData) : formData.recordTypeName || bookkeepingUtils.getOptionName(formData.recordTypeId),
      tagOptions: bookkeepingUtils.getEditorTagOptions(formData),
      selectedIconUrl: formData.recordIcon ? getIconUrl(formData.recordIcon) : '',
      iconList: getIconList(formData.recordIcon)
    })
  },

  refreshSwitchState() {
    this.syncPayerState()
    this.setData({
      isShared: Number(this.data.formData.shared) === 1
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: event.detail.value
    })
  },

  selectCategory(event) {
    const recordCategory = Number(event.currentTarget.dataset.category)
    if (recordCategory === Number(this.data.formData.recordCategory)) return
    this._tagsChanged = true
    this.setData({
      'formData.recordCategory': recordCategory,
      'formData.recordTags': [],
      isExcitationRecord: false,
      'formData.isExcitationRecord': 0
    })
    this.refreshOptions()
    this.refreshSwitchState()
  },

  onDateChange(event) {
    this.setData({
      'formData.recordDate': event.detail.value
    })
  },

  onRecordTypeChange(event) {
    const index = Number(event.detail.value)
    const item = this.data.recordTypeOptions[index]
    if (!item || item.historical) return
    this._categoryChanged = true
    this.setData({
      recordTypeIndex: index,
      recordTypeName: item.dictName,
      'formData.recordTypeId': item.id,
      'formData.recordTypeName': item.dictName
    })
  },

  switchExcitationRecord(event) {
    this.setData({
      isExcitationRecord: Boolean(event.detail.value),
      'formData.isExcitationRecord': event.detail.value ? 1 : 0
    })
  },

  switchNotStatistics(event) {
    this.setData({
      isNotStatistics: Boolean(event.detail.value),
      'formData.isStatistics': event.detail.value ? 0 : 1
    })
  },

  switchShared(event) {
    if (this.data.payerSharedLocked) return
    this.setData({
      isShared: Boolean(event.detail.value),
      'formData.shared': event.detail.value ? 1 : 0
    })
  },

  toggleTag(event) {
    this._tagsChanged = true
    const id = Number(event.currentTarget.dataset.id)
    const recordTags = (this.data.formData.recordTags || []).slice()
    const index = recordTags.indexOf(id)
    if (index >= 0) {
      recordTags.splice(index, 1)
    } else {
      recordTags.push(id)
    }
    this.setData({
      'formData.recordTags': recordTags,
      tagOptions: bookkeepingUtils.getEditorTagOptions({ ...this.data.formData, recordTags })
    })
  },

  showIconSelector() {
    this.setData({
      showIconPopup: true,
      iconList: getIconList(this.data.formData.recordIcon)
    })
  },

  closeIconSelector() {
    this.setData({ showIconPopup: false })
  },

  selectIcon(event) {
    const recordIcon = event.currentTarget.dataset.icon
    this.setData({
      'formData.recordIcon': recordIcon,
      selectedIconUrl: getIconUrl(recordIcon),
      iconList: getIconList(recordIcon),
      showIconPopup: false
    })
  },

  clearIcon() {
    this.setData({
      'formData.recordIcon': '',
      selectedIconUrl: '',
      iconList: getIconList('')
    })
  },

  async loadTodayConsume() {
    try {
      const res = await bookkeepingApi.getRecordList({ queryOnlyMyself: 1 })
      const records = res.data || []
      let consume = 0
      records.forEach((item) => {
        consume += Number(item.recordCategory) === 2 ? -Number(item.amount || 0) : Number(item.amount || 0)
      })
      this.setData({
        todayConsume: bookkeepingUtils.formatMoney(consume),
        todayRecords: records.map((item) => bookkeepingUtils.formatListRecord(item, { effectiveScope: 'myself' }))
      })
    } catch (error) {
      this.setData({ todayConsume: '0.00', todayRecords: [] })
    }
  },

  showUploadPopup() {
    this.setData({ showUploadPopup: true })
  },

  closeUploadPopup() {
    this.setData({ showUploadPopup: false })
  },

  takePhoto() {
    this.closeUploadPopup()
    chooseImage(['camera'], 1, (filePath) => this.uploadFileForBookkeepingFile(filePath))
  },

  chooseFromAlbum() {
    this.closeUploadPopup()
    chooseImage(['album'], 9, (filePath) => this.uploadFileForBookkeepingFile(filePath))
  },

  async uploadFileForBookkeepingFile(filePath) {
    wx.showLoading({ title: '上传中...' })
    try {
      const fileRes = await uploadFile(filePath)
      const fileList = (this.data.formData.fileList || []).slice()
      fileList.push({
        fileName: fileRes.fileName,
        fileUrl: fileRes.fileUrl
      })
      this.setData({ 'formData.fileList': fileList })
    } finally {
      wx.hideLoading()
    }
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({
      current,
      urls: (this.data.formData.fileList || []).map((file) => file.fileUrl)
    })
  },

  deleteFile(event) {
    const index = Number(event.currentTarget.dataset.index)
    const fileList = (this.data.formData.fileList || []).slice()
    fileList.splice(index, 1)
    this.setData({ 'formData.fileList': fileList })
  },

  noop() {},

  async saveRecord() {
    const formData = this.data.formData
    if (formData.amount === undefined || formData.amount === '') {
      wx.showToast({ title: '记账金额不能为空', icon: 'none' })
      return
    }
    if (!Number.isFinite(Number(formData.amount)) || Number(formData.amount) <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(formData.amount))) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (this.data.isSubmitting) return

    this.setData({ isSubmitting: true })
    try {
      const submitData = {
        ...formData,
        amount: Number(formData.amount),
        isExcitationRecord: this.data.isExcitationRecord ? 1 : 0,
        isStatistics: this.data.isNotStatistics ? 0 : 1,
        shared: this.data.isShared ? 1 : 0
      }

      if (this.data.isTemplateMode) {
        const template = taskBookkeeping.templateFields(submitData)
        if (this.data.templateTaskId) {
          await pointsApi.updateTaskBookkeepingTemplate({ id: this.data.templateTaskId, bookkeepingTemplate: template })
        }
        this.getOpenerEventChannel().emit('templateSaved', template)
        wx.navigateBack()
        return
      }

      delete submitData.recordType
      if (this.data.isUpdateForm) {
        submitData.dictionaryChanges = {}
        if (this._categoryChanged) submitData.dictionaryChanges.categoryId = submitData.recordTypeId || null
        if (this._tagsChanged) submitData.dictionaryChanges.tagIds = submitData.recordTags || []
        delete submitData.recordTypeId
        delete submitData.recordTags
        await bookkeepingApi.updateRecord(submitData)
      } else {
        await bookkeepingApi.addRecord(submitData)
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })

      if (this.data.isUpdateForm) {
        const saved = await bookkeepingApi.getRecordDetail(this.data.updateFormId)
        this.getOpenerEventChannel().emit('recordSaved', saved.data || {})
        setTimeout(() => wx.navigateBack(), 500)
      } else {
        this.setData({
          formData: defaultFormData(this.data.formData.recordCategory, sharedScopeStore.getDefaultRecordShared()),
          isExcitationRecord: false,
          isNotStatistics: false
        })
        this._sharedBeforePayer = undefined
        this.refreshOptions()
        this.refreshSwitchState()
        this.loadTodayConsume()
      }
    } catch (error) {
    } finally {
      this.setData({ isSubmitting: false })
    }
  }
})
