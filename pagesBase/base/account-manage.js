const baseApi = require('../../api/base')
const dictStore = require('../../stores/dict')

function normalizeAccount(item) {
  return {
    ...item,
    typeName: dictStore.getDictNameByCode(
      dictStore.dictTypeEnum.AUTH_APPLICATION_ACCOUNT_TYPE,
      item.type,
      item.type || '-'
    )
  }
}

Page({
  data: {
    accountList: [],
    filterForm: {
      name: '',
      address: ''
    },
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadMoreText: '加载更多',
    showPasswordPopup: false,
    passwordToShow: ''
  },

  onShow() {
    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.fetchPage(false)
  },

  async initPage() {
    this.setData({
      currentPage: 1,
      accountList: [],
      hasMore: true,
      loadMoreText: '加载中...'
    })
    await this.fetchPage(true)
  },

  async fetchPage(reset) {
    if (this.data.loading) return
    this.setData({ loading: true, loadMoreText: '加载中...' })
    try {
      const res = await baseApi.getAccountPage({
        currentPage: this.data.currentPage,
        pageSize: this.data.pageSize,
        ...this.data.filterForm
      })
      const rows = ((res.data && res.data.records) || []).map(normalizeAccount)
      const accountList = reset ? rows : this.data.accountList.concat(rows)
      const total = (res.data && res.data.total) || accountList.length
      this.setData({
        accountList,
        hasMore: accountList.length < total,
        loadMoreText: accountList.length < total ? '加载更多' : (accountList.length ? '没有更多了' : '暂无数据')
      })
    } catch (error) {
      this.setData({ loadMoreText: this.data.accountList.length ? '加载更多' : '暂无数据' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onFilterInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`filterForm.${field}`]: event.detail.value })
  },

  applyFilter() {
    this.initPage()
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pagesBase/base/account-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  goAdd() {
    wx.navigateTo({ url: '/pagesBase/base/account-detail' })
  },

  async viewPassword(event) {
    const id = event.currentTarget.dataset.id
    const res = await baseApi.viewAccountPassword(id)
    this.setData({
      passwordToShow: res.data || '',
      showPasswordPopup: true
    })
  },

  copyPassword() {
    wx.setClipboardData({
      data: this.data.passwordToShow || '',
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  closePasswordPopup() {
    this.setData({
      showPasswordPopup: false,
      passwordToShow: ''
    })
  },

  noop() {}
})
