const { getInviteList } = require('../../api/family')
const familyStore = require('../../stores/family')

function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getStatusText(status) {
  const statusMap = {
    1: '待使用',
    2: '已使用',
    4: '已过期'
  }
  return statusMap[status] || '未知'
}

function getStatusClass(status) {
  const classMap = {
    1: 'pending',
    2: 'accepted',
    4: 'expired'
  }
  return classMap[status] || ''
}

Page({
  data: {
    inviteList: []
  },

  onLoad() {
    this.fetchInviteList()
  },

  async fetchInviteList() {
    const group = familyStore.getMyGroupState() || wx.getStorageSync('myGroup')
    if (!group || !group.id) return

    try {
      const res = await getInviteList(group.id)
      this.setData({
        inviteList: (res.data || []).map((invite) => ({
          ...invite,
          statusText: getStatusText(invite.status),
          statusClass: getStatusClass(invite.status),
          expireTimeText: formatTime(invite.expireTime),
          createTimeText: formatTime(invite.createTime)
        }))
      })
    } catch (error) {}
  },

  handleCopy(event) {
    const code = event.currentTarget.dataset.code
    if (!code) return

    wx.setClipboardData({
      data: code,
      success() {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  }
})
