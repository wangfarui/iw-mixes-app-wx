const baseApi = require('../../api/base')
const dictStore = require('../../stores/dict')

function defaultForm() {
  return {
    id: '',
    name: '',
    address: '',
    account: '',
    type: '',
    remark: '',
    password: ''
  }
}

function buildTypeOptions() {
  return dictStore.getDictDataArray(dictStore.dictTypeEnum.AUTH_APPLICATION_ACCOUNT_TYPE)
    .map((item) => ({
      value: item.dictCode,
      text: item.dictName
    }))
}

Page({
  data: {
    isEdit: false,
    formData: defaultForm(),
    typeOptions: [],
    typeIndex: 0,
    typeName: ''
  },

  onLoad(options = {}) {
    this.refreshOptions()
    if (options.id) {
      this.setData({ isEdit: true })
      this.getDetail(options.id)
    }
  },

  refreshOptions() {
    this.setData({ typeOptions: buildTypeOptions() })
  },

  async getDetail(id) {
    const res = await baseApi.getAccountDetail(id)
    const detail = res.data || {}
    const typeIndex = this.data.typeOptions.findIndex((item) => Number(item.value) === Number(detail.type))
    this.setData({
      formData: {
        ...defaultForm(),
        ...detail,
        password: ''
      },
      typeIndex: typeIndex >= 0 ? typeIndex : 0,
      typeName: dictStore.getDictNameByCode(dictStore.dictTypeEnum.AUTH_APPLICATION_ACCOUNT_TYPE, detail.type, '')
    })
  },

  onTypeChange(event) {
    const typeIndex = Number(event.detail.value)
    const option = this.data.typeOptions[typeIndex]
    this.setData({
      typeIndex,
      typeName: option ? option.text : '',
      'formData.type': option ? option.value : ''
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  validateForm() {
    const form = this.data.formData
    if (!form.name && !form.address && !form.account) {
      return '应用名称、应用地址、账号至少填写一项'
    }
    return ''
  },

  async handleSave() {
    const message = this.validateForm()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }

    const form = this.data.formData
    const payload = {
      ...form,
      name: String(form.name || '').trim(),
      address: String(form.address || '').trim(),
      account: String(form.account || '').trim(),
      remark: form.remark || '',
      updatePassword: Boolean(form.password)
    }
    if (form.type !== '') payload.type = Number(form.type)

    if (this.data.isEdit) {
      await baseApi.updateAccount(payload)
    } else {
      await baseApi.addAccount(payload)
    }

    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 600)
  },

  handleDelete() {
    if (!this.data.formData.id) return
    wx.showModal({
      title: '提示',
      content: '确认删除该账号吗？',
      success: async (res) => {
        if (!res.confirm) return
        await baseApi.deleteAccount(this.data.formData.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  }
})
