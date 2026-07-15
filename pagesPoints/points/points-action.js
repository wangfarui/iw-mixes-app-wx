const pointsApi = require('../../api/points')

function defaultForm() {
  return {
    source: '',
    inputPoints: '',
    points: 0,
    remark: ''
  }
}

Page({
  data: {
    current: 0,
    formData: defaultForm()
  },

  onShow() {
    this.initForm()
  },

  initForm() {
    this.setData({ formData: defaultForm(), current: 0 })
  },

  switchType(event) {
    this.setData({ current: Number(event.currentTarget.dataset.index) })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  async saveRecord() {
    const inputPoints = Number(this.data.formData.inputPoints)
    if (!Number.isFinite(inputPoints) || inputPoints <= 0) {
      wx.showToast({ title: '积分不能为空', icon: 'none' })
      return
    }
    const points = this.data.current === 1 ? -inputPoints : inputPoints
    await pointsApi.addPointsRecord({
      ...this.data.formData,
      points
    })
    wx.showToast({ title: '保存成功', icon: 'success' })
    this.initForm()
  }
})
