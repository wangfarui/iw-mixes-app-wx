const baseApi = require('../../api/base')
const loginApi = require('../../api/login')
const dictStore = require('../../stores/dict')

const statusOptions = [
  { value: 1, text: '启用' },
  { value: 0, text: '禁用' }
]

function defaultForm() {
  return {
    id: '',
    parentId: '',
    dictType: '',
    dictName: '',
    dictStatus: 1,
    dictCode: '',
    sort: '',
    isSyncAll: 0
  }
}

function buildDictTypeOptions() {
  return dictStore.getDictTypeArray().map((item) => ({
    value: item.code,
    text: item.name
  }))
}

function buildParentCategoryOptions() {
  return dictStore.getDictDataArray(dictStore.dictTypeEnum.WARDROBE_ITEM_CATEGORY).map((item) => ({
    value: item.id,
    text: item.dictName
  }))
}

function isWardrobeItemSubcategory(dictType) {
  return String(dictType || '') === String(dictStore.dictTypeEnum.WARDROBE_ITEM_SUBCATEGORY)
}

function isNumericInput(value) {
  if (value === '' || value == null) return true
  const text = String(value).trim()
  return text === '' || Number.isFinite(Number(text))
}

Page({
  data: {
    isEdit: false,
    isAdmin: false,
    formData: defaultForm(),
    dictTypeOptions: [],
    statusOptions,
    dictTypeIndex: 0,
    parentCategoryOptions: [],
    parentCategoryIndex: 0,
    parentCategoryName: '',
    showParentCategory: false,
    statusIndex: 0,
    dictTypeName: '',
    statusName: '启用',
    submitting: false
  },

  async onLoad(options = {}) {
    await this.refreshOptions()
    this.checkAdminPermission()
    if (options.id) {
      this.setData({ isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑字典' })
      this.getDetail(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '新增字典' })
    }
  },

  async refreshOptions() {
    let dictTypeOptions = buildDictTypeOptions()
    if (!dictTypeOptions.length) {
      await loginApi.refreshDictCache(true)
      dictTypeOptions = buildDictTypeOptions()
    }
    this.setData({
      dictTypeOptions,
      parentCategoryOptions: buildParentCategoryOptions()
    })
  },

  async checkAdminPermission() {
    try {
      const res = await baseApi.isAdminUser()
      this.setData({ isAdmin: Boolean(res.data) })
    } catch (error) {
      this.setData({ isAdmin: false })
    }
  },

  async getDetail(id) {
    const res = await baseApi.getDictDetail(id)
    const detail = res.data || {}
    const dictTypeIndex = this.data.dictTypeOptions.findIndex((item) => item.value === detail.dictType)
    const showParentCategory = isWardrobeItemSubcategory(detail.dictType)
    const parentCategoryIndex = this.data.parentCategoryOptions.findIndex((item) => Number(item.value) === Number(detail.parentId))
    const statusIndex = this.data.statusOptions.findIndex((item) => Number(item.value) === Number(detail.dictStatus))
    this.setData({
      formData: {
        ...defaultForm(),
        ...detail,
        parentId: detail.parentId == null ? '' : detail.parentId,
        dictCode: detail.dictCode == null ? '' : detail.dictCode,
        sort: detail.sort == null ? '' : detail.sort,
        isSyncAll: detail.isSyncAll || 0
      },
      dictTypeIndex: dictTypeIndex >= 0 ? dictTypeIndex : 0,
      dictTypeName: dictStore.getDictTypeName(detail.dictType) || '',
      showParentCategory,
      parentCategoryIndex: parentCategoryIndex >= 0 ? parentCategoryIndex : 0,
      parentCategoryName: parentCategoryIndex >= 0 ? this.data.parentCategoryOptions[parentCategoryIndex].text : '',
      statusIndex: statusIndex >= 0 ? statusIndex : 0,
      statusName: Number(detail.dictStatus) === 0 ? '禁用' : '启用'
    })
  },

  onDictTypeChange(event) {
    const dictTypeIndex = Number(event.detail.value)
    const option = this.data.dictTypeOptions[dictTypeIndex]
    const showParentCategory = option ? isWardrobeItemSubcategory(option.value) : false
    this.setData({
      dictTypeIndex,
      dictTypeName: option ? option.text : '',
      showParentCategory,
      parentCategoryIndex: 0,
      parentCategoryName: '',
      'formData.dictType': option ? option.value : '',
      'formData.parentId': showParentCategory ? '' : ''
    })
  },

  onParentCategoryChange(event) {
    const parentCategoryIndex = Number(event.detail.value)
    const option = this.data.parentCategoryOptions[parentCategoryIndex]
    this.setData({
      parentCategoryIndex,
      parentCategoryName: option ? option.text : '',
      'formData.parentId': option ? option.value : ''
    })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value)
    const option = this.data.statusOptions[statusIndex]
    this.setData({
      statusIndex,
      statusName: option ? option.text : '',
      'formData.dictStatus': option ? option.value : ''
    })
  },

  onSyncAllChange(event) {
    if (this.data.showParentCategory) {
      this.setData({ 'formData.isSyncAll': 0 })
      return
    }
    this.setData({ 'formData.isSyncAll': event.detail.value ? 1 : 0 })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  validateForm() {
    const form = this.data.formData
    if (!form.dictType) return '请选择字典类型'
    if (this.data.showParentCategory && !form.parentId) return '请选择所属品类'
    if (!String(form.dictName || '').trim()) return '请输入字典名称'
    if (form.dictStatus === '' || form.dictStatus == null) return '请选择字典状态'
    if (!isNumericInput(form.dictCode)) return '字典编码必须是数字'
    if (!isNumericInput(form.sort)) return '排序必须是数字'
    return ''
  },

  optionalNumber(value) {
    if (value === '' || value == null) return null
    const text = String(value).trim()
    return text ? Number(text) : null
  },

  async handleSave() {
    if (this.data.submitting) return

    const message = this.validateForm()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }

    const payload = {
      ...this.data.formData,
      dictName: String(this.data.formData.dictName).trim(),
      dictStatus: Number(this.data.formData.dictStatus),
      dictType: Number(this.data.formData.dictType),
      dictCode: this.optionalNumber(this.data.formData.dictCode),
      sort: this.optionalNumber(this.data.formData.sort),
      parentId: this.optionalNumber(this.data.formData.parentId),
      isSyncAll: this.data.showParentCategory ? 0 : Number(this.data.formData.isSyncAll || 0)
    }

    this.setData({ submitting: true })
    try {
      if (this.data.isEdit) {
        await baseApi.updateDict(payload)
      } else {
        await baseApi.addDict(payload)
      }
      await loginApi.refreshDictCache(true)
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } finally {
      this.setData({ submitting: false })
    }
  },

  handleDelete() {
    if (!this.data.formData.id) return
    wx.showModal({
      title: '删除字典项',
      content: `确认删除「${this.data.formData.dictName || '该字典项'}」吗？`,
      confirmText: '删除',
      confirmColor: '#dd524d',
      success: async (res) => {
        if (!res.confirm) return
        await baseApi.deleteDict(this.data.formData.id)
        await loginApi.refreshDictCache(true)
        wx.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  }
})
