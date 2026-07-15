const { generateInvite } = require('../../api/family')
const familyStore = require('../../stores/family')

function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatInviteCode(code) {
  if (!code) return ''
  return String(code).match(/.{1,4}/g).join(' ')
}

Page({
  data: {
    selectedPeriod: 168,
    periodOptions: [
      { label: '1天', value: 24 },
      { label: '3天', value: 72 },
      { label: '7天', value: 168 }
    ],
    inviteCode: null,
    formattedInviteCode: '',
    expireText: '',
    isGenerating: false
  },

  selectPeriod(event) {
    this.setData({
      selectedPeriod: Number(event.currentTarget.dataset.value)
    })
  },

  async handleGenerate() {
    if (this.data.isGenerating) return

    const group = familyStore.getMyGroupState() || wx.getStorageSync('myGroup')
    if (!group || !group.id) {
      wx.showToast({
        title: '家庭组信息不存在',
        icon: 'none'
      })
      return
    }

    this.setData({ isGenerating: true })
    try {
      const res = await generateInvite({
        groupId: group.id,
        validHours: this.data.selectedPeriod
      })
      const inviteCode = res.data
      this.setData({
        inviteCode,
        formattedInviteCode: formatInviteCode(inviteCode && inviteCode.inviteCode),
        expireText: formatTime(inviteCode && inviteCode.expireTime)
      })
      wx.showToast({
        title: '生成成功',
        icon: 'success'
      })
    } catch (error) {
    } finally {
      this.setData({ isGenerating: false })
    }
  },

  handleCopy() {
    if (!this.data.inviteCode || !this.data.inviteCode.inviteCode) return

    wx.setClipboardData({
      data: this.data.inviteCode.inviteCode,
      success() {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },

  goInviteList() {
    wx.navigateTo({ url: '/pagesBase/family/inviteList' })
  },

  handleReset() {
    this.setData({
      inviteCode: null,
      formattedInviteCode: '',
      expireText: ''
    })
  }
})
