const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')

Page({
  data: {
    overview: {},
    categoryStats: [],
    itemStyleStats: [],
    colorStats: [],
    seasonStats: [],
    sceneStats: [],
    styleStats: [],
    statusStats: [],
    brandStats: [],
    storageStats: [],
    mostWornItems: [],
    leastWornItems: [],
    idleItemList: [],
    highCostLowWearItems: [],
    loading: false
  },

  onShow() {
    this.loadOverview()
  },

  onPullDownRefresh() {
    this.loadOverview().finally(() => wx.stopPullDownRefresh())
  },

  async loadOverview() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wardrobeApi.getStatisticsOverview()
      const overview = res.data || {}
      this.setData({
        overview,
        categoryStats: (overview.categoryStats || []).map((item) => ({
          ...item,
          text: helper.optionText(helper.getCategoryOptions(), item.name, '未设置')
        })),
        itemStyleStats: (overview.itemStyleStats || []).map((item) => ({
          ...item,
          text: helper.optionText(helper.getItemStyleOptions(''), item.name, '未设置')
        })),
        colorStats: overview.colorStats || [],
        seasonStats: this.mapOptionStats(overview.seasonStats, helper.SEASON_OPTIONS),
        sceneStats: this.mapOptionStats(overview.sceneStats, helper.getSceneOptions()),
        styleStats: this.mapOptionStats(overview.styleStats, helper.getStyleOptions()),
        statusStats: overview.statusStats || [],
        brandStats: overview.brandStats || [],
        storageStats: overview.storageStats || [],
        mostWornItems: (overview.mostWornItems || []).map(helper.formatItem),
        leastWornItems: (overview.leastWornItems || []).map(helper.formatItem),
        idleItemList: (overview.idleItemList || []).map(helper.formatItem),
        highCostLowWearItems: (overview.highCostLowWearItems || []).map(helper.formatItem)
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  mapOptionStats(stats, options) {
    return (stats || []).map((item) => ({
      ...item,
      text: helper.optionText(options, item.name, item.name)
    }))
  }
})
