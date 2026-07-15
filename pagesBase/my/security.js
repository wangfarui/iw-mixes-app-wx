const securityApi = require('../../api/security')
const { stopVersionPolling } = require('../../api/login')
const sessionStore = require('../../stores/session')
const familyStore = require('../../stores/family')
const { redirectToLogin } = require('../../utils/auth')

Page({
  data: {
    userInfo: {
      username: '',
      phoneNumber: '',
      emailAddress: '',
      phoneBound: false,
      emailBound: false,
      canEditUsername: false,
      hasPassword: false,
      roleType: 1
    },
    isSuperAdmin: false,
    isLoading: false
  },

  onShow() {
    this.fetchUserInfo()
  },

  normalizeUserInfo(userInfo) {
    return {
      ...userInfo,
      phoneBound: userInfo.phoneBound === undefined ? Boolean(userInfo.phoneNumber) : Boolean(userInfo.phoneBound),
      emailBound: userInfo.emailBound === undefined ? Boolean(userInfo.emailAddress) : Boolean(userInfo.emailBound),
      canEditUsername: Boolean(userInfo.canEditUsername),
      hasPassword: Boolean(userInfo.hasPassword)
    }
  },

  async fetchUserInfo() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })
    try {
      const res = await securityApi.getUserInfo()
      const userInfo = this.normalizeUserInfo(res.data || {})
      wx.setStorageSync('userInfo', userInfo)
      this.setData({
        userInfo,
        isSuperAdmin: Number(userInfo.roleType) === 20
      })
    } catch (error) {
      wx.showToast({ title: '获取用户信息失败', icon: 'none' })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  handleUsername() {
    if (!this.data.userInfo.canEditUsername) {
      wx.showToast({ title: '用户名仅允许修改一次', icon: 'none' })
      return
    }
    this.goSecurityAction('username', 'edit')
  },

  handlePhone() {
    const { phoneBound, emailBound } = this.data.userInfo
    if (!phoneBound) {
      this.goSecurityAction('phone', 'bind')
      return
    }
    wx.showActionSheet({
      itemList: ['更换手机号', '解绑手机号'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.goSecurityAction('phone', 'change')
          return
        }
        if (!emailBound) {
          wx.showToast({ title: '请先绑定邮箱', icon: 'none' })
          return
        }
        this.goSecurityAction('phone', 'unbind')
      }
    })
  },

  handleEmail() {
    const { phoneBound, emailBound } = this.data.userInfo
    if (!emailBound) {
      this.goSecurityAction('email', 'bind')
      return
    }
    wx.showActionSheet({
      itemList: ['更换邮箱', '解绑邮箱'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.goSecurityAction('email', 'change')
          return
        }
        if (!phoneBound) {
          wx.showToast({ title: '请先绑定手机号', icon: 'none' })
          return
        }
        this.goSecurityAction('email', 'unbind')
      }
    })
  },

  handlePassword() {
    this.goSecurityAction('password', this.data.userInfo.hasPassword ? 'change' : 'set')
  },

  goSecurityAction(action, mode) {
    wx.navigateTo({ url: `/pagesBase/my/securityAction?action=${action}&mode=${mode}` })
  },

  goRegisterInvite() {
    wx.navigateTo({ url: '/pagesBase/my/registerInvite' })
  },

  handleDeleteAccount() {
    wx.showModal({
      title: '确认注销',
      content: '注销后账号将被永久删除，且无法恢复。是否继续？',
      confirmText: '确认注销',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const http = require('../../api/request')
          await http.get('/auth-service/user/deletion')
          stopVersionPolling()
          sessionStore.clearLoginSession()
          familyStore.clearGroup()
          redirectToLogin()
        } catch (error) {
          wx.showToast({ title: '注销失败', icon: 'error' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  }
})
