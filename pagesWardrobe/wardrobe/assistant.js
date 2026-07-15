const wardrobeApi = require('../../api/wardrobe')

Page({
  data: {
    prompt: '明天通勤，偏冷，简约一点',
    weatherText: '',
    summary: '',
    source: '',
    suggestions: [],
    excludeItemIds: [],
    loading: false
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  async generate() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wardrobeApi.aiSuggestOutfits({
        prompt: this.data.prompt,
        weatherText: this.data.weatherText,
        excludeItemIds: this.data.excludeItemIds,
        limit: 4,
        useAi: true
      })
      const data = res.data || {}
      this.setData({
        source: data.source || 'candidate',
        summary: data.summary || '',
        suggestions: (data.suggestions || []).map((item) => ({
          ...item,
          itemIds: (item.itemList || []).map((child) => child.itemId)
        }))
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  changeBatch() {
    if (this.data.loading || !this.data.suggestions.length) return
    const excludeItemIds = []
    this.data.suggestions.forEach((suggestion) => {
      const itemIds = suggestion.itemIds || []
      itemIds.forEach((id) => {
        if (excludeItemIds.indexOf(id) < 0) excludeItemIds.push(id)
      })
    })
    this.setData({ excludeItemIds })
    this.generate()
  },

  async saveSuggestion(event) {
    const index = Number(event.currentTarget.dataset.index)
    const suggestion = this.data.suggestions[index]
    if (!suggestion || !suggestion.itemIds.length) return
    await wardrobeApi.addOutfit({
      outfitName: suggestion.suggestionName,
      itemIds: suggestion.itemIds,
      remark: `${this.data.summary || ''}\n${suggestion.reason || ''}`
    })
    wx.showToast({ title: '已保存', icon: 'success' })
  }
})
