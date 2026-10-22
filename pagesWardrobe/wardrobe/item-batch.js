const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')
const dictionaryOptions = require('../../stores/wardrobe-options')
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
      category: 0,
      colorId: 0,
      itemStyle: 0,
      colorName: '',
      colorHex: '',
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
    await this.loadOwnerOptions()
    await this.loadDictionaryOptions()
  },
  async loadDictionaryOptions() {
    const request = this._request = (this._request || 0) + 1
    const owner = this.data.ownerOptions[this.data.ownerIndex]
    const ownerId = Number(owner && owner.value || wardrobeFamily.currentUserId())
    this.setData({ dictionaryLoading: true, dictionaryError: '' })
    try {
      const options = await dictionaryOptions.load({ businessType: 'ITEM', ownerUserId: ownerId })
      if (request !== this._request) return
      this._dictionaryContext = { contextToken: options.contextToken }
      const common = { ...this.data.common }
      const categoryOptions = helper.getCategoryOptions(ownerId)
      if (!common.category) common.category = categoryOptions[0] ? categoryOptions[0].value : 0
      const itemStyleOptions = [{value:0,text:'未设置'}].concat(helper.getItemStyleOptions(common.category, ownerId))
      const colorOptions = [{value:0,text:'未设置',hex:''}].concat(helper.getColorOptions(ownerId))
      this.setData({ common, categoryOptions, itemStyleOptions, colorOptions, dictionaryLoading:false,
        categoryIndex:helper.optionIndex(categoryOptions,common.category),itemStyleIndex:helper.optionIndex(itemStyleOptions,common.itemStyle),
        colorIndex:helper.optionIndex(colorOptions,common.colorId),
        sceneOptions:helper.enhanceTagOptions(helper.getSceneOptions(ownerId),common.sceneTags),
        styleOptions:helper.enhanceTagOptions(helper.getStyleOptions(ownerId),common.styleTags) })
    } catch (error) {
      if (request === this._request) { this._dictionaryContext = null; this.setData({dictionaryLoading:false,dictionaryError:error.message || '选项加载失败'}) }
    }
  },
  async loadOwnerOptions() {
    const previous = this.data.ownerOptions[this.data.ownerIndex]
    const state = await wardrobeFamily.loadOwnerState()
    const myself = wardrobeFamily.currentUserId()
    const ownerOptions = state.canChooseOwner
      ? state.ownerOptions
      : state.ownerOptions.filter(item => Number(item.value) === myself)
    const selectedOwner = state.canChooseOwner && previous ? Number(previous.value) : myself
    this.setData({
      ownerOptions,
      ownerIndex: Math.max(0, ownerOptions.findIndex(item => Number(item.value) === selectedOwner)),
      canChooseOwner: state.canChooseOwner
    })
    if (state.fallbackToMyself) wx.showToast({ title: '家庭成员加载失败，已使用自己', icon: 'none' })
  },

  onOwnerChange(event) {
    this.setData({ ownerIndex:Number(event.detail.value), common:{...this.data.common,category:0,itemStyle:0,colorId:0,colorName:'',sceneTags:'',styleTags:''} })
    this.loadDictionaryOptions()
  },

  itemStyleOptions(category) {
    return [{ value: 0, text: '未设置' }].concat(helper.getItemStyleOptions(category, (this.data.ownerOptions[this.data.ownerIndex] || {}).value))
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
    if (!option) return
    const itemStyleOptions = this.itemStyleOptions(option.value)
    const currentItemStyleIndex = helper.optionIndex(itemStyleOptions, this.data.common.itemStyle)
    const itemStyleIndex = currentItemStyleIndex > 0 ? currentItemStyleIndex : 0
    this.setData({
      categoryIndex,
      itemStyleOptions,
      itemStyleIndex,
      'common.category': itemStyleOptions[itemStyleIndex].parentId || option.value,
      'common.itemStyle': itemStyleOptions[itemStyleIndex].value
    })
  },

  onItemStyleChange(event) {
    const itemStyleIndex = Number(event.detail.value)
    const option = this.data.itemStyleOptions[itemStyleIndex]
    if (!option) return
    this.setData({ itemStyleIndex, 'common.itemStyle': option.value, 'common.category': option.parentId || this.data.common.category })
  },

  onColorChange(event) {
    const colorIndex = Number(event.detail.value)
    const option = this.data.colorOptions[colorIndex]
    this.setData({
      colorIndex,
      'common.colorId': option.value,
      'common.colorName': option.text,
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
    if (group === 'sceneTags') data.sceneOptions = helper.enhanceTagOptions(helper.getSceneOptions((this.data.ownerOptions[this.data.ownerIndex] || {}).value), next)
    if (group === 'styleTags') data.styleOptions = helper.enhanceTagOptions(helper.getStyleOptions((this.data.ownerOptions[this.data.ownerIndex] || {}).value), next)
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
    if (!this._dictionaryContext || !this.data.common.category) { wx.showToast({title:'请先加载并选择可用品类',icon:'none'}); return }
    for (const item of itemList) {
      item.dictionaryContext = this._dictionaryContext
      item.dictionarySelection = { categoryId:item.category,itemStyleId:item.itemStyle || null,colorId:item.colorId || null,
        sceneIds:helper.splitTags(item.sceneTags).map(Number),styleIds:helper.splitTags(item.styleTags).map(Number) }
      delete item.category;delete item.itemStyle;delete item.colorId;delete item.colorName;delete item.sceneTags;delete item.styleTags
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
