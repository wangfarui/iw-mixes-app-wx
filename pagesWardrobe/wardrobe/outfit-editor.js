const wardrobeApi = require('../../api/wardrobe')
const fileStore = require('../../stores/file')
const helper = require('./wardrobe-helper')

function defaultForm() {
  return {
    id: '',
    outfitName: '',
    coverImage: '',
    seasonTags: '',
    sceneTags: '',
    styleTags: '',
    customTags: '',
    itemIds: [],
    remark: ''
  }
}

function withAllOption(text, options) {
  return [{ value: '', text }].concat(options || [])
}

function optionIndex(options, value) {
  const index = (options || []).findIndex((item) => String(item.value) === String(value || ''))
  return index >= 0 ? index : 0
}

function optionAt(options, index) {
  return (options || [])[index] || (options || [])[0] || { value: '', text: '' }
}

function defaultSortIndex(options) {
  const index = (options || []).findIndex((item) => item.value === 'recentWear')
  return index >= 0 ? index : 0
}

function normalizeItemId(item) {
  return Number((item && (item.itemId || item.id)) || 0)
}

function mergeUniqueById(primaryRows, rows) {
  const seen = {}
  return (primaryRows || []).concat(rows || []).filter((item) => {
    const id = Number(item && item.id)
    if (!id || seen[id]) return false
    seen[id] = true
    return true
  })
}

function formatSelectableItem(item) {
  const id = normalizeItemId(item)
  const formatted = helper.formatItem({
    ...(item || {}),
    id,
    itemImage: item && (item.itemImage || item.image)
  })
  return {
    ...formatted,
    id,
    itemId: id,
    image: formatted.image || (item && (item.itemImage || item.image)) || ''
  }
}

