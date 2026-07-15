const { validateInvite, joinGroup } = require('../../api/family')
const familyStore = require('../../stores/family')

function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function goDetailAfterSuccess() {
  const pages = getCurrentPages()
  const delta = pages.length - 1

  if (delta > 0) {
    wx.navigateBack({
      delta,
      success() {
        setTimeout(() => {
          wx.navigateTo({ url: '/pagesBase/family/detail' })
        }, 100)
      },
      fail() {
        wx.redirectTo({ url: '/pagesBase/family/detail' })
      }
    })
    return
  }

  wx.redirectTo({ url: '/pagesBase/family/detail' })
}

Page({
  data: {
    codeArray: ['', '', '', '', '', '', '', ''],
    focusIndex: 0,
    inviteInfo: null,
    expireText: '',
    hasCurrentGroup: false,
    isValidating: false,
    isJoining: false
  },

  onLoad() {
    setTimeout(() => {
      this.setData({
        focusIndex: 0,
        hasCurrentGroup: familyStore.hasGroup()
      })
    }, 100)
  },

  handleFocus(event) {
    this.setData({
      focusIndex: Number(event.currentTarget.dataset.index)
    })
  },

  handleInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const value = String(event.detail.value || '').toUpperCase()
    const char = value.charAt(0)
    const codeArray = this.data.codeArray.slice()
    codeArray[index] = char

    this.setData({
      codeArray,
      focusIndex: char && index < 7 ? index + 1 : index,
      inviteInfo: null,
      expireText: ''
    })
  },

  getInviteCode() {
    return this.data.codeArray.join('')
  },

  async handleValidate() {
    const inviteCode = this.getInviteCode()
    if (inviteCode.length !== 8) {
      wx.showToast({
        title: '请输入完整的邀请码',
        icon: 'none'
      })
      return
    }

    if (this.data.isValidating) return
    this.setData({ isValidating: true })

    try {
      const res = await validateInvite(inviteCode)
      this.setData({
        inviteInfo: res.data,
        expireText: formatTime(res.data && res.data.expireTime),
        hasCurrentGroup: familyStore.hasGroup()
      })
    } catch (error) {
    } finally {
      this.setData({ isValidating: false })
    }
  },

  async handleJoin() {
    if (familyStore.hasGroup()) {
      wx.showToast({
        title: '请先退出当前家庭组',
        icon: 'none'
      })
      this.setData({ hasCurrentGroup: true })
      return
    }

    if (this.data.isJoining) return
    this.setData({ isJoining: true })

    try {
      await joinGroup({ inviteCode: this.getInviteCode() })
      wx.showToast({
        title: '加入成功',
        icon: 'success'
      })
      await familyStore.fetchMyGroup()
      setTimeout(goDetailAfterSuccess, 1500)
    } catch (error) {
    } finally {
      this.setData({ isJoining: false })
    }
  }
})
