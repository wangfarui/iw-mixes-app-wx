const securityApi = require('../../api/security')
const loginHistoryStore = require('../../stores/login-history')
const sessionStore = require('../../stores/session')
const familyStore = require('../../stores/family')
const dictStore = require('../../stores/dict')
const eatCartStore = require('../../stores/eat-cart')
const { stopVersionPolling } = require('../../api/login')
const { redirectToLogin } = require('../../utils/auth')

const { CONTACT_TYPE, VERIFY_METHOD, SECURITY_OPERATION } = securityApi

const ACTION_CONFIG = {
  'phone:bind': { title: '绑定手机号', operation: SECURITY_OPERATION.BIND_PHONE, contactType: CONTACT_TYPE.PHONE },
  'phone:change': { title: '更换手机号', operation: SECURITY_OPERATION.CHANGE_PHONE, contactType: CONTACT_TYPE.PHONE },
  'phone:unbind': { title: '解绑手机号', operation: SECURITY_OPERATION.UNBIND_PHONE, contactType: CONTACT_TYPE.PHONE, unbind: true },
  'email:bind': { title: '绑定邮箱', operation: SECURITY_OPERATION.BIND_EMAIL, contactType: CONTACT_TYPE.EMAIL },
  'email:change': { title: '更换邮箱', operation: SECURITY_OPERATION.CHANGE_EMAIL, contactType: CONTACT_TYPE.EMAIL },
  'email:unbind': { title: '解绑邮箱', operation: SECURITY_OPERATION.UNBIND_EMAIL, contactType: CONTACT_TYPE.EMAIL, unbind: true },
  'username:edit': { title: '修改用户名', operation: SECURITY_OPERATION.EDIT_USERNAME, username: true },
  'password:set': { title: '设置密码', operation: SECURITY_OPERATION.SET_PASSWORD, password: true },
  'password:change': { title: '修改密码', operation: SECURITY_OPERATION.CHANGE_PASSWORD, password: true },
  'account:delete': { title: '注销账号', operation: SECURITY_OPERATION.DELETE_ACCOUNT, accountDeletion: true }
}

