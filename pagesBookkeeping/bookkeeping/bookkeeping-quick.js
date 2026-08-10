const bookkeepingApi = require('../../api/bookkeeping')
const bookkeepingUtils = require('../../utils/bookkeeping')
const familyStore = require('../../stores/family')
const sharedScopeStore = require('../../stores/family-shared-scope')
const { uploadFile } = require('../../stores/file')
const { getIconUrl } = require('../../utils/icon')

function defaultFormData() {
  return {
    recordCategory: null,
    recordIcon: '',
    recordSource: '',
    recordTags: [],
    recordType: null,
    isExcitationRecord: 0,
    isStatistics: 1,
    fromCurrency: '',
    fileList: [],
    shared: 0
  }
}

function getDateButtonText(dateValue) {
  const today = bookkeepingUtils.today()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayText = bookkeepingUtils.formatDate(yesterday)

  if (dateValue === today) return '今天'
  if (dateValue === yesterdayText) return '昨天'
  return dateValue
}

const currencyTypes = [
  { value: '', text: '请选择' },
  { value: 'KRW', text: '韩元' },
  { value: 'USD', text: '美元' },
  { value: 'JPY', text: '日元' },
  { value: 'EUR', text: '欧元' },
  { value: 'HKD', text: '港币' }
]

const recorderManager = typeof wx.getRecorderManager === 'function' ? wx.getRecorderManager() : null

function resolveFileFormat(filePath) {
  if (!filePath || !filePath.includes('.')) return 'mp3'
  return filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase()
}

function getRecordTypeState(recordType) {
  const recordTypeOptions = bookkeepingUtils.getRecordTypeOptions(false)
  const foundIndex = recordTypeOptions.findIndex((item) => String(item.dictCode) === String(recordType))
  return {
    recordTypeOptions,
    recordTypeIndex: foundIndex >= 0 ? foundIndex : 0,
    recordTypeName: recordType ? bookkeepingUtils.getRecordTypeName(recordType, '') : ''
  }
}