Page({
  data: {
    formData: defaultForm(),
    itemKeyword: '',
    itemList: [],
    itemCurrentPage: 1,
    itemPageSize: 30,
    itemLoadedCount: 0,
    itemHasMore: true,
    itemLoading: false,
    itemLoadMoreText: '',
    itemCategoryFilterOptions: withAllOption('全部品类', helper.getCategoryOptions()),
    itemCategoryFilterIndex: 0,
    itemSubcategoryFilterOptions: withAllOption('全部款式', helper.getItemStyleOptions('')),
    itemSubcategoryFilterIndex: 0,
    itemSeasonFilterOptions: withAllOption('全部季节', helper.SEASON_OPTIONS),
    itemSeasonFilterIndex: 0,
    itemSceneFilterOptions: withAllOption('全部场景', helper.getSceneOptions()),
    itemSceneFilterIndex: 0,
    itemStyleFilterOptions: withAllOption('全部风格', helper.getStyleOptions()),
    itemStyleFilterIndex: 0,
    itemSortOptions: helper.SORT_OPTIONS,
    itemSortIndex: defaultSortIndex(helper.SORT_OPTIONS),
    selectedMap: {},
    selectedItemList: [],
    seasonOptions: helper.enhanceTagOptions(helper.SEASON_OPTIONS, ''),
    sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), ''),
    styleOptions: helper.enhanceTagOptions(helper.getStyleOptions(), '')
  },

  async onLoad(options = {}) {
    if (options.id) await this.loadDetail(options.id)
    this.initItems()
  },

  onShow() {
    this.refreshItemFilterOptions()
    this.setData({
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), this.data.formData.sceneTags),
      styleOptions: helper.enhanceTagOptions(helper.getStyleOptions(), this.data.formData.styleTags)
    })
  },

  refreshItemFilterOptions() {
    const categoryValue = optionAt(this.data.itemCategoryFilterOptions, this.data.itemCategoryFilterIndex).value
    const subcategoryValue = optionAt(this.data.itemSubcategoryFilterOptions, this.data.itemSubcategoryFilterIndex).value
    const sceneValue = optionAt(this.data.itemSceneFilterOptions, this.data.itemSceneFilterIndex).value
    const styleValue = optionAt(this.data.itemStyleFilterOptions, this.data.itemStyleFilterIndex).value
    const itemCategoryFilterOptions = withAllOption('全部品类', helper.getCategoryOptions())
    const itemSubcategoryFilterOptions = withAllOption('全部款式', helper.getItemStyleOptions(categoryValue))
    const itemSceneFilterOptions = withAllOption('全部场景', helper.getSceneOptions())
    const itemStyleFilterOptions = withAllOption('全部风格', helper.getStyleOptions())
    this.setData({
      itemCategoryFilterOptions,
      itemCategoryFilterIndex: optionIndex(itemCategoryFilterOptions, categoryValue),
      itemSubcategoryFilterOptions,
      itemSubcategoryFilterIndex: optionIndex(itemSubcategoryFilterOptions, subcategoryValue),
      itemSceneFilterOptions,
      itemSceneFilterIndex: optionIndex(itemSceneFilterOptions, sceneValue),
      itemStyleFilterOptions,
      itemStyleFilterIndex: optionIndex(itemStyleFilterOptions, styleValue)
    })
  },

  initItems() {
    this.setData({
      itemCurrentPage: 1,
      itemLoadedCount: 0,
      itemList: [],
      itemHasMore: true,
      itemLoadMoreText: '加载中...'
    })
    return this.loadItems(true)
  },

  async loadItems(reset) {
    if (this.data.itemLoading) return
    this.setData({ itemLoading: true, itemLoadMoreText: '加载中...' })
    try {
      const res = await wardrobeApi.getItemPage({
        currentPage: this.data.itemCurrentPage,
        pageSize: this.data.itemPageSize,
        keyword: this.data.itemKeyword,
        category: optionAt(this.data.itemCategoryFilterOptions, this.data.itemCategoryFilterIndex).value || null,
        itemStyle: optionAt(this.data.itemSubcategoryFilterOptions, this.data.itemSubcategoryFilterIndex).value || null,
        season: optionAt(this.data.itemSeasonFilterOptions, this.data.itemSeasonFilterIndex).value || '',
        scene: optionAt(this.data.itemSceneFilterOptions, this.data.itemSceneFilterIndex).value || '',
        style: optionAt(this.data.itemStyleFilterOptions, this.data.itemStyleFilterIndex).value || '',
        sortType: optionAt(this.data.itemSortOptions, this.data.itemSortIndex).value || 'recentWear'
      })
      const rawRows = (res.data && res.data.records) || []
      const rows = rawRows
        .map(formatSelectableItem)
        .filter((item) => helper.normalizeStatus(item.status) !== 5)
      const list = this.mergeSelectedItems(reset ? rows : this.data.itemList.concat(rows))
      const loadedCount = reset ? rawRows.length : this.data.itemLoadedCount + rawRows.length
      const total = (res.data && res.data.total) || loadedCount
      this.setData({
        itemList: list,
        itemLoadedCount: loadedCount,
        itemHasMore: loadedCount < total,
        itemLoadMoreText: loadedCount < total ? '上滑加载更多衣物' : (list.length ? '没有更多衣物了' : '')
      })
    } finally {
      this.setData({ itemLoading: false })
    }
  },

  loadMoreItems() {
    if (!this.data.itemHasMore || this.data.itemLoading) return
    this.setData({ itemCurrentPage: this.data.itemCurrentPage + 1 })
    this.loadItems(false)
  },

  handleItemKeywordInput(event) {
    this.setData({ itemKeyword: event.detail.value })
  },

  searchItems() {
    this.initItems()
  },

  onItemCategoryFilterChange(event) {
    const itemCategoryFilterIndex = Number(event.detail.value)
    const categoryValue = optionAt(this.data.itemCategoryFilterOptions, itemCategoryFilterIndex).value
    this.setData({
      itemCategoryFilterIndex,
      itemSubcategoryFilterOptions: withAllOption('全部款式', helper.getItemStyleOptions(categoryValue)),
      itemSubcategoryFilterIndex: 0
    })
    this.initItems()
  },

  onItemSubcategoryFilterChange(event) {
    this.setData({ itemSubcategoryFilterIndex: Number(event.detail.value) })
    this.initItems()
  },

  onItemSeasonFilterChange(event) {
    this.setData({ itemSeasonFilterIndex: Number(event.detail.value) })
    this.initItems()
  },

  onItemSceneFilterChange(event) {
    this.setData({ itemSceneFilterIndex: Number(event.detail.value) })
    this.initItems()
  },

  onItemStyleFilterChange(event) {
    this.setData({ itemStyleFilterIndex: Number(event.detail.value) })
    this.initItems()
  },

  onItemSortChange(event) {
    this.setData({ itemSortIndex: Number(event.detail.value) })
    this.initItems()
  },

  resetItemFilters() {
    this.setData({
      itemKeyword: '',
      itemCategoryFilterIndex: 0,
      itemSubcategoryFilterOptions: withAllOption('全部款式', helper.getItemStyleOptions('')),
      itemSubcategoryFilterIndex: 0,
      itemSeasonFilterIndex: 0,
      itemSceneFilterIndex: 0,
      itemStyleFilterIndex: 0,
      itemSortIndex: defaultSortIndex(this.data.itemSortOptions)
    })
    this.initItems()
  },

  async loadDetail(id) {
    const res = await wardrobeApi.getOutfitDetail(id)
    const detail = res.data || {}
    const selectedItemList = (detail.itemList || [])
      .map(formatSelectableItem)
      .filter((item) => item.id)
    const itemIds = selectedItemList.map((item) => item.id)
    this.setData({
      formData: {
        ...defaultForm(),
        ...detail,
        itemIds
      },
      selectedMap: this.buildSelectedMap(itemIds),
      selectedItemList,
      seasonOptions: helper.enhanceTagOptions(helper.SEASON_OPTIONS, detail.seasonTags),
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), detail.sceneTags),
      styleOptions: helper.enhanceTagOptions(helper.getStyleOptions(), detail.styleTags)
    })
  },

  buildSelectedMap(itemIds) {
    return (itemIds || []).reduce((map, id) => {
      map[id] = true
      return map
    }, {})
  },

  mergeSelectedItems(rows) {
    const selectedIds = this.data.formData.itemIds.map((id) => Number(id))
    const selectedSet = selectedIds.reduce((map, id) => {
      if (id) map[id] = true
      return map
    }, {})
    const selectedRows = this.data.selectedItemList.filter((item) => selectedSet[Number(item.id)])
    return mergeUniqueById(selectedRows, rows)
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  toggleTag(event) {
    const group = event.currentTarget.dataset.group
    const value = event.currentTarget.dataset.value
    const next = helper.toggleTag(this.data.formData[group], value)
    const data = {
      [`formData.${group}`]: next
    }
    if (group === 'seasonTags') data.seasonOptions = helper.enhanceTagOptions(helper.SEASON_OPTIONS, next)
    if (group === 'sceneTags') data.sceneOptions = helper.enhanceTagOptions(helper.getSceneOptions(), next)
    if (group === 'styleTags') data.styleOptions = helper.enhanceTagOptions(helper.getStyleOptions(), next)
    this.setData(data)
  },

  toggleItem(event) {
    const id = Number(event.currentTarget.dataset.id)
    const itemIds = this.data.formData.itemIds.slice()
    const index = itemIds.indexOf(id)
    if (index >= 0) {
      itemIds.splice(index, 1)
    } else {
      itemIds.push(id)
    }
    const selectedItemList = this.data.selectedItemList.slice()
    const selectedIndex = selectedItemList.findIndex((item) => Number(item.id) === id)
    if (index >= 0 && selectedIndex >= 0) {
      selectedItemList.splice(selectedIndex, 1)
    } else if (index < 0 && selectedIndex < 0) {
      const item = this.data.itemList.find((row) => Number(row.id) === id)
      if (item) selectedItemList.push(item)
    }
    this.setData({
      'formData.itemIds': itemIds,
      selectedMap: this.buildSelectedMap(itemIds),
      selectedItemList
    })
  },

  chooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!filePath) return
        const fileRes = await fileStore.uploadFile(filePath)
        this.setData({ 'formData.coverImage': fileRes.fileUrl || fileRes })
      }
    })
  },

  async submitForm() {
    const form = this.data.formData
    if (!String(form.outfitName || '').trim()) {
      wx.showToast({ title: '请输入搭配名称', icon: 'none' })
      return
    }
    if (!form.itemIds.length) {
      wx.showToast({ title: '请选择衣物', icon: 'none' })
      return
    }
    const payload = {
      outfitName: String(form.outfitName || '').trim(),
      coverImage: form.coverImage || '',
      seasonTags: form.seasonTags || '',
      sceneTags: form.sceneTags || '',
      styleTags: form.styleTags || '',
      customTags: form.customTags || '',
      itemIds: form.itemIds,
      remark: form.remark || ''
    }
    if (form.id) {
      payload.id = form.id
      await wardrobeApi.updateOutfit(payload)
    } else {
      await wardrobeApi.addOutfit(payload)
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 400)
  }
})
