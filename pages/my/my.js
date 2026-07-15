const http = require('../../api/request')
const { logout, stopVersionPolling } = require('../../api/login')
const sessionStore = require('../../stores/session')
const familyStore = require('../../stores/family')
const { redirectToLogin } = require('../../utils/auth')

Page({
  data: {
    userInfo: {},
    avatarUrl: '',
    hasCustomAvatar: false,
    avatarInitial: 'IW',
    profileSub: '点击完善个人资料',
    familyDesc: '未加入家庭组',
    isLoading: false
  },

  onShow() {
    this.fetchUserInfo()
    this.refreshFamilyGroup()
  },

  async fetchUserInfo() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })

    try {
      const res = await http.get('/auth-service/user/getUserInfo')
      const userInfo = res.data || {}
      wx.setStorageSync('userInfo', userInfo)
      this.setUserInfo(userInfo)
    } catch (error) {
      const cached = wx.getStorageSync('userInfo')
      if (cached) {
        this.setUserInfo(cached)
      }
    } finally {
      this.setData({ isLoading: false })
    }
  },

  setUserInfo(userInfo) {
    const profileSub = userInfo.phoneNumber || userInfo.emailAddress || '点击完善个人资料'
    const avatarUrl = userInfo.avatar || ''
    this.setData({
      userInfo,
      avatarUrl,
      hasCustomAvatar: Boolean(avatarUrl),
      avatarInitial: this.getAvatarInitial(userInfo),
      profileSub
    })
  },

  getAvatarInitial(userInfo) {
    const displayName = ((userInfo && userInfo.name) || '').trim()
    if (!displayName) return 'IW'

    const [firstChar] = Array.from(displayName)
    return /[a-z]/i.test(firstChar) ? firstChar.toUpperCase() : firstChar
  },

  async refreshFamilyGroup() {
    await familyStore.fetchMyGroup()
    this.setData({
      familyDesc: familyStore.hasGroup() ? familyStore.groupName() : '未加入家庭组'
    })
  },

  goProfile() {
    wx.navigateTo({ url: '/pagesBase/my/profile' })
  },

  goFamilyGroup() {
    wx.navigateTo({
      url: familyStore.hasGroup() ? '/pagesBase/family/detail' : '/pagesBase/family/index'
    })
  },

  goSecurity() {
    wx.navigateTo({ url: '/pagesBase/my/security' })
  },

  goSettings() {
    wx.navigateTo({ url: '/pagesBase/my/settings' })
  },

  clickLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return

        stopVersionPolling()
        logout().catch(() => {})
        sessionStore.clearLoginSession()
        familyStore.clearGroup()
        redirectToLogin()
      }
    })
  },

  previewAvatar() {
    if (!this.data.hasCustomAvatar) return

    wx.previewImage({
      current: this.data.avatarUrl,
      urls: [this.data.avatarUrl]
    })
  }
})
