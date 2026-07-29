const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')

Page({
  data: {
    keyword: '',
    list: [],
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多'
  },

  onShow() {
    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchOutfits(false)
  },

  initPage() {
    this.setData({
      currentPage: 1,
      list: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    return this.fetchOutfits(true)
  },

  async fetchOutfits(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await wardrobeApi.getOutfitPage({
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize,
        outfitName: this.data.keyword,
        status: 1
      })
      const rows = ((res.data && res.data.records) || []).map(helper.formatOutfit)
      const list = reset ? rows : this.data.list.concat(rows)
      const total = (res.data && res.data.total) || list.length
      this.setData({
        list,
        hasMore: list.length < total,
        loadMoreText: list.length < total ? '加载更多' : (list.length ? '没有更多搭配了' : '')
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  handleKeywordInput(event) {
    this.setData({ keyword: event.detail.value })
  },

  goAdd() {
    wx.navigateTo({ url: '/pagesWardrobe/wardrobe/outfit-editor' })
  },

  goAssistant() {
    wx.navigateTo({ url: '/pagesWardrobe/wardrobe/assistant' })
  },

  goEdit(event) {
    wx.navigateTo({ url: `/pagesWardrobe/wardrobe/outfit-editor?id=${event.currentTarget.dataset.id}` })
  },

  copyOutfit(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      content: '复制这套搭配并生成副本？',
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.copyOutfit(id)
        wx.showToast({ title: '已复制', icon: 'success' })
        this.initPage()
      }
    })
  },

  markWorn(event) {
    const id = Number(event.currentTarget.dataset.id)
    wx.showModal({
      content: '标记这套搭配今天已穿？',
      success: async (res) => {
        if (!res.confirm) return
        const payload = { wearDate: helper.today(), outfitId: id }
        try {
          const result = await wardrobeApi.markOutfitWorn(payload)
          const data = result.data || {}
          if (!data.confirmationRequired) {
            wx.showToast({ title: '已记录', icon: 'success' })
            this.initPage()
            return
          }
          const unavailableText = (data.unavailableItems || []).map((item) => {
            const reason = item.availability === 'deleted' ? '已删除' : '已转交'
            return `${item.itemName || '未命名衣物'}（${reason}）`
          }).join('、')
          wx.showModal({
            title: '衣物不可用',
            content: `${unavailableText}。是否仅记录仍可用的衣物？`,
            confirmText: '继续记录',
            success: async (confirm) => {
              if (!confirm.confirm) return
              try {
                await wardrobeApi.markOutfitWorn({ ...payload, allowPartial: true })
                wx.showToast({ title: '已记录可用衣物', icon: 'success' })
                this.initPage()
              } catch (retryError) {
                wx.showToast({ title: (retryError && retryError.message) || '记录失败', icon: 'none' })
              }
            }
          })
        } catch (error) {
          wx.showToast({ title: (error && error.message) || '记录失败', icon: 'none' })
        }
      }
    })
  },

  deleteOutfit(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      content: '确定删除这套搭配吗？',
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.deleteOutfit(id)
        wx.showToast({ title: '已删除', icon: 'success' })
        this.initPage()
      }
    })
  }
})
