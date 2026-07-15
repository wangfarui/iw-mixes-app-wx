const bookkeepingApi = require('../../api/bookkeeping')
const bookkeepingUtils = require('../../utils/bookkeeping')
const familyStore = require('../../stores/family')
const sharedScopeStore = require('../../stores/family-shared-scope')
const { uploadFile } = require('../../stores/file')
const { getIconUrl, getIconList } = require('../../utils/icon')

function defaultFormData(category, shared) {
  return {
    fileList: [],
    recordDate: bookkeepingUtils.today(),
    recordCategory: category || 1,
    recordSource: '',
    amount: '',
    recordType: '',
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
  data: {
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

  onLoad(options) {
    this.setData({
      isUpdateForm: Boolean(options.id),
      updateFormId: options.id || ''
    })
    this.initPage()
    this.loadTodayConsume()
  },

  async ensureFamilyGroupLoaded() {
    if (familyStore.getMyGroupState() || wx.getStorageSync('myGroup')) return
    await familyStore.fetchMyGroup()
  },

  async initPage() {
    await this.ensureFamilyGroupLoaded()
    const scopeState = sharedScopeStore.getScopeState()
    this.setData({
      showSharedSwitch: Boolean(scopeState.canControlRecordShared)
    })

    if (this.data.isUpdateForm) {
      await this.loadDetail()
    } else {
      this.setData({
        formData: defaultFormData(1, sharedScopeStore.getDefaultRecordShared())
      })
      this.refreshOptions()
      this.refreshSwitchState()
    }
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
          recordTags: detail.recordTags || [],
          fileList: detail.fileList || []
        },
        isExcitationRecord: Number(detail.isExcitationRecord) === 1,
        isNotStatistics: Number(detail.isStatistics) === 0
      })
      this.refreshOptions()
      this.refreshSwitchState()
    } catch (error) {}
  },

  refreshOptions() {
    const formData = this.data.formData
    const recordTypeOptions = bookkeepingUtils.getRecordTypeOptions(false)
    const foundIndex = recordTypeOptions.findIndex((item) => item.dictCode === formData.recordType)
    const recordTypeIndex = foundIndex >= 0 ? foundIndex : 0
    this.setData({
      recordTypeOptions,
      recordTypeIndex,
      recordTypeName: formData.recordType ? bookkeepingUtils.getRecordTypeName(formData.recordType, '') : '',
      tagOptions: bookkeepingUtils.getTagOptions(formData.recordCategory, formData.recordTags || []),
      selectedIconUrl: formData.recordIcon ? getIconUrl(formData.recordIcon) : '',
      iconList: getIconList(formData.recordIcon)
    })
  },

  refreshSwitchState() {
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
    this.setData({
      'formData.recordCategory': recordCategory,
      'formData.recordTags': [],
      isExcitationRecord: false,
      'formData.isExcitationRecord': 0
    })
    this.refreshOptions()
  },

  onDateChange(event) {
    this.setData({
      'formData.recordDate': event.detail.value
    })
  },

  onRecordTypeChange(event) {
    const index = Number(event.detail.value)
    const item = this.data.recordTypeOptions[index]
    if (!item) return
    this.setData({
      recordTypeIndex: index,
      recordTypeName: item.dictName,
      'formData.recordType': item.dictCode
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
    this.setData({
      isShared: Boolean(event.detail.value),
      'formData.shared': event.detail.value ? 1 : 0
    })
  },

  toggleTag(event) {
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
      tagOptions: bookkeepingUtils.getTagOptions(this.data.formData.recordCategory, recordTags)
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
    if (Number(formData.amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (!formData.recordType) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
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

      if (this.data.isUpdateForm) {
        await bookkeepingApi.updateRecord(submitData)
      } else {
        await bookkeepingApi.addRecord(submitData)
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })

      if (this.data.isUpdateForm) {
        setTimeout(() => wx.navigateBack(), 500)
      } else {
        this.setData({
          formData: defaultFormData(this.data.formData.recordCategory, sharedScopeStore.getDefaultRecordShared()),
          isExcitationRecord: false,
          isNotStatistics: false
        })
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
