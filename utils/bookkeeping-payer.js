const familyStore = require('../stores/family')
const scopeStore = require('../stores/family-shared-scope')
const familyApi = require('../api/family')
const session = require('../stores/session')

function currentUserId() {
  const user = session.getUserInfo() || {}
  return user.id == null ? null : Number(user.id)
}

function payerText(item, scope) {
  if (!scope || !scope.hasGroup || Number(item.recordCategory) !== 1) return ''
  const payerId = item.expenseUserId == null ? item.userId : item.expenseUserId
  if (payerId == null || Number(payerId) === currentUserId()) return ''
  const name = item.expenseUserName || (Number(payerId) === Number(item.userId) ? item.userName : '') || '家庭成员'
  return ` · 支出人：${name}`
}

const data = {
  showPayer: false,
  payerOptions: [],
  payerIndex: 0,
  payerName: '我',
  payerDisabled: false,
  payerSharedLocked: false,
  payerHistorical: false
}

const methods = {
  async initPayerSelector() {
    this._sharedBeforePayer = undefined
    this.setData({ payerDisabled: true })
    await familyStore.ensureMyGroupLoaded()
    const group = familyStore.getMyGroupState()
    let options = [{ userId: currentUserId(), name: '我' }]
    if (group && !scopeStore.isChildRole() && !this.data.isTemplateMode) {
      try {
        const res = await familyApi.getMemberList(group.id)
        options = options.concat((res.data || []).filter(member => Number(member.userId) !== currentUserId())
          .map(member => ({ userId: Number(member.userId), name: member.name || member.username || '家庭成员' })))
      } catch (error) {
        wx.showToast({ title: '家庭成员加载失败，请重试', icon: 'none' })
      }
    }
    this.setData({ payerOptions: options })
    this.syncPayerState()
  },

  syncPayerState() {
    const form = this.data.formData
    const expense = Number(form.recordCategory) === 1
    const payerId = form.expenseUserId == null ? currentUserId() : Number(form.expenseUserId)
    let options = this.data.payerOptions || []
    if (!options.length) options = [{ userId: currentUserId(), name: '我' }]
    let index = options.findIndex(option => Number(option.userId) === payerId)
    if (index < 0 && expense) {
      options = options.concat([{ userId: payerId, name: form.expenseUserName || '原支出人' }])
      index = options.length - 1
    }
    const delegated = expense && payerId != null && payerId !== currentUserId()
    const historical = form.canChangeExpenseUser === false && delegated && !form.taskSource
    this.setData({
      showPayer: scopeStore.hasGroup() && expense && !this.data.isTemplateMode,
      payerOptions: options,
      payerIndex: Math.max(0, index),
      payerName: options[Math.max(0, index)].name,
      payerDisabled: this.data.isSubmitting || scopeStore.isChildRole() || form.canChangeExpenseUser === false,
      payerHistorical: historical,
      payerSharedLocked: delegated || historical,
      'formData.expenseUserId': expense ? payerId : null,
      ...(delegated && !historical ? { 'formData.shared': 1, isShared: true } : {})
    })
  },

  onPayerChange(event) {
    if (this.data.isSubmitting || this.data.payerDisabled) return
    const selected = this.data.payerOptions[Number(event.detail.value)]
    if (!selected) return
    const oldId = this.data.formData.expenseUserId
    const delegated = Number(selected.userId) !== currentUserId()
    if (delegated && Number(oldId) === currentUserId()) this._sharedBeforePayer = this.data.formData.shared
    const shared = delegated ? 1 : (this._sharedBeforePayer == null ? this.data.formData.shared : this._sharedBeforePayer)
    this.setData({
      'formData.expenseUserId': Number(selected.userId),
      'formData.expenseUserName': selected.name,
      'formData.shared': shared,
      isShared: Number(shared) === 1
    })
    this.syncPayerState()
  }
}

module.exports = { currentUserId, payerText, data, methods }
