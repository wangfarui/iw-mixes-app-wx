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
    recordType: null,
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

  async fetchDetail(id) {
    try {
      const res = await bookkeepingApi.getActionDetail(id)
      const formData = {
        ...defaultFormData(1),
        ...(res.data || {}),
        recordTags: (res.data && res.data.recordTags) || []
      }
      this.setData({
        formData,
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
    if (!item) return
    this.setData({
      recordTypeIndex: index,
      recordTypeName: item.dictName,
      'formData.recordType': item.dictCode
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
    if (!formData.recordType) {
      wx.showToast({ title: '记录分类不能为空', icon: 'none' })
      return
    }
    if (this.data.isSubmitting) return

    this.setData({ isSubmitting: true })
    try {
      const submitData = {
        ...formData,
        recordSource: String(formData.recordSource).trim()
      }
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
