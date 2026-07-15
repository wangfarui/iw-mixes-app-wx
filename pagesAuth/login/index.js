const {
  loginByPasswordApi,
  loginByVerificationCodeApi,
  registerByVerificationCodeInviteApi,
  getPhoneVerificationCodeApi,
  getEmailVerificationCodeApi,
  refreshDictCache,
  startVersionPolling
} = require('../../api/login')
const sessionStore = require('../../stores/session')
const loginHistoryStore = require('../../stores/login-history')

const { LOGIN_WAY } = loginHistoryStore

Page({
  data: {
    form: {
      account: '',
      password: '',
      verificationCode: ''
    },
    loginWay: LOGIN_WAY.PASSWORD,
    accountPlaceholder: '请输入用户名/邮箱/手机号',
    accountMaxLength: 64,
    isCountingDown: false,
    isGettingCode: false,
    isSubmitting: false,
    showInviteDialog: false,
    inviteCode: '',
    registerTicket: '',
    isSubmittingInvite: false,
    count: 60,
    verificationButtonText: '获取验证码',
    showFirstLoginLoading: false,
    loadingProgress: 0,
    historyRecords: [],
    historyRecordIndex: 0,
    historyLabel: '已保存账号',
    canDeleteHistory: false
  },

  onLoad() {
    this.loadLoginHistory(LOGIN_WAY.PASSWORD, true)
  },

  onUnload() {
    this.clearCountdown()
    this.clearProgressTimer()
  },

  onAccountInput(event) {
    const account = event.detail.value
    const historyRecordIndex = this.data.historyRecords.findIndex((item) => item.account === account.trim())
    this.setData({
      'form.account': account,
      historyRecordIndex: historyRecordIndex >= 0 ? historyRecordIndex : 0,
      canDeleteHistory: historyRecordIndex >= 0
    })
  },

  onPasswordInput(event) {
    this.setData({ 'form.password': event.detail.value })
  },

  onVerificationCodeInput(event) {
    this.setData({ 'form.verificationCode': event.detail.value })
  },

  onInviteCodeInput(event) {
    const inviteCode = String(event.detail.value || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6)
    this.setData({ inviteCode })
  },

  switchToPassword() {
    this.setLoginWay(LOGIN_WAY.PASSWORD)
  },

  switchToPhone() {
    this.setLoginWay(LOGIN_WAY.PHONE)
  },

  switchToEmail() {
    this.setLoginWay(LOGIN_WAY.EMAIL)
  },

  setLoginWay(loginWay) {
    const isPhone = loginWay === LOGIN_WAY.PHONE
    const isEmail = loginWay === LOGIN_WAY.EMAIL

    this.setData({
      loginWay,
      accountPlaceholder: isPhone ? '请输入手机号' : isEmail ? '请输入邮箱' : '请输入用户名/邮箱/手机号',
      accountMaxLength: isPhone ? 11 : 64,
      'form.verificationCode': ''
    }, () => {
      this.loadLoginHistory(loginWay, true)
    })
  },

  getHistoryLabel(loginWay) {
    if (loginWay === LOGIN_WAY.PHONE) return '已保存手机号'
    if (loginWay === LOGIN_WAY.EMAIL) return '已保存邮箱'
    return '已保存账号'
  },

  loadLoginHistory(loginWay, fillFirstRecord) {
    const historyRecords = loginHistoryStore.getHistory(loginWay)
    const currentAccount = String(this.data.form.account || '').trim()
    let historyRecordIndex = historyRecords.findIndex((item) => item.account === currentAccount)

    if (fillFirstRecord) {
      historyRecordIndex = historyRecords.length ? 0 : -1
    }

    const record = historyRecordIndex >= 0 ? historyRecords[historyRecordIndex] : null
    const data = {
      historyRecords,
      historyRecordIndex: Math.max(historyRecordIndex, 0),
      historyLabel: this.getHistoryLabel(loginWay),
      canDeleteHistory: Boolean(record)
    }

    if (fillFirstRecord) {
      data['form.account'] = record ? record.account : ''
      data['form.password'] = loginWay === LOGIN_WAY.PASSWORD && record ? record.password : ''
    }

    this.setData(data)
  },

  onHistoryChange(event) {
    const historyRecordIndex = Number(event.detail.value)
    const record = this.data.historyRecords[historyRecordIndex]
    if (!record) return

    const data = {
      historyRecordIndex,
      canDeleteHistory: true,
      'form.account': record.account,
      'form.verificationCode': ''
    }
    if (this.data.loginWay === LOGIN_WAY.PASSWORD) {
      data['form.password'] = record.password
    }
    this.setData(data)
  },

  deleteCurrentHistory() {
    if (!this.data.canDeleteHistory) return
    const record = this.data.historyRecords[this.data.historyRecordIndex]
    if (!record) return

    wx.showModal({
      title: '删除登录记录',
      content: `确认删除「${record.account}」的缓存记录吗？`,
      confirmText: '删除',
      confirmColor: '#fa5151',
      success: (res) => {
        if (!res.confirm) return
        loginHistoryStore.removeHistory(this.data.loginWay, record.account)
        this.loadLoginHistory(this.data.loginWay, true)
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  isValidPhoneNumber(phone) {
    return /^1[3-9]\d{9}$/.test(phone)
  },

  isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
  },

  async getVerificationCode() {
    if (this.data.isCountingDown || this.data.isGettingCode) return

    const { account } = this.data.form
    const { loginWay } = this.data
    const isEmail = loginWay === LOGIN_WAY.EMAIL

    if (!account) {
      wx.showToast({ icon: 'error', title: `请输入${isEmail ? '邮箱' : '手机号'}` })
      return
    }

    if (isEmail && !this.isValidEmail(account)) {
      wx.showToast({ icon: 'error', title: '邮箱格式错误' })
      return
    }

    if (!isEmail && !this.isValidPhoneNumber(account)) {
      wx.showToast({ icon: 'error', title: '手机号格式错误' })
      return
    }

    this.setData({ isGettingCode: true })
    try {
      if (isEmail) {
        await getEmailVerificationCodeApi(account)
      } else {
        await getPhoneVerificationCodeApi(account)
      }
      wx.showToast({ icon: 'success', title: '验证码已发送' })
      this.startCountdown()
    } finally {
      this.setData({ isGettingCode: false })
    }
  },

  startCountdown() {
    if (this.data.isCountingDown) return
    this.setData({
      isCountingDown: true,
      count: 60,
      verificationButtonText: '60s重试'
    })

    this.countdownTimer = setInterval(() => {
      const nextCount = this.data.count - 1
      if (nextCount <= 0) {
        this.clearCountdown()
        return
      }
      this.setData({
        count: nextCount,
        verificationButtonText: `${nextCount}s重试`
      })
    }, 1000)
  },

  clearCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    this.setData({
      isCountingDown: false,
      count: 60,
      verificationButtonText: '获取验证码'
    })
  },

  handleLogin() {
    if (this.data.isSubmitting) return

    if (!this.data.form.account) {
      wx.showToast({ icon: 'none', title: '请输入账号' })
      return
    }

    if (this.data.loginWay === LOGIN_WAY.PASSWORD) {
      if (!this.data.form.password) {
        wx.showToast({ icon: 'none', title: '请输入密码' })
        return
      }

      if (loginHistoryStore.hasHistory(LOGIN_WAY.PASSWORD, this.data.form.account, this.data.form.password)) {
        this.doPasswordLogin()
        return
      }

      wx.showModal({
        title: '提示',
        content: '是否记住账号密码？',
        success: (res) => {
          if (res.confirm) {
            this.saveLoginHistory()
          }
          this.doPasswordLogin()
        }
      })
      return
    }

    if (!this.data.form.verificationCode) {
      wx.showToast({ icon: 'none', title: '请输入验证码' })
      return
    }

    if (loginHistoryStore.hasHistory(this.data.loginWay, this.data.form.account)) {
      this.doVerificationCodeLogin()
      return
    }

    const accountType = this.data.loginWay === LOGIN_WAY.EMAIL ? '邮箱' : '手机号'
    wx.showModal({
      title: '提示',
      content: `是否记住${accountType}？`,
      success: (res) => {
        if (res.confirm) {
          this.saveLoginHistory()
        }
        this.doVerificationCodeLogin()
      }
    })
  },

  saveLoginHistory() {
    loginHistoryStore.saveHistory(
      this.data.loginWay,
      this.data.form.account,
      this.data.form.password
    )
    this.loadLoginHistory(this.data.loginWay, false)
  },

  async doPasswordLogin() {
    this.setData({ isSubmitting: true })
    wx.showLoading({ title: '登录中' })

    try {
      const res = await loginByPasswordApi(this.data.form)
      this.loginSuccessAfter(res)
    } finally {
      this.setData({ isSubmitting: false })
      wx.hideLoading()
    }
  },

  async doVerificationCodeLogin() {
    const loginForm = {
      ...this.data.form,
      loginWay: this.data.loginWay
    }

    if (this.data.loginWay === LOGIN_WAY.PHONE) {
      loginForm.phoneNumber = loginForm.account
    } else {
      loginForm.emailAddress = loginForm.account
    }

    this.setData({ isSubmitting: true })
    wx.showLoading({ title: '登录中' })

    try {
      const res = await loginByVerificationCodeApi(loginForm)
      const userInfo = res.data || {}
      if (userInfo.inviteRequired) {
        this.openInviteDialog(userInfo.registerTicket)
        return
      }
      this.loginSuccessAfter(res)
    } finally {
      this.setData({ isSubmitting: false })
      wx.hideLoading()
    }
  },

  openInviteDialog(registerTicket) {
    this.setData({
      showInviteDialog: true,
      registerTicket: registerTicket || '',
      inviteCode: ''
    })
  },

  closeInviteDialog() {
    this.setData({
      showInviteDialog: false,
      registerTicket: '',
      inviteCode: '',
      isSubmittingInvite: false
    })
  },

  async submitInviteCode() {
    if (this.data.isSubmittingInvite) return

    if (!this.data.registerTicket) {
      wx.showToast({ icon: 'none', title: '请重新获取验证码' })
      this.closeInviteDialog()
      return
    }

    if (!/^[0-9A-Z]{6}$/.test(this.data.inviteCode)) {
      wx.showToast({ icon: 'none', title: '请输入6位邀请码' })
      return
    }

    this.setData({ isSubmittingInvite: true })
    wx.showLoading({ title: '注册中' })
    try {
      const res = await registerByVerificationCodeInviteApi({
        registerTicket: this.data.registerTicket,
        inviteCode: this.data.inviteCode
      })
      this.closeInviteDialog()
      this.loginSuccessAfter(res)
    } finally {
      this.setData({ isSubmittingInvite: false })
      wx.hideLoading()
    }
  },

  loginSuccessAfter(res) {
    const userInfo = res.data
    sessionStore.setLoginSession(userInfo)
    startVersionPolling()

    if (userInfo && userInfo.newUser) {
      this.showFirstLoginProgress()
      return
    }

    refreshDictCache(true)
    wx.switchTab({ url: '/pages/home/index' })
  },

  showFirstLoginProgress() {
    this.setData({
      showFirstLoginLoading: true,
      loadingProgress: 0
    })

    this.progressTimer = setInterval(() => {
      const nextProgress = this.data.loadingProgress + 1
      this.setData({ loadingProgress: nextProgress })

      if (nextProgress >= 100) {
        this.clearProgressTimer()
        this.setData({ showFirstLoginLoading: false })
        refreshDictCache(true)
        wx.switchTab({ url: '/pages/home/index' })
      }
    }, 50)
  },

  clearProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
  }
})
