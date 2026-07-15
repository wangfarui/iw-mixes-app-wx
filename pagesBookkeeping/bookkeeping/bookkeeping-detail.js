const bookkeepingApi = require('../../api/bookkeeping')
const bookkeepingUtils = require('../../utils/bookkeeping')

Page({
  data: {
    detailId: '',
    detail: {},
    isLoading: false
  },

  onLoad(options) {
    this.setData({
      detailId: options.id || ''
    })
  },

  onShow() {
    this.fetchDetail()
  },

  async fetchDetail() {
    if (!this.data.detailId || this.data.isLoading) return
    this.setData({ isLoading: true })

    try {
      const res = await bookkeepingApi.getRecordDetail(this.data.detailId)
      const detail = this.formatDetail(res.data || {})
      this.setData({ detail })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  formatDetail(detail) {
    return {
      ...detail,
      recordCategoryText: bookkeepingUtils.getRecordCategoryText(detail.recordCategory),
      recordSourceText: bookkeepingUtils.formatRecordSource(detail),
      recordTypeName: bookkeepingUtils.getRecordTypeName(detail.recordType, '-'),
      recordTagsText: bookkeepingUtils.formatRecordTags(detail)
    }
  },

  clickUpdateButton() {
    if (!this.data.detail.canEdit) return
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-action?id=${this.data.detail.id}`
    })
  },

  confirmDelete() {
    if (!this.data.detail.canEdit) return
    wx.showModal({
      title: '提示',
      content: '确认删除这笔记录？',
      confirmText: '删除',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (!res.confirm) return

        await bookkeepingApi.deleteRecord(this.data.detail.id)
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 600)
      }
    })
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.url
    const urls = (this.data.detail.fileList || []).map((file) => file.fileUrl)
    wx.previewImage({
      current,
      urls
    })
  }
})
