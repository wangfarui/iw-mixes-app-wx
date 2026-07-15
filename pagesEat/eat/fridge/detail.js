const eatApi = require('../../../api/eat')
const dictStore = require('../../../stores/dict')
const utils = require('../../../utils/bookkeeping')
const helper = require('../eat-helper')

function defaultForm() {
  return {
    name: '',
    emoji: '🍎',
    category: '',
    section: '',
    quantity: '',
    addDate: utils.today(),
    expireDate: ''
  }
}

Page({
  data: {
    isEdit: false,
    foodId: '',
    isSaving: false,
    showEmojiPicker: false,
    formData: defaultForm(),
    categoryOptions: [],
    sectionOptions: [],
    categoryIndex: 0,
    sectionIndex: 0,
    categoryName: '',
    sectionName: '',
    emojiList: ['🍎', '🍌', '🍇', '🍓', '🍑', '🥬', '🌽', '🌶', '🍅', '🥔', '🥚', '🥩', '🥟', '🥙', '🍞', '🐖', '🐔', '🐂', '🦆', '🐟', '🥛', '🥤', '🍦', '🍻', '🧂']
  },

  onLoad(options = {}) {
    this.refreshOptions()
    if (options.id) {
      this.setData({ isEdit: true, foodId: options.id })
      this.fetchFoodDetail(options.id)
    }
  },

  refreshOptions() {
    this.setData({
      categoryOptions: helper.optionList(dictStore.dictTypeEnum.EAT_FRIDGE_CATEGORY),
      sectionOptions: helper.optionList(dictStore.dictTypeEnum.EAT_FRIDGE_SECTION)
    })
  },

  async fetchFoodDetail(id) {
    const res = await eatApi.getFridgeFoodDetail(id)
    const detail = res.data || {}
    const categoryIndex = this.data.categoryOptions.findIndex((item) => Number(item.value) === Number(detail.category))
    const sectionIndex = this.data.sectionOptions.findIndex((item) => Number(item.value) === Number(detail.section))
    this.setData({
      formData: {
        ...defaultForm(),
        ...detail,
        emoji: detail.emoji || '🍎',
        addDate: detail.addDate || utils.today(),
        expireDate: detail.expireDate || ''
      },
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      sectionIndex: sectionIndex >= 0 ? sectionIndex : 0,
      categoryName: helper.dictName(dictStore.dictTypeEnum.EAT_FRIDGE_CATEGORY, detail.category, ''),
      sectionName: helper.dictName(dictStore.dictTypeEnum.EAT_FRIDGE_SECTION, detail.section, '')
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const option = this.data.categoryOptions[categoryIndex]
    this.setData({
      categoryIndex,
      categoryName: option ? option.text : '',
      'formData.category': option ? option.value : ''
    })
  },

  onSectionChange(event) {
    const sectionIndex = Number(event.detail.value)
    const option = this.data.sectionOptions[sectionIndex]
    this.setData({
      sectionIndex,
      sectionName: option ? option.text : '',
      'formData.section': option ? option.value : ''
    })
  },

  onAddDateChange(event) {
    this.setData({ 'formData.addDate': event.detail.value })
  },

  onExpireDateChange(event) {
    this.setData({ 'formData.expireDate': event.detail.value })
  },

  toggleEmojiPicker() {
    this.setData({ showEmojiPicker: !this.data.showEmojiPicker })
  },

  selectEmoji(event) {
    this.setData({
      'formData.emoji': event.currentTarget.dataset.emoji,
      showEmojiPicker: false
    })
  },

  async saveFood() {
    if (!String(this.data.formData.name || '').trim()) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' })
      return
    }
    if (this.data.isSaving) return
    this.setData({ isSaving: true })
    try {
      const form = this.data.formData
      const payload = {
        name: String(form.name).trim(),
        emoji: form.emoji || undefined,
        category: form.category === '' ? undefined : Number(form.category),
        section: form.section === '' ? undefined : Number(form.section),
        quantity: form.quantity || undefined,
        addDate: form.addDate || undefined,
        expireDate: form.expireDate || undefined
      }
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
      if (this.data.isEdit) {
        payload.id = this.data.foodId
        await eatApi.updateFridgeFood(payload)
      } else {
        await eatApi.addFridgeFood(payload)
      }
      wx.showToast({ title: this.data.isEdit ? '保存成功' : '新增成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } finally {
      this.setData({ isSaving: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