Page({
  data: {
    pageReady: false,
    pageTitle: '账号安全',
    nextStepText: '确认信息',
    step: 'verify',
    config: {},
    userInfo: {},
    verificationMethods: [],
    verificationMethodIndex: 0,
    verificationMethod: VERIFY_METHOD.PHONE,
    securityCode: '',
    securityPassword: '',
    securityCodeButtonText: '获取验证码',
    securityCountdown: 0,
    isSendingSecurityCode: false,
    isVerifying: false,
    contact: '',
    contactCode: '',
    contactPlaceholder: '',
    contactCodeButtonText: '获取验证码',
    contactCountdown: 0,
    isSendingContactCode: false,
    username: '',
    newPassword: '',
    confirmPassword: '',
    isSubmitting: false
  },

  onLoad(options) {
    const config = ACTION_CONFIG[`${options.action}:${options.mode}`]
    if (!config) {
      wx.showToast({ title: '不支持的安全操作', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.config = config
    wx.setNavigationBarTitle({ title: config.title })
    this.setData({
      config,
      pageTitle: config.title,
      nextStepText: config.accountDeletion ? '确认注销' : config.unbind ? '确认解绑' : config.username ? '设置用户名' : config.password ? '设置密码' : '验证新联系方式',
      contactPlaceholder: config.contactType === CONTACT_TYPE.PHONE ? '请输入新手机号' : '请输入新邮箱'
    })
    this.loadUserInfo()
  },

  onUnload() {
    this.clearCountdown('security')
    this.clearCountdown('contact')
  },

  async loadUserInfo() {
    try {
      const res = await securityApi.getUserInfo()
      const userInfo = res.data || {}
      const verificationMethods = this.buildVerificationMethods(userInfo)
      if (!verificationMethods.length) {
        wx.showToast({ title: '当前账号没有可用验证方式', icon: 'none' })
        wx.navigateBack()
        return
      }
      const preferredIndex = this.getPreferredMethodIndex(verificationMethods)
      wx.setStorageSync('userInfo', userInfo)
      this.setData({
        userInfo,
        verificationMethods,
        verificationMethodIndex: preferredIndex,
        verificationMethod: verificationMethods[preferredIndex].value,
        pageReady: true
      })
    } catch (error) {
      wx.navigateBack()
    }
  },

  buildVerificationMethods(userInfo) {
    const methods = []
    if (userInfo.phoneBound || userInfo.phoneNumber) {
      methods.push({ value: VERIFY_METHOD.PHONE, label: '手机验证码', target: userInfo.phoneNumber || '' })
    }
    if (userInfo.emailBound || userInfo.emailAddress) {
      methods.push({ value: VERIFY_METHOD.EMAIL, label: '邮箱验证码', target: userInfo.emailAddress || '' })
    }
    if (userInfo.hasPassword) {
      methods.push({ value: VERIFY_METHOD.PASSWORD, label: '登录密码', target: '' })
    }
    return methods
  },

  getPreferredMethodIndex(methods) {
    if (this.config.contactType === CONTACT_TYPE.PHONE) {
      const index = methods.findIndex((item) => item.value === VERIFY_METHOD.PHONE)
      if (index >= 0) return index
    }
    if (this.config.contactType === CONTACT_TYPE.EMAIL) {
      const index = methods.findIndex((item) => item.value === VERIFY_METHOD.EMAIL)
      if (index >= 0) return index
    }
    return 0
  },

  selectVerificationMethod(event) {
    if (this.data.isVerifying) return
    const index = Number(event.currentTarget.dataset.index)
    const method = this.data.verificationMethods[index]
    if (!method) return
    this.setData({
      verificationMethodIndex: index,
      verificationMethod: method.value,
      securityCode: '',
      securityPassword: ''
    })
  },

  onSecurityCodeInput(event) {
    this.setData({ securityCode: String(event.detail.value || '').replace(/\D/g, '').slice(0, 6) })
  },

  onSecurityPasswordInput(event) {
    this.setData({ securityPassword: event.detail.value })
  },

  async sendSecurityCode() {
    if (this.data.securityCountdown || this.data.isSendingSecurityCode) return
    if (this.data.verificationMethod === VERIFY_METHOD.PASSWORD) return
    this.setData({ isSendingSecurityCode: true })
    try {
      await securityApi.sendSecurityVerificationCode(this.config.operation, this.data.verificationMethod)
      wx.showToast({ title: '验证码已发送', icon: 'success' })
      this.startCountdown('security')
    } finally {
      this.setData({ isSendingSecurityCode: false })
    }
  },

  async submitIdentityVerification() {
    if (this.data.isVerifying) return
    const isPassword = this.data.verificationMethod === VERIFY_METHOD.PASSWORD
    if (isPassword && !this.data.securityPassword) {
      wx.showToast({ title: '请输入登录密码', icon: 'none' })
      return
    }
    if (!isPassword && !/^\d{6}$/.test(this.data.securityCode)) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }

    this.setData({ isVerifying: true })
    try {
      const res = await securityApi.verifySecurityIdentity({
        operation: this.config.operation,
        method: this.data.verificationMethod,
        verificationCode: isPassword ? undefined : this.data.securityCode,
        password: isPassword ? this.data.securityPassword : undefined
      })
      this.securityTicket = res.data && res.data.securityTicket
      if (!this.securityTicket) {
        throw new Error('安全票据缺失')
      }
      this.setData({ step: this.config.unbind || this.config.accountDeletion ? 'confirm' : 'target' })
    } finally {
      this.setData({ isVerifying: false })
    }
  },

  onContactInput(event) {
    this.setData({ contact: event.detail.value, contactCode: '' })
  },

  onContactCodeInput(event) {
    this.setData({ contactCode: String(event.detail.value || '').replace(/\D/g, '').slice(0, 6) })
  },

  getNormalizedContact() {
    const contact = String(this.data.contact || '').trim()
    return this.config.contactType === CONTACT_TYPE.EMAIL ? contact.toLowerCase() : contact
  },

  validateContact(contact) {
    if (this.config.contactType === CONTACT_TYPE.PHONE) {
      return /^1[3-9]\d{9}$/.test(contact)
    }
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(contact)
  },

  async sendContactCode() {
    if (this.data.contactCountdown || this.data.isSendingContactCode) return
    const contact = this.getNormalizedContact()
    if (!this.validateContact(contact)) {
      wx.showToast({ title: this.config.contactType === CONTACT_TYPE.PHONE ? '手机号格式错误' : '邮箱格式错误', icon: 'none' })
      return
    }
    this.setData({ isSendingContactCode: true, contact })
    try {
      await securityApi.sendContactVerificationCode({
        securityTicket: this.securityTicket,
        contactType: this.config.contactType,
        contact
      })
      wx.showToast({ title: '验证码已发送', icon: 'success' })
      this.startCountdown('contact')
    } finally {
      this.setData({ isSendingContactCode: false })
    }
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value })
  },

  onNewPasswordInput(event) {
    this.setData({ newPassword: event.detail.value })
  },

  onConfirmPasswordInput(event) {
    this.setData({ confirmPassword: event.detail.value })
  },

  submitTarget() {
    if (this.config.username) {
      this.submitUsername()
      return
    }
    if (this.config.password) {
      this.submitPassword()
      return
    }
    this.submitContact()
  },

  async submitContact() {
    if (this.data.isSubmitting) return
    const contact = this.getNormalizedContact()
    if (!this.validateContact(contact)) {
      wx.showToast({ title: this.config.contactType === CONTACT_TYPE.PHONE ? '手机号格式错误' : '邮箱格式错误', icon: 'none' })
      return
    }
    if (!/^\d{6}$/.test(this.data.contactCode)) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }
    await this.runSubmit(() => securityApi.updateContact({
      securityTicket: this.securityTicket,
      contactType: this.config.contactType,
      contact,
      verificationCode: this.data.contactCode
    }))
  },

  async submitUsername() {
    if (this.data.isSubmitting) return
    const username = String(this.data.username || '').trim()
    if (!username) {
      wx.showToast({ title: '用户名不能为空', icon: 'none' })
      return
    }
    if (username.length > 64) {
      wx.showToast({ title: '用户名不能超过64位', icon: 'none' })
      return
    }
    if (/^u_/i.test(username)) {
      wx.showToast({ title: '用户名不能以u_开头', icon: 'none' })
      return
    }
    if (/^1[3-9]\d{9}$/.test(username) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(username)) {
      wx.showToast({ title: '用户名不能使用手机号或邮箱', icon: 'none' })
      return
    }
    await this.runSubmit(() => securityApi.editUsername({ securityTicket: this.securityTicket, username }))
  },

  async submitPassword() {
    if (this.data.isSubmitting) return
    if (!this.data.newPassword) {
      wx.showToast({ title: '请输入新密码', icon: 'none' })
      return
    }
    if (this.data.newPassword.length > 64) {
      wx.showToast({ title: '密码不能超过64位', icon: 'none' })
      return
    }
    if (this.data.newPassword !== this.data.confirmPassword) {
      wx.showToast({ title: '两次密码输入不一致', icon: 'none' })
      return
    }
    await this.runSubmit(() => securityApi.editPassword({
      securityTicket: this.securityTicket,
      newPassword: this.data.newPassword
    }))
  },

  confirmUnbind() {
    wx.showModal({
      title: this.config.title,
      content: '确认继续当前解绑操作？',
      confirmText: '确认解绑',
      confirmColor: '#d92d20',
      success: (res) => {
        if (!res.confirm) return
        this.runSubmit(() => securityApi.unbindContact({
          securityTicket: this.securityTicket,
          contactType: this.config.contactType
        }))
      }
    })
  },

  confirmAccountDeletion() {
    if (this.data.isSubmitting) return
    wx.showModal({
      title: '最终确认',
      content: '注销后原账号无法恢复登录，并会撤回该账号原先共享给家庭组的记账记录。确认继续注销？',
      confirmText: '确认注销',
      confirmColor: '#d92d20',
      success: (res) => {
        if (!res.confirm) return
        this.submitAccountDeletion()
      }
    })
  },

  async submitAccountDeletion() {
    this.setData({ isSubmitting: true })
    wx.showLoading({ title: '注销中...' })
    try {
      await securityApi.deleteAccount({ securityTicket: this.securityTicket })
      stopVersionPolling()
      sessionStore.clearLoginSession()
      familyStore.clearGroup()
      dictStore.clearDictCache()
      eatCartStore.clearCartItems()
      loginHistoryStore.clearHistory()
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.userInfo = null
      }
      wx.showToast({ title: '账号已注销', icon: 'success' })
      setTimeout(() => redirectToLogin(), 500)
    } finally {
      wx.hideLoading()
      this.setData({ isSubmitting: false })
    }
  },

  async runSubmit(request) {
    this.setData({ isSubmitting: true })
    wx.showLoading({ title: '提交中...' })
    try {
      const res = await request()
      const userInfo = res.data || {}
      wx.setStorageSync('userInfo', userInfo)
      loginHistoryStore.clearHistory()
      wx.showToast({ title: '操作成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } finally {
      wx.hideLoading()
      this.setData({ isSubmitting: false })
    }
  },

  startCountdown(kind) {
    this.clearCountdown(kind)
    const countField = `${kind}Countdown`
    const textField = `${kind}CodeButtonText`
    this.setData({ [countField]: 60, [textField]: '60s后重试' })
    const timerName = `${kind}CountdownTimer`
    this[timerName] = setInterval(() => {
      const next = this.data[countField] - 1
      if (next <= 0) {
        this.clearCountdown(kind)
        return
      }
      this.setData({ [countField]: next, [textField]: `${next}s后重试` })
    }, 1000)
  },

  clearCountdown(kind) {
    const timerName = `${kind}CountdownTimer`
    if (this[timerName]) {
      clearInterval(this[timerName])
      this[timerName] = null
    }
    const countField = `${kind}Countdown`
    const textField = `${kind}CodeButtonText`
    this.setData({ [countField]: 0, [textField]: '获取验证码' })
  }
})
