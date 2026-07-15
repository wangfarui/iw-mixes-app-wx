const {
  getRegisterInviteStatus,
  updateRegisterInviteConfig,
  generateRegisterInvite,
  deleteRegisterInvite
} = require('../../api/registerInvite')

function formatInviteCode(code) {
  if (!code) return ''
  return String(code).match(/.{1,3}/g).join(' ')
}

Page({
  data: {
    status: {
      enabled: true,
      hasInvite: false,
      inviteCode: '',
      createTime: '',
      expireTime: ''
    },
    formattedInviteCode: '',
    isLoading: false,
    isSavingConfig: false,
    isGenerating: false,
    isDeleting: false
  },

  onShow() {
    this.fetchStatus()
  },

  async fetchStatus() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })
    try {
      const res = await getRegisterInviteStatus()
      this.applyStatus(res.data || {})
    } finally {
      this.setData({ isLoading: false })
    }
  },

  applyStatus(status) {
    this.setData({
      status: {
        enabled: status.enabled !== false,
        hasInvite: Boolean(status.hasInvite),
        inviteCode: status.inviteCode || '',
        createTime: status.createTime || '',
        expireTime: status.expireTime || ''
      },
      formattedInviteCode: formatInviteCode(status.inviteCode)
    })
  },

  async handleEnabledChange(event) {
    if (this.data.isSavingConfig) return
    const enabled = Boolean(event.detail.value)
    const oldEnabled = this.data.status.enabled
    this.setData({
      isSavingConfig: true,
      'status.enabled': enabled
    })
    try {
      await updateRegisterInviteConfig(enabled)
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      this.setData({ 'status.enabled': oldEnabled })
    } finally {
      this.setData({ isSavingConfig: false })
    }
  },

  async handleGenerate() {
    if (this.data.isGenerating || this.data.status.hasInvite) return
    this.setData({ isGenerating: true })
    try {
      const res = await generateRegisterInvite()
      this.applyStatus(res.data || {})
      wx.showToast({ title: '生成成功', icon: 'success' })
    } finally {
      this.setData({ isGenerating: false })
    }
  },

  handleDelete() {
    if (this.data.isDeleting || !this.data.status.hasInvite) return

    wx.showModal({
      title: '删除邀请码',
      content: '删除后当前邀请码立即失效，是否继续？',
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ isDeleting: true })
        try {
          await deleteRegisterInvite()
          await this.fetchStatus()
          wx.showToast({ title: '已删除', icon: 'success' })
        } finally {
          this.setData({ isDeleting: false })
        }
      }
    })
  },

  handleCopy() {
    if (!this.data.status.inviteCode) return
    wx.setClipboardData({
      data: this.data.status.inviteCode,
      success() {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }
})
