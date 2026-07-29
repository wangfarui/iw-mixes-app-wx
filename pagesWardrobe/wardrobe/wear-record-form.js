const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')

const MODE_OUTFIT = 'outfit'
const MODE_ITEMS = 'items'

function defaultForm() {
  return {
    wearDate: helper.today(),
    outfitId: '',
    itemIds: [],
    sceneTags: '',
    weatherText: '',
    moodText: '',
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

function compactJoin(values) {
  return (values || []).filter(Boolean).join(' · ')
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

function formatSelectableOutfit(outfit) {
  const formatted = helper.formatOutfit(outfit || {})
  const sceneText = formatted.sceneNames === '未设置' ? '' : formatted.sceneNames
  const seasonText = formatted.seasonNames === '未设置' ? '' : formatted.seasonNames
  return {
    ...formatted,
    id: Number(formatted.id || 0),
    selectMetaText: compactJoin([sceneText, seasonText])
  }
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

function selectedOutfitFromRecord(record, itemList) {
  const outfitId = Number(record.outfitId || 0)
  if (!outfitId) return null
  return formatSelectableOutfit({
    id: outfitId,
    outfitName: record.outfitName || '已选搭配',
    itemCount: record.itemCount || itemList.length,
    itemList
  })
}

Page({
  data: {
    isEdit: false,
    recordId: 0,
    detailLoading: false,
    formTitle: '记录穿着',
    formSubtitle: '默认记录今天，也可以补录历史日期',
    mode: MODE_OUTFIT,
    modeIndex: 0,
    modeOptions: [
      { value: MODE_OUTFIT, text: '选择搭配' },
      { value: MODE_ITEMS, text: '自由选衣物' }
    ],
    formData: defaultForm(),
    outfitKeyword: '',
    outfitList: [],
    outfitCurrentPage: 1,
    outfitPageSize: 20,
    outfitLoadedCount: 0,
    outfitHasMore: true,
    outfitLoading: false,
    outfitLoadMoreText: '',
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
    selectedOutfitSnapshot: null,
    sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), ''),
    submitting: false
  },

  async onLoad(options = {}) {
    const recordId = Number(options.id || 0)
    if (recordId) {
      this.setData({
        isEdit: true,
        recordId,
        formTitle: '编辑穿着',
        formSubtitle: '调整日期、衣物和补充信息'
      })
      wx.setNavigationBarTitle({ title: '编辑穿着' })
      await this.loadRecordDetail(recordId)
    }
    this.initOutfits()
    this.initItems()
  },

  onShow() {
    this.refreshItemFilterOptions()
    this.setData({
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), this.data.formData.sceneTags)
    })
  },

  async loadRecordDetail(recordId) {
    this.setData({ detailLoading: true })
    try {
      const res = await wardrobeApi.getWearRecordDetail(recordId)
      const detail = res.data || {}
      const selectedItemList = (detail.itemList || [])
        .map(formatSelectableItem)
        .filter((item) => item.id)
      const itemIds = selectedItemList.map((item) => item.id)
      const hasOutfit = Number(detail.outfitId || 0) > 0
      const mode = hasOutfit ? MODE_OUTFIT : MODE_ITEMS
      this.setData({
        mode,
        modeIndex: hasOutfit ? 0 : 1,
        formData: {
          wearDate: detail.wearDate || helper.today(),
          outfitId: hasOutfit ? Number(detail.outfitId) : '',
          itemIds: hasOutfit ? [] : itemIds,
          sceneTags: detail.sceneTags || '',
          weatherText: detail.weatherText || '',
          moodText: detail.moodText || '',
          remark: detail.remark || ''
        },
        selectedMap: this.buildSelectedMap(hasOutfit ? [] : itemIds),
        selectedItemList: hasOutfit ? [] : selectedItemList,
        selectedOutfitSnapshot: hasOutfit ? selectedOutfitFromRecord(detail, selectedItemList) : null,
        sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), detail.sceneTags || '')
      })
    } catch (error) {
      wx.showToast({ title: '加载记录失败', icon: 'none' })
    } finally {
      this.setData({ detailLoading: false })
    }
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

  initOutfits() {
    this.setData({
      outfitCurrentPage: 1,
      outfitLoadedCount: 0,
      outfitList: [],
      outfitHasMore: true,
      outfitLoadMoreText: '加载中...'
    })
    return this.loadOutfits(true)
  },

  async loadOutfits(reset) {
    if (this.data.outfitLoading) return
    this.setData({ outfitLoading: true, outfitLoadMoreText: '加载中...' })
    try {
      const res = await wardrobeApi.getOutfitPage({
        currentPage: this.data.outfitCurrentPage,
        pageSize: this.data.outfitPageSize,
        outfitName: this.data.outfitKeyword,
        status: 1
      })
      const rawRows = (res.data && res.data.records) || []
      const rows = rawRows.map(formatSelectableOutfit)
      const list = this.mergeSelectedOutfits(reset ? rows : this.data.outfitList.concat(rows))
      const loadedCount = reset ? rawRows.length : this.data.outfitLoadedCount + rawRows.length
      const total = (res.data && res.data.total) || loadedCount
      this.setData({
        outfitList: list,
        outfitLoadedCount: loadedCount,
        outfitHasMore: loadedCount < total,
        outfitLoadMoreText: loadedCount < total ? '上滑加载更多搭配' : (list.length ? '没有更多搭配了' : '')
      })
    } finally {
      this.setData({ outfitLoading: false })
    }
  },

  loadMoreOutfits() {
    if (!this.data.outfitHasMore || this.data.outfitLoading) return
    this.setData({ outfitCurrentPage: this.data.outfitCurrentPage + 1 })
    this.loadOutfits(false)
  },

  handleOutfitKeywordInput(event) {
    this.setData({ outfitKeyword: event.detail.value })
  },

  searchOutfits() {
    this.initOutfits()
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
        queryOnlyMyself: true,
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

  buildSelectedMap(itemIds) {
    return (itemIds || []).reduce((map, id) => {
      map[id] = true
      return map
    }, {})
  },

  mergeSelectedOutfits(rows) {
    const selected = this.data.selectedOutfitSnapshot
    if (!selected || Number(this.data.formData.outfitId || 0) !== Number(selected.id || 0)) {
      return mergeUniqueById([], rows)
    }
    return mergeUniqueById([selected], rows)
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

  onWearDateChange(event) {
    this.setData({ 'formData.wearDate': event.detail.value })
  },

  onModeChange(event) {
    const modeIndex = Number(event.currentTarget.dataset.index)
    const option = this.data.modeOptions[modeIndex]
    if (!option || option.value === this.data.mode) return
    this.setData({
      modeIndex,
      mode: option.value,
      'formData.outfitId': '',
      'formData.itemIds': [],
      selectedMap: {},
      selectedItemList: [],
      selectedOutfitSnapshot: null
    })
  },

  selectOutfit(event) {
    const id = Number(event.currentTarget.dataset.id)
    const outfit = this.data.outfitList.find((item) => Number(item.id) === id) || null
    this.setData({
      'formData.outfitId': id,
      selectedOutfitSnapshot: outfit
    })
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

  toggleScene(event) {
    const value = event.currentTarget.dataset.value
    const next = helper.toggleTag(this.data.formData.sceneTags, value)
    this.setData({
      'formData.sceneTags': next,
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), next)
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  async submitRecord() {
    if (this.data.submitting) return
    const form = this.data.formData
    const payload = {
      wearDate: form.wearDate || helper.today(),
      recordType: 2,
      sceneTags: form.sceneTags || '',
      weatherText: form.weatherText || '',
      moodText: form.moodText || '',
      remark: form.remark || ''
    }
    if (this.data.mode === MODE_OUTFIT) {
      if (!form.outfitId) {
        wx.showToast({ title: '请选择搭配', icon: 'none' })
        return
      }
      payload.outfitId = Number(form.outfitId)
    } else {
      if (!form.itemIds.length) {
        wx.showToast({ title: '请选择衣物', icon: 'none' })
        return
      }
      payload.itemIds = form.itemIds
    }
    this.setData({ submitting: true })
    try {
      if (this.data.isEdit) {
        payload.id = this.data.recordId
        await wardrobeApi.updateWearRecord(payload)
      } else {
        await wardrobeApi.addWearRecord(payload)
      }
      wx.showToast({ title: this.data.isEdit ? '已保存' : '已记录', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
