const bookkeepingApi = require('../../api/bookkeeping')
const utils = require('../../utils/bookkeeping')

function formatWallet(wallet) {
  return {
    ...(wallet || {}),
    walletBalanceText: utils.formatMoney(wallet && wallet.walletBalance),
    walletAssetsText: utils.formatMoney(wallet && wallet.walletAssets)
  }
}

function formatRecord(item) {
  const changeAmount = Number(item.changeAmount || 0)
  return {
    ...item,
    changeAmount,
    changeAmountText: `${changeAmount > 0 ? '+' : ''}${utils.formatMoney(changeAmount)}`,
    beforeAmountText: utils.formatMoney(item.beforeAmount),
    afterAmountText: utils.formatMoney(item.afterAmount)
  }
}

Page({
  data: {
    wallet: formatWallet({}),
    records: [],
    currentType: 1,
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多',
    showUpdatePopup: false,
    updateMode: 'direct',
    updateAmount: '',
    updateType: 1,
    currentTypeName: '修改余额'
  },

  onShow() {
    this.refreshAll()
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchRecords(false)
  },

  async refreshAll() {
    await this.fetchWallet()
    this.resetRecords()
    await this.fetchRecords(true)
  },

  async fetchWallet() {
    try {
      const res = await bookkeepingApi.getWalletDetail()
      this.setData({ wallet: formatWallet(res.data || {}) })
    } catch (error) {
      this.setData({ wallet: formatWallet({}) })
    }
  },

  resetRecords() {
    this.setData({
      records: [],
      currentPage: 1,
      hasMore: true,
      loadMoreText: '加载中...'
    })
  },

  async fetchRecords(reset) {
    if (this.data.loading || (!reset && !this.data.hasMore)) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await bookkeepingApi.getWalletRecordPage({
        changeType: this.data.currentType,
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize
      })
      const rows = ((res.data && res.data.records) || []).map(formatRecord)
      const records = reset ? rows : this.data.records.concat(rows)
      const total = (res.data && res.data.total) || records.length
      this.setData({
        records,
        hasMore: records.length < total,
        loadMoreText: records.length < total ? '加载更多' : (records.length ? '没有更多了' : '暂无记录')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.records.length ? '加载更多' : '暂无记录' })
    } finally {
      this.setData({ loading: false })
    }
  },

  switchType(event) {
    const currentType = Number(event.currentTarget.dataset.type)
    if (currentType === this.data.currentType) return
    this.setData({ currentType })
    this.resetRecords()
    this.fetchRecords(true)
  },

  showUpdateSheet(event) {
    const updateType = Number(event.currentTarget.dataset.type)
    this.setData({
      showUpdatePopup: true,
      updateType,
      currentTypeName: updateType === 1 ? '修改余额' : '修改资产',
      updateMode: 'direct',
      updateAmount: ''
    })
  },

  closeUpdatePopup() {
    this.setData({
      showUpdatePopup: false,
      updateAmount: ''
    })
  },

  selectUpdateMode(event) {
    this.setData({ updateMode: event.currentTarget.dataset.mode, updateAmount: '' })
  },

  onUpdateAmountInput(event) {
    this.setData({ updateAmount: event.detail.value })
  },

  async submitUpdateAmount() {
    const rawAmount = String(this.data.updateAmount || '').trim()
    if (!rawAmount || !/^-?\d+(\.\d{0,2})?$/.test(rawAmount)) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    const amount = Number(rawAmount)
    if (!Number.isFinite(amount) || (this.data.updateMode === 'direct' && amount < 0)) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }

    const currentAmount = this.data.updateType === 1
      ? Number(this.data.wallet.walletBalance || 0)
      : Number(this.data.wallet.walletAssets || 0)
    const updateAmount = this.data.updateMode === 'direct' ? amount : currentAmount + amount

    await bookkeepingApi.updateWalletAmount({
      changeType: this.data.updateType,
      updateAmount
    })
    wx.showToast({ title: '更新成功', icon: 'success' })
    this.closeUpdatePopup()
    this.refreshAll()
  },

  noop() {}
})
