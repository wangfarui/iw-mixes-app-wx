const optionsStore = require('../../stores/bookkeeping-options')
const bookkeepingApi = require('../../api/bookkeeping')
const bookkeepingUtils = require('../../utils/bookkeeping')
const { getIconUrl, getIconList } = require('../../utils/icon')

const recordCategoryOptions = [
  { value: 1, text: '支出' },
  { value: 2, text: '收入' }
]

function defaultFormData(recordCategory) {
  return {
    recordCategory: recordCategory || 1,
    recordSource: '',
    recordTypeId: null,
    recordIcon: '',
    recordTags: []
  }
}

Page({
  data: {
    detailId: '',
    formData: defaultFormData(1),
    recordCategoryOptions,
    recordCategoryIndex: 0,
    recordTypeOptions: [],
    recordTypeIndex: 0,
    recordTypeName: '',
    tagOptions: [],
    selectedIconUrl: '',
    iconList: [],
    showIconPopup: false,
    isSubmitting: false
  },

  onLoad(options) {
    const recordCategory = Number(options.recordCategory || 1)
    this.setData({
      detailId: options.id || '',
      formData: defaultFormData(recordCategory),
      recordCategoryIndex: recordCategory === 2 ? 1 : 0
    })
    this.refreshOptions()

    if (options.id) {
      this.fetchDetail(options.id)
    }
  },

  async onShow() {
    this.setData({ recordTypeOptions: [], tagOptions: [] })
    try { await optionsStore.refresh() } catch (error) {}
    this.refreshOptions()
  },

  refreshOptions() {
    const formData = this.data.formData
    const recordTypeOptions = bookkeepingUtils.getEditorTypeOptions(formData)
    const foundIndex = recordTypeOptions.findIndex((item) => item.id === formData.recordTypeId)
    const recordTypeIndex = foundIndex >= 0 ? foundIndex : 0
    this.setData({
      recordTypeOptions,
      recordTypeIndex,
      recordTypeName: formData.recordTypeId ? formData.recordTypeName || bookkeepingUtils.getOptionName(formData.recordTypeId) : '',
      tagOptions: bookkeepingUtils.getEditorTagOptions(formData),
      selectedIconUrl: formData.recordIcon ? getIconUrl(formData.recordIcon) : '',
      iconList: getIconList(formData.recordIcon)
    })
  },

  async fetchDetail(id) {
    try {
      const res = await bookkeepingApi.getActionDetail(id)
      const formData = {
        ...defaultFormData(1),
        ...(res.data || {}),
        recordTags: bookkeepingUtils.normalizeTagIds(res.data && res.data.recordTags)
      }
      this.setData({
        formData,
        dictionaryWarning: formData.available === false ? formData.unavailableReason || '选项已失效，请重新选择' : '',
        recordCategoryIndex: Number(formData.recordCategory) === 2 ? 1 : 0
      })
      this.refreshOptions()
    } catch (error) {}
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: event.detail.value
    })
  },

  onRecordCategoryChange(event) {
    const index = Number(event.detail.value)
    const recordCategory = recordCategoryOptions[index].value
    this.setData({
      recordCategoryIndex: index,
      'formData.recordCategory': recordCategory,
      'formData.recordTags': []
    })
    this.refreshOptions()
  },

  onRecordTypeChange(event) {
    const index = Number(event.detail.value)
    const item = this.data.recordTypeOptions[index]
    if (!item || item.historical) return
    this.setData({
      recordTypeIndex: index,
      recordTypeName: item.dictName,
      'formData.recordTypeId': item.id,
      'formData.recordTypeName': item.dictName
    })
  },

  toggleTag(event) {
    const id = Number(event.currentTarget.dataset.id)
    const recordTags = bookkeepingUtils.normalizeTagIds(this.data.formData.recordTags)
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

  noop() {},

  async submitForm() {
    const formData = this.data.formData
    if (!formData.recordCategory) {
      wx.showToast({ title: '记录类型不能为空', icon: 'none' })
      return
    }
    if (!String(formData.recordSource || '').trim()) {
      wx.showToast({ title: '记录来源不能为空', icon: 'none' })
      return
    }
    if (this.data.isSubmitting) return

    this.setData({ isSubmitting: true })
    try {
      const submitData = {
        ...formData,
        recordSource: String(formData.recordSource).trim()
      }
      delete submitData.recordType
      if (this.data.detailId) {
        submitData.id = this.data.detailId
        await bookkeepingApi.updateAction(submitData)
      } else {
        await bookkeepingApi.addAction(submitData)
      }
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    } finally {
      this.setData({ isSubmitting: false })
    }
  }
})
