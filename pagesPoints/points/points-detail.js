const pointsApi = require('../../api/points')

function formatDetail(detail) {
  const points = Number((detail && detail.points) || 0)
  return {
    ...(detail || {}),
    points,
    pointsText: `${points > 0 ? '+' : ''}${points}`
  }
}

Page({
  data: {
    detail: formatDetail({})
  },

  onLoad(options = {}) {
    if (options.id) this.fetchDetail(options.id)
  },

  async fetchDetail(id) {
    const res = await pointsApi.getPointsRecordDetail(id)
    this.setData({ detail: formatDetail(res.data || {}) })
  },

  confirmDelete() {
    if (!this.data.detail.id) return
    wx.showModal({
      title: '删除提示',
      content: '是否删除这笔记录？',
      success: async (res) => {
        if (!res.confirm) return
        await pointsApi.deletePointsRecord(this.data.detail.id)
        wx.navigateBack()
      }
    })
  }
})
