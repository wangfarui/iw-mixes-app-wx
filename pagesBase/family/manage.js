const { deleteGroup } = require('../../api/family')
const familyStore = require('../../stores/family')

Page({
  goEdit() {
    wx.navigateTo({ url: '/pagesBase/family/edit' })
  },

  goTransfer() {
    wx.navigateTo({ url: '/pagesBase/family/transfer' })
  },

  goInviteList() {
    wx.navigateTo({ url: '/pagesBase/family/inviteList' })
  },

  handleDissolve() {
    const group = familyStore.getMyGroupState() || wx.getStorageSync('myGroup')
    if (!group || !group.id) {
      wx.showToast({
        title: '家庭组信息不存在',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '警告',
      content: '解散后所有成员将退出家庭组，此操作不可恢复，确定要解散吗？',
      confirmText: '确定解散',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (!res.confirm) return

        try {
          await deleteGroup(group.id)
          wx.showToast({
            title: '解散成功',
            icon: 'success'
          })
          familyStore.clearGroup()
          setTimeout(() => {
            wx.switchTab({ url: '/pages/my/my' })
          }, 1500)
        } catch (error) {}
      }
    })
  }
})
