const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')
const wardrobeFamily = require('./wardrobe-family')

Page({
  data: {
    bulkText: '',
    categoryOptions: helper.getCategoryOptions(),
    categoryIndex: 0,
    itemStyleOptions: [{ value: 0, text: '未设置' }].concat(helper.getItemStyleOptions(1)),
    itemStyleIndex: 0,
    colorOptions: helper.getColorOptions(),
    colorIndex: 0,
    statusOptions: helper.STATUS_OPTIONS,
    statusIndex: 0,
    seasonOptions: helper.enhanceTagOptions(helper.SEASON_OPTIONS, ''),
    sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), ''),
    styleOptions: helper.enhanceTagOptions(helper.getStyleOptions(), ''),
    common: {
      category: 1,
      itemStyle: 0,
      colorName: '黑色',
      colorHex: '#1f2329',
      seasonTags: '',
      sceneTags: '',
      styleTags: '',
      status: 1,
      storageLocation: '',
      customTags: ''
    },
    ownerOptions: [],
    ownerIndex: 0,
    canChooseOwner: false,
    submitting: false
  },

  async onShow() {
    const categoryOptions = helper.getCategoryOptions()
    const itemStyleOptions = this.itemStyleOptions(this.data.common.category)
    const colorOptions = helper.getColorOptions()
    this.setData({
      categoryOptions,
      itemStyleOptions,
      colorOptions,
      categoryIndex: helper.optionIndex(categoryOptions, this.data.common.category),
      itemStyleIndex: helper.optionIndex(itemStyleOptions, this.data.common.itemStyle),
      colorIndex: helper.optionIndex(colorOptions, this.data.common.colorName),
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), this.data.common.sceneTags),
      styleOptions: helper.enhanceTagOptions(helper.getStyleOptions(), this.data.common.styleTags)
    })
    await this.loadOwnerOptions()
  },

  async loadOwnerOptions() {
    const state = await wardrobeFamily.loadOwnerState()
    this.setData({
      ownerOptions: state.ownerOptions,
      ownerIndex: 0,
      canChooseOwner: state.canChooseOwner
    })
    if (state.fallbackToMyself) wx.showToast({ title: '家庭成员加载失败，已使用自己', icon: 'none' })
  },

  onOwnerChange(event) {
    this.setData({ ownerIndex: Number(event.detail.value) })
  },

  itemStyleOptions(category) {
    return [{ value: 0, text: '未设置' }].concat(helper.getItemStyleOptions(category))
  },

  handleTextInput(event) {
    this.setData({ bulkText: event.detail.value })
  },

  handleCommonInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`common.${field}`]: event.detail.value })
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const option = this.data.categoryOptions[categoryIndex]
    const itemStyleOptions = this.itemStyleOptions(option.value)
    const currentItemStyleIndex = helper.optionIndex(itemStyleOptions, this.data.common.itemStyle)
    const itemStyleIndex = currentItemStyleIndex > 0 ? currentItemStyleIndex : 0
    this.setData({
      categoryIndex,
      itemStyleOptions,
      itemStyleIndex,
      'common.category': option.value,
      'common.itemStyle': itemStyleOptions[itemStyleIndex].value
    })
  },

  onItemStyleChange(event) {
    const itemStyleIndex = Number(event.detail.value)
    const option = this.data.itemStyleOptions[itemStyleIndex]
    this.setData({ itemStyleIndex, 'common.itemStyle': option.value })
  },

  onColorChange(event) {
    const colorIndex = Number(event.detail.value)
    const option = this.data.colorOptions[colorIndex]
    this.setData({
      colorIndex,
      'common.colorName': option.value,
      'common.colorHex': option.hex
    })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value)
    this.setData({
      statusIndex,
      'common.status': this.data.statusOptions[statusIndex].value
    })
  },

  toggleTag(event) {
    const group = event.currentTarget.dataset.group
    const value = event.currentTarget.dataset.value
    const next = helper.toggleTag(this.data.common[group], value)
    const data = { [`common.${group}`]: next }
    if (group === 'seasonTags') data.seasonOptions = helper.enhanceTagOptions(helper.SEASON_OPTIONS, next)
    if (group === 'sceneTags') data.sceneOptions = helper.enhanceTagOptions(helper.getSceneOptions(), next)
    if (group === 'styleTags') data.styleOptions = helper.enhanceTagOptions(helper.getStyleOptions(), next)
    this.setData(data)
  },

  parseItems() {
    return String(this.data.bulkText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[，,]/).map((part) => part.trim())
        return {
          itemName: parts[0],
          brand: parts[1] || '',
          size: parts[2] || '',
          ...this.data.common
        }
      })
  },

  async submitBatch() {
    if (this.data.submitting) return
    const itemList = this.parseItems()
    if (!itemList.length) {
      wx.showToast({ title: '请输入衣物名称', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const owner = this.data.ownerOptions[this.data.ownerIndex]
      await wardrobeApi.batchAddItems({
        itemList,
        ownerUserId: Number((owner && owner.value) || wardrobeFamily.currentUserId())
      })
      wx.showToast({ title: '已入柜', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
