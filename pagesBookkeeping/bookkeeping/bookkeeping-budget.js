const bookkeepingApi = require('../../api/bookkeeping')
const dictStore = require('../../stores/dict')
const utils = require('../../utils/bookkeeping')

function emptyForm() {
  return {
    budgetAmount: '',
    rewardPoints: '',
    punishPoints: '',
    recordType: ''
  }
}

function formatBudget(item) {
  const budgetAmount = Number(item && item.budgetAmount || 0)
  const usedAmount = Number(item && item.usedAmount || 0)
  const remainingAmount = Number(item && item.remainingAmount || budgetAmount - usedAmount)
  const ratio = item && item.usedRatio != null
    ? utils.percent(item.usedRatio)
    : utils.percent(budgetAmount > 0 ? (usedAmount / budgetAmount) * 100 : 0)

  return {
    ...(item || {}),
    budgetAmount,
    usedAmount,
    remainingAmount,
    usedRatio: ratio,
    budgetAmountText: utils.formatMoney(budgetAmount),
    usedAmountText: utils.formatMoney(usedAmount),
    remainingAmountText: utils.formatMoney(remainingAmount),
    recordTypeName: utils.getRecordTypeName(item && item.recordType, '总预算')
  }
}

Page({
  data: {
    budgetType: 1,
    totalBudget: null,
    categoryBudgets: [],
    showForm: false,
    showActions: false,
    isCategoryForm: false,
    isEditing: false,
    currentBudget: null,
    formData: emptyForm(),
    recordTypeOptions: [],
    recordTypeIndex: 0,
    recordTypeName: ''
  },

  onShow() {
    this.refreshOptions()
    this.fetchBudgetData()
  },

  refreshOptions() {
    this.setData({
      recordTypeOptions: dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TYPE)
    })
  },

  getCategoryBudgetType() {
    return this.data.budgetType === 1 ? 11 : 21
  },

  async fetchBudgetData() {
    try {
      const [totalRes, categoryRes] = await Promise.all([
        bookkeepingApi.getTotalBudget(this.data.budgetType),
        bookkeepingApi.getCategoryBudget(this.getCategoryBudgetType())
      ])
      this.setData({
        totalBudget: formatBudget(totalRes.data),
        categoryBudgets: (categoryRes.data || []).map(formatBudget)
      })
    } catch (error) {
      this.setData({
        totalBudget: null,
        categoryBudgets: []
      })
    }
  },

  selectBudgetType(event) {
    const budgetType = Number(event.currentTarget.dataset.type)
    if (budgetType === this.data.budgetType) return
    this.setData({ budgetType })
    this.fetchBudgetData()
  },

  openForm(event) {
    const isCategoryForm = Number(event.currentTarget.dataset.category) === 1
    this.setData({
      showForm: true,
      isCategoryForm,
      isEditing: false,
      currentBudget: null,
      formData: emptyForm(),
      recordTypeIndex: 0,
      recordTypeName: ''
    })
  },

  closeForm() {
    this.setData({
      showForm: false,
      isEditing: false,
      currentBudget: null,
      formData: emptyForm(),
      recordTypeName: ''
    })
  },

  onRecordTypeChange(event) {
    const recordTypeIndex = Number(event.detail.value)
    const option = this.data.recordTypeOptions[recordTypeIndex]
    this.setData({
      recordTypeIndex,
      recordTypeName: option ? option.dictName : '',
      'formData.recordType': option ? option.dictCode : ''
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  openActions(event) {
    const index = Number(event.currentTarget.dataset.index)
    const currentBudget = index === -1 ? this.data.totalBudget : this.data.categoryBudgets[index]
    if (!currentBudget || !currentBudget.id) return
    this.setData({
      showActions: true,
      currentBudget,
      isCategoryForm: index !== -1
    })
  },

  closeActions() {
    this.setData({
      showActions: false,
      currentBudget: null
    })
  },

  async editBudget() {
    const currentBudget = this.data.currentBudget
    this.setData({ showActions: false })
    if (!currentBudget || !currentBudget.id) return

    try {
      const res = await bookkeepingApi.getBudgetDetail(currentBudget.id)
      const detail = res.data || currentBudget
      const recordTypeIndex = this.data.recordTypeOptions.findIndex((item) => item.dictCode === detail.recordType)
      this.setData({
        showForm: true,
        isEditing: true,
        currentBudget: detail,
        formData: {
          budgetAmount: detail.budgetAmount || '',
          rewardPoints: detail.rewardPoints || '',
          punishPoints: detail.punishPoints || '',
          recordType: detail.recordType || ''
        },
        recordTypeIndex: recordTypeIndex >= 0 ? recordTypeIndex : 0,
        recordTypeName: detail.recordType ? utils.getRecordTypeName(detail.recordType, '') : ''
      })
    } catch (error) {
      wx.showToast({ title: '获取预算失败', icon: 'none' })
    }
  },

  saveBudget() {
    const amount = Number(this.data.formData.budgetAmount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入大于0的金额', icon: 'none' })
      return
    }
    if (this.data.isCategoryForm && !this.data.formData.recordType) {
      wx.showToast({ title: '请选择记录分类', icon: 'none' })
      return
    }

    const payload = {
      budgetType: this.data.isCategoryForm ? this.getCategoryBudgetType() : this.data.budgetType,
      budgetAmount: amount
    }

    if (this.data.isCategoryForm) payload.recordType = this.data.formData.recordType
    if (this.data.budgetType === 1) {
      if (this.data.formData.rewardPoints !== '') payload.rewardPoints = Number(this.data.formData.rewardPoints)
      if (this.data.formData.punishPoints !== '') payload.punishPoints = Number(this.data.formData.punishPoints)
    }
    if (this.data.isEditing && this.data.currentBudget) payload.id = this.data.currentBudget.id

    const request = this.data.isEditing ? bookkeepingApi.updateBudget(payload) : bookkeepingApi.addBudget(payload)
    request.then(() => {
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.closeForm()
      this.fetchBudgetData()
    })
  },

  confirmDeleteBudget() {
    const currentBudget = this.data.currentBudget
    if (!currentBudget || !currentBudget.id) return
    wx.showModal({
      title: '提示',
      content: '确定要删除该预算吗？',
      confirmText: '删除',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (!res.confirm) return
        await bookkeepingApi.deleteBudget(currentBudget.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.closeActions()
        this.fetchBudgetData()
      }
    })
  },

  goToRecords(event) {
    const index = Number(event.currentTarget.dataset.index)
    const budget = this.data.categoryBudgets[index]
    if (!budget) return
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-records?recordType=${budget.recordType}`
    })
  },

  noop() {}
})
