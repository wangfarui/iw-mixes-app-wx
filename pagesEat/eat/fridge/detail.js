const eatApi = require('../../../api/eat')
const kitchenOptions = require('../../../stores/kitchen-options')
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
    categoryChanged: false,
    sectionChanged: false,
    dictionaryContext: null,
    optionsError: '',
    emojiList: ['🍎', '🍌', '🍇', '🍓', '🍑', '🥬', '🌽', '🌶', '🍅', '🥔', '🥚', '🥩', '🥟', '🥙', '🍞', '🐖', '🐔', '🐂', '🦆', '🐟', '🥛', '🥤', '🍦', '🍻', '🧂']
  },

  onLoad(options = {}) {
    if (options.id) {
      this.setData({ isEdit: true, foodId: options.id })
      this.fetchFoodDetail(options.id)
    } else {
      this.refreshOptions()
    }
  },

  _normalizeOptions(rows) {
    return [{ value: '', text: '不选择' }].concat((rows || []).map((item) => ({
      value: item.sourceId == null ? item.id : item.sourceId,
      text: item.name || item.dictName || item.text || '',
      scope: item.scope || ''
    })).filter((item) => item.value !== undefined && item.value !== null && item.text))
  },

  _dictionaryContext(options = {}) {
    return {
      contextToken: options.contextToken,
      ownerUserId: options.ownerUserId,
      familyGroupId: options.familyGroupId,
      personalScopeVersion: options.personalScopeVersion,
      familyScopeVersion: options.familyScopeVersion
    }
  },

  _findOptionIndex(options, sourceId) {
    if (sourceId === '' || sourceId == null) return 0
    return options.findIndex((item) => Number(item.value) === Number(sourceId))
  },

  async refreshOptions(foodId) {
    try {
      const data = await kitchenOptions.loadOptions(foodId ? { foodId } : {})
      const categoryOptions = this._normalizeOptions(data.categories)
      const sectionOptions = this._normalizeOptions(data.sections)
      this.setData({
        categoryOptions,
        sectionOptions,
        dictionaryContext: this._dictionaryContext(data),
        optionsError: ''
      })
      return { categoryOptions, sectionOptions }
    } catch (error) {
      this.setData({ optionsError: (error && error.message) || '选项加载失败' })
      return { categoryOptions: this.data.categoryOptions, sectionOptions: this.data.sectionOptions }
    }
  },

  async fetchFoodDetail(id) {
    const [res, optionData] = await Promise.all([
      eatApi.getFridgeFoodDetail(id),
      this.refreshOptions(id)
    ])
    const detail = res.data || {}
    const categorySourceId = detail.categorySourceId == null ? '' : detail.categorySourceId
    const sectionSourceId = detail.sectionSourceId == null ? '' : detail.sectionSourceId
    const categoryOptions = optionData.categoryOptions.slice()
    const sectionOptions = optionData.sectionOptions.slice()
    let categoryIndex = this._findOptionIndex(categoryOptions, categorySourceId)
    let sectionIndex = this._findOptionIndex(sectionOptions, sectionSourceId)
    if (categoryIndex < 0 && categorySourceId !== '' && detail.categoryNameSnapshot) {
      categoryOptions.unshift({ value: categorySourceId, text: `${detail.categoryNameSnapshot}（历史）`, historical: true })
      categoryIndex = 0
    }
    if (sectionIndex < 0 && sectionSourceId !== '' && detail.sectionNameSnapshot) {
      sectionOptions.unshift({ value: sectionSourceId, text: `${detail.sectionNameSnapshot}（历史）`, historical: true })
      sectionIndex = 0
    }
    this.setData({
      categoryOptions,
      sectionOptions,
      formData: {
        ...defaultForm(),
        ...detail,
        emoji: detail.emoji || '🍎',
        category: categorySourceId,
        section: sectionSourceId,
        addDate: detail.addDate || utils.today(),
        expireDate: detail.expireDate || ''
      },
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      sectionIndex: sectionIndex >= 0 ? sectionIndex : 0,
      categoryName: categoryIndex >= 0 ? (categoryOptions[categoryIndex].text || '') : (detail.categoryNameSnapshot || ''),
      sectionName: sectionIndex >= 0 ? (sectionOptions[sectionIndex].text || '') : (detail.sectionNameSnapshot || ''),
      categoryChanged: false,
      sectionChanged: false
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
      categoryChanged: true,
      categoryName: option && option.value !== '' ? option.text : '',
      'formData.category': option ? option.value : ''
    })
  },

  onSectionChange(event) {
    const sectionIndex = Number(event.detail.value)
    const option = this.data.sectionOptions[sectionIndex]
    this.setData({
      sectionIndex,
      sectionChanged: true,
      sectionName: option && option.value !== '' ? option.text : '',
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
        quantity: form.quantity || undefined,
        addDate: form.addDate || undefined,
        expireDate: form.expireDate || undefined
      }
      if (this.data.isEdit) {
        payload.id = this.data.foodId
        const dictionaryChanges = {}
        if (this.data.categoryChanged) dictionaryChanges.categorySourceId = form.category === '' ? null : Number(form.category)
        if (this.data.sectionChanged) dictionaryChanges.sectionSourceId = form.section === '' ? null : Number(form.section)
        if (Object.keys(dictionaryChanges).length) {
          payload.dictionaryChanges = dictionaryChanges
          payload.dictionaryContext = this.data.dictionaryContext || undefined
        }
        Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
        await eatApi.updateFridgeFood(payload)
      } else {
        payload.dictionarySelection = {
          categorySourceId: form.category === '' ? null : Number(form.category),
          sectionSourceId: form.section === '' ? null : Number(form.section)
        }
        payload.dictionaryContext = this.data.dictionaryContext || undefined
        Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
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
