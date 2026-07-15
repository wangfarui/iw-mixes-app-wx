const feedbackTypes = [
  { label: '功能异常', value: 'bug' },
  { label: '产品建议', value: 'suggestion' },
  { label: '体验问题', value: 'experience' },
  { label: '其他', value: 'other' }
]

Page({
  data: {
    feedbackTypes,
    selectedType: feedbackTypes[0].value,
    content: '',
    contact: '',
    maxLength: 300,
    contentLength: 0,
    isSubmitting: false
  },

  selectType(event) {
    this.setData({ selectedType: event.currentTarget.dataset.value })
  },

  onContentInput(event) {
    const content = event.detail.value
    this.setData({
      content,
      contentLength: content.length
    })
  },

  onContactInput(event) {
    this.setData({ contact: event.detail.value })
  },

  submitFeedback() {
    if (this.data.isSubmitting) return
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }

    this.setData({ isSubmitting: true })
    wx.showLoading({ title: '提交中...' })
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({ title: '提交成功', icon: 'success' })
      this.setData({
        selectedType: feedbackTypes[0].value,
        content: '',
        contact: '',
        contentLength: 0,
        isSubmitting: false
      })
    }, 400)
  }
})