Page({
  data: {
    selectedCategory: 1,
    actions: [],
    selectedActionId: null,
    showPanel: false,
    amount: '0',
    selectedDate: bookkeepingUtils.today(),
    dateButtonText: '今天',
    isToday: true,
    remark: '',
    formData: defaultFormData(),
    tagOptions: [],
    recordTypeOptions: [],
    recordTypeIndex: 0,
    recordTypeName: '',
    currencyTypes,
    currencyIndex: 0,
    currencyName: '请选择',
    showSharedSwitch: false,
    showTagsPopup: false,
    showMorePopup: false,
    showUploadPopup: false,
    voiceLogId: null,
    voiceRecognizedText: '',
    voiceMessage: '',
    isRecording: false,
    isParsingVoice: false,
    isVoiceDraft: false,
    isSubmitting: false
  },

  onLoad() {
    this.initRecorder()
  },

  onShow() {
    this.fetchActions()
  },

  onUnload() {
    this.cancelVoiceRecording()
    this.destroyRecorderListeners()
  },

  notifyRecordCreated() {
    const eventChannel = this.getOpenerEventChannel()
    if (eventChannel && typeof eventChannel.emit === 'function') {
      eventChannel.emit('recordCreated')
    }
  },

  async ensureFamilyGroupLoaded() {
    if (familyStore.getMyGroupState() || wx.getStorageSync('myGroup')) return
    await familyStore.fetchMyGroup()
  },

  selectCategory(event) {
    const selectedCategory = Number(event.currentTarget.dataset.category)
    if (selectedCategory !== 1) {
      this.cancelVoiceRecording()
    }
    this.setData({
      selectedCategory,
      selectedActionId: null
    })
    this.fetchActions()
  },

  async fetchActions() {
    try {
      const res = await bookkeepingApi.getActionList(this.data.selectedCategory)
      const actions = (res.data || []).map((action) => ({
        ...action,
        iconUrl: getIconUrl(action.recordIcon)
      }))
      this.setData({ actions })
    } catch (error) {
      this.setData({ actions: [] })
    }
  },

  openSettings() {
    wx.navigateTo({ url: '/pagesBookkeeping/bookkeeping/bookkeeping-action-setting' })
  },

  initRecorder() {
    if (!recorderManager) return

    this.handleRecorderStop = (res) => {
      if (this.ignoreNextRecorderStop) {
        this.ignoreNextRecorderStop = false
        return
      }
      this.setData({ isRecording: false })
      if (res && res.tempFilePath) {
        this.uploadVoiceAudio(res.tempFilePath, res.duration)
      }
    }

    this.handleRecorderError = (error) => {
      this.setData({
        isRecording: false,
        isParsingVoice: false
      })
      wx.showToast({
        title: error.errMsg || '录音失败',
        icon: 'none'
      })
    }

    recorderManager.onStop(this.handleRecorderStop)
    recorderManager.onError(this.handleRecorderError)
  },

  destroyRecorderListeners() {
    if (!recorderManager) return
    if (this.handleRecorderStop && typeof recorderManager.offStop === 'function') {
      recorderManager.offStop(this.handleRecorderStop)
    }
    if (this.handleRecorderError && typeof recorderManager.offError === 'function') {
      recorderManager.offError(this.handleRecorderError)
    }
  },

  cancelVoiceRecording() {
    if (!this.data.isRecording || !recorderManager) return
    this.ignoreNextRecorderStop = true
    recorderManager.stop()
    this.setData({ isRecording: false })
  },

  submitVoiceRecording() {
    if (!this.data.isRecording || !recorderManager) return
    recorderManager.stop()
  },

  ensureRecordPermission() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (settingRes) => {
          const recordAuth = settingRes.authSetting['scope.record']
          if (recordAuth) {
            resolve(true)
            return
          }
          if (recordAuth === false) {
            wx.showModal({
              title: '需要录音权限',
              content: '请开启麦克风权限后使用语音记账',
              confirmText: '去设置',
              success: (modalRes) => {
                if (!modalRes.confirm) {
                  resolve(false)
                  return
                }
                wx.openSetting({
                  success: (openSettingRes) => {
                    resolve(Boolean(openSettingRes.authSetting['scope.record']))
                  },
                  fail: () => resolve(false)
                })
              },
              fail: () => resolve(false)
            })
            return
          }
          wx.authorize({
            scope: 'scope.record',
            success: () => resolve(true),
            fail: () => {
              wx.showToast({ title: '未获得录音权限', icon: 'none' })
              resolve(false)
            }
          })
        },
        fail: () => resolve(false)
      })
    })
  },

  async toggleVoiceRecording() {
    if (!recorderManager) {
      wx.showToast({ title: '当前环境不支持录音', icon: 'none' })
      return
    }
    if (this.data.isParsingVoice) return
    if (this.data.isRecording) {
      return
    }

    const hasPermission = await this.ensureRecordPermission()
    if (!hasPermission) return

    this.setData({
      voiceLogId: null,
      voiceRecognizedText: '',
      voiceMessage: '',
      isVoiceDraft: false
    })

    try {
      recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3'
      })
      this.setData({ isRecording: true })
    } catch (error) {
      wx.showToast({ title: '录音启动失败', icon: 'none' })
    }
  },

  async uploadVoiceAudio(filePath, durationMs) {
    if (!filePath) return
    this.setData({ isParsingVoice: true })
    try {
      const res = await bookkeepingApi.parseExpenseAudio(filePath, {
        durationMs: durationMs || 0,
        format: resolveFileFormat(filePath),
        sampleRate: 16000,
        autoSave: true
      })
      await this.handleVoiceParseResult(res.data || {})
    } catch (error) {
    } finally {
      this.setData({ isParsingVoice: false })
    }
  },

  async handleVoiceParseResult(data) {
    this.setData({
      voiceLogId: data.logId || null,
      voiceRecognizedText: data.recognizedText || '',
      voiceMessage: data.message || ''
    })

    if (data.autoSaved) {
      wx.showToast({ title: '记账成功', icon: 'success' })
      this.setData({
        voiceLogId: null,
        isVoiceDraft: false
      })
      this.notifyRecordCreated()
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
      return
    }

    if (data.draft) {
      await this.applyVoiceDraft(data.draft, data.matchedActionId)
      return
    }

    wx.showToast({
      title: data.message || '请重新录音',
      icon: 'none'
    })
  },

  async applyVoiceDraft(draft, matchedActionId) {
    await this.ensureFamilyGroupLoaded()
    const recordDate = draft.recordDate || bookkeepingUtils.today()
    const recordTags = Array.isArray(draft.recordTags) ? draft.recordTags : []
    const formData = {
      ...defaultFormData(),
      recordCategory: 1,
      recordIcon: draft.recordIcon || '',
      recordSource: draft.recordSource || '',
      recordTags,
      recordType: draft.recordType == null ? null : draft.recordType,
      isExcitationRecord: 0,
      isStatistics: draft.isStatistics == null ? 1 : draft.isStatistics,
      shared: draft.shared == null ? sharedScopeStore.getDefaultRecordShared() : draft.shared
    }

    this.setData({
      selectedCategory: 1,
      selectedActionId: matchedActionId || null,
      showPanel: true,
      amount: draft.amount == null ? '0' : String(draft.amount),
      selectedDate: recordDate,
      dateButtonText: getDateButtonText(recordDate),
      isToday: recordDate === bookkeepingUtils.today(),
      remark: draft.recordSource || '',
      formData,
      tagOptions: bookkeepingUtils.getTagOptions(1, recordTags),
      ...getRecordTypeState(formData.recordType),
      showSharedSwitch: sharedScopeStore.canControlRecordShared(),
      currencyIndex: 0,
      currencyName: '请选择',
      showTagsPopup: false,
      showMorePopup: false,
      showUploadPopup: false,
      isVoiceDraft: true,
      isSubmitting: false
    })
  },

  async openBookkeepingPanel(event) {
    if (this.data.isParsingVoice) {
      wx.showToast({ title: '语音解析中，请稍候', icon: 'none' })
      return
    }
    this.cancelVoiceRecording()

    const action = this.data.actions[Number(event.currentTarget.dataset.index)]
    if (!action) return

    await this.ensureFamilyGroupLoaded()
    const shared = sharedScopeStore.getDefaultRecordShared()
    const formData = {
      ...defaultFormData(),
      recordCategory: this.data.selectedCategory,
      recordIcon: action.recordIcon,
      recordSource: action.recordSource,
      recordTags: action.recordTags || [],
      recordType: action.recordType,
      shared
    }

    this.setData({
      selectedActionId: action.id,
      showPanel: true,
      amount: '0',
      selectedDate: bookkeepingUtils.today(),
      dateButtonText: '今天',
      isToday: true,
      remark: '',
      formData,
      tagOptions: bookkeepingUtils.getTagOptions(this.data.selectedCategory, formData.recordTags),
      ...getRecordTypeState(formData.recordType),
      showSharedSwitch: sharedScopeStore.canControlRecordShared(),
      currencyIndex: 0,
      currencyName: '请选择',
      showTagsPopup: false,
      showMorePopup: false,
      showUploadPopup: false,
      voiceLogId: null,
      isVoiceDraft: false,
      isSubmitting: false
    })
  },

  closeBookkeepingPanel() {
    if (this.data.isSubmitting) return
    this.resetBookkeepingPanel()
  },

  resetBookkeepingPanel() {
    this.setData({
      showPanel: false,
      selectedActionId: null,
      amount: '0',
      remark: '',
      formData: defaultFormData(),
      tagOptions: [],
      recordTypeOptions: [],
      recordTypeIndex: 0,
      recordTypeName: '',
      currencyIndex: 0,
      currencyName: '请选择',
      showTagsPopup: false,
      showMorePopup: false,
      showUploadPopup: false,
      voiceLogId: null,
      isVoiceDraft: false,
      isSubmitting: false
    })
  },

  handleRemarkInput(event) {
    if (this.data.isSubmitting) return
    this.setData({ remark: event.detail.value })
  },

  onDateChange(event) {
    if (this.data.isSubmitting) return
    const selectedDate = event.detail.value
    this.setData({
      selectedDate,
      dateButtonText: getDateButtonText(selectedDate),
      isToday: selectedDate === bookkeepingUtils.today()
    })
  },

  onRecordTypeChange(event) {
    if (this.data.isSubmitting) return
    const index = Number(event.detail.value)
    const option = this.data.recordTypeOptions[index]
    if (!option) return
    this.setData({
      recordTypeIndex: index,
      recordTypeName: option.dictName,
      'formData.recordType': option.dictCode
    })
  },

  handleKey(event) {
    if (this.data.isSubmitting) return
    const key = event.currentTarget.dataset.key
    if (key === 'back') {
      this.deleteNumber()
    } else if (key === '.') {
      this.addDecimal()
    } else {
      this.addNumber(key)
    }
  },

  addNumber(num) {
    const current = String(this.data.amount)
    if (current.includes('.') && current.split('.')[1].length >= 2) return
    this.setData({
      amount: current === '0' && !current.includes('.') ? String(num) : current + String(num)
    })
  },

  addDecimal() {
    const current = String(this.data.amount)
    if (!current.includes('.')) {
      this.setData({ amount: `${current}.` })
    }
  },

  deleteNumber() {
    const current = String(this.data.amount)
    const next = current.length <= 1 ? '0' : current.slice(0, -1)
    this.setData({ amount: next === '.' ? '0' : next })
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
      tagOptions: bookkeepingUtils.getTagOptions(this.data.selectedCategory, recordTags)
    })
  },

  openTagsPopup() {
    if (this.data.isSubmitting) return
    this.setData({
      showTagsPopup: true,
      showMorePopup: false,
      showUploadPopup: false
    })
  },

  closeTagsPopup() {
    this.setData({
      showTagsPopup: false
    })
  },

  openMorePopup() {
    if (this.data.isSubmitting) return
    this.setData({
      showMorePopup: true,
      showTagsPopup: false,
      showUploadPopup: false
    })
  },

  closeMorePopup() {
    this.setData({
      showMorePopup: false,
      showUploadPopup: false
    })
  },

  closeOptionPopups() {
    this.setData({
      showTagsPopup: false,
      showMorePopup: false,
      showUploadPopup: false
    })
  },

  switchExcitationRecord(event) {
    this.setData({
      'formData.isExcitationRecord': event.detail.value ? 1 : 0
    })
  },

  switchStatistics(event) {
    this.setData({
      'formData.isStatistics': event.detail.value ? 0 : 1
    })
  },

  switchShared(event) {
    this.setData({
      'formData.shared': event.detail.value ? 1 : 0
    })
  },

  onCurrencyChange(event) {
    const currencyIndex = Number(event.detail.value)
    const option = this.data.currencyTypes[currencyIndex] || this.data.currencyTypes[0]
    this.setData({
      currencyIndex,
      currencyName: option.text,
      'formData.fromCurrency': option.value
    })
  },

  openUploadPopup() {
    if (this.data.isSubmitting) return
    this.setData({ showUploadPopup: true })
  },

  closeUploadPopup() {
    this.setData({ showUploadPopup: false })
  },

  takePhoto() {
    this.closeUploadPopup()
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const filePath = (res.tempFilePaths || [])[0]
        if (filePath) this.uploadFileForBookkeepingFile(filePath)
      }
    })
  },

  chooseFromAlbum() {
    this.closeUploadPopup()
    wx.chooseImage({
      count: 9,
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: (res) => {
        ;(res.tempFilePaths || []).forEach((filePath) => this.uploadFileForBookkeepingFile(filePath))
      }
    })
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

  async submitBookkeeping() {
    if (this.data.isSubmitting) return
    if (!this.data.formData.recordCategory) {
      wx.showToast({ title: '请选择记账类别', icon: 'none' })
      return
    }
    if (Number(this.data.amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (!this.data.formData.recordType) {
      wx.showToast({ title: '请选择记账分类', icon: 'none' })
      return
    }

    this.setData({ isSubmitting: true })
    try {
      const submitData = {
        ...this.data.formData,
        recordDate: this.data.selectedDate,
        amount: Number(this.data.amount),
        recordSource: this.data.remark || this.data.formData.recordSource,
        remark: ''
      }
      const request = this.data.voiceLogId
        ? bookkeepingApi.confirmAssistantExpense({
          ...submitData,
          logId: this.data.voiceLogId
        })
        : bookkeepingApi.addRecord(submitData)
      await request
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      this.resetBookkeepingPanel()
      this.notifyRecordCreated()
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    } catch (error) {
    } finally {
      this.setData({ isSubmitting: false })
    }
  }
})
