const { getBaseUrl, tokenHeader } = require('../api/env')

const menuList = [
  {
    title: '厨房重地',
    components: [
      { url: '/static/menus/eat-recipe.png', text: '食谱', path: '/pagesEat/eat/recipe/index' },
      { url: '/static/menus/eat-dishes.png', text: '点餐', path: '/pagesEat/eat/dishes/index' },
      { url: '/static/menus/eat-meal.png', text: '用餐记录', path: '/pagesEat/eat/meal/index' },
      { url: '/static/menus/eat-fridge.png', text: '冰箱', path: '/pagesEat/eat/fridge/index' }
    ]
  },
  {
    title: '财务记账',
    components: [
      { url: '/static/menus/bookkeeping-action.png', text: '记账', path: '/pagesBookkeeping/bookkeeping/bookkeeping-action' },
      { url: '/static/menus/bookkeeping-wallet.png', text: '钱包', path: '/pagesBookkeeping/bookkeeping/bookkeeping-wallet' },
      { url: '/static/menus/bookkeeping-membership-subscription.png', text: '会员订阅', path: '/pagesBookkeeping/bookkeeping/bookkeeping-membership-subscription' },
      { url: '/static/menus/bookkeeping-yearly-statistics.png', text: '年度统计', path: '/pagesBookkeeping/bookkeeping/bookkeeping-yearly-statistics' }
    ]
  },
  {
    title: '衣柜穿搭',
    components: [
      { url: '/static/menus/wardrobe-item.png', text: '衣物', path: '/pagesWardrobe/wardrobe/item-list' },
      { url: '/static/menus/wardrobe-outfit.png', text: '搭配', path: '/pagesWardrobe/wardrobe/outfit-list' },
      { url: '/static/menus/wardrobe-record.png', text: '穿着记录', path: '/pagesWardrobe/wardrobe/index' },
      { url: '/static/menus/wardrobe-statistics.png', text: '穿搭统计', path: '/pagesWardrobe/wardrobe/statistics' }
    ]
  },
  {
    title: '积分任务',
    components: [
      { url: '/static/menus/points-action.png', text: '新增积分', path: '/pagesPoints/points/points-action' },
      { url: '/static/menus/points-records.png', text: '积分记录', path: '/pagesPoints/points/points-records' },
      { url: '/static/menus/points-task.png', text: '任务计划', path: '/pagesPoints/points/task-plan' },
      { url: '/static/menus/task-list.png', text: '常用任务', path: '/pagesPoints/points/task-list' }
    ]
  },
  {
    title: '基础功能',
    components: [
      { url: '/static/menus/dict-manage.png', text: '字典管理', path: '/pagesBase/base/dict-manage' },
      { url: '/static/menus/account-manage.png', text: '账号管理', path: '/pagesBase/base/account-manage' }
    ]
  }
]

function filterMenus(keyword) {
  const value = (keyword || '').trim().toLowerCase()
  if (!value) return menuList

  return menuList
    .map((menu) => ({
      ...menu,
      components: menu.components.filter((item) => item.text.toLowerCase().includes(value))
    }))
    .filter((menu) => menu.components.length > 0)
}

function decodeUnicodeText(text) {
  if (!text) return ''
  return text
    .replace(/\\u([a-fA-F0-9]{4})/g, (match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\u\{([a-fA-F0-9]+)\}/g, (match, code) => String.fromCodePoint(parseInt(code, 16)))
}

Page({
  data: {
    searchValue: '',
    showDialog: false,
    loading: false,
    dialogList: [],
    scrollToId: '',
    filteredMenuList: menuList
  },

  onUnload() {
    this.closeSocket()
  },

  handleSearch(event) {
    const searchValue = event.detail.value
    this.setData({
      searchValue,
      filteredMenuList: filterMenus(searchValue)
    })
  },

  handleAsk(event) {
    const value = (event.detail.value || this.data.searchValue || '').trim()
    if (!value) return

    const dialogList = this.data.dialogList.concat({ question: value, answer: '' }).slice(-10)
    this.setData({
      showDialog: true,
      loading: true,
      searchValue: '',
      dialogList,
      filteredMenuList: menuList,
      scrollToId: `dialog-item-${dialogList.length - 1}`
    })

    if (!this.socketOpen) {
      this.connectWebSocket(() => this.sendMessage(value))
    } else {
      this.sendMessage(value)
    }
  },

  connectWebSocket(onConnected) {
    this.closeSocket()

    const domain = getBaseUrl().replace('http://', 'ws://').replace('https://', 'wss://')
    this.socketTask = wx.connectSocket({
      url: `${domain}/external-service/wb/chat-ws`,
      header: tokenHeader()
    })

    this.socketTask.onOpen(() => {
      this.socketOpen = true
      this.setData({ loading: false })
      if (onConnected) onConnected()
    })

    this.socketTask.onMessage((res) => {
      const dialogList = this.data.dialogList.slice()
      const current = dialogList[dialogList.length - 1]
      if (!current) return

      current.answer = `${current.answer || ''}${decodeUnicodeText(res.data)}`
      this.setData({
        loading: false,
        dialogList,
        scrollToId: `dialog-item-${dialogList.length - 1}`
      })
    })

    this.socketTask.onClose(() => {
      this.socketOpen = false
      this.setData({ loading: false })
    })

    this.socketTask.onError(() => {
      this.socketOpen = false
      const dialogList = this.data.dialogList.slice()
      if (dialogList.length > 0) {
        dialogList[dialogList.length - 1].answer = '连接失败，请重试'
      }
      this.setData({ loading: false, dialogList })
      wx.showToast({ title: '连接失败', icon: 'none' })
    })
  },

  sendMessage(message) {
    if (!this.socketTask || !this.socketOpen) return
    this.socketTask.send({
      data: message,
      fail: () => wx.showToast({ title: '发送失败', icon: 'none' })
    })
  },

  closeSocket() {
    if (this.socketTask) {
      this.socketTask.close()
      this.socketTask = null
    }
    this.socketOpen = false
  },

  exitDialog() {
    this.closeSocket()
    this.setData({
      showDialog: false,
      searchValue: '',
      dialogList: [],
      loading: false,
      scrollToId: '',
      filteredMenuList: menuList
    })
  },

  copyDialogText(event) {
    const text = event.currentTarget.dataset.text
    if (!text) return
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '已复制', icon: 'none' })
      }
    })
  },

  handleNavigate(event) {
    wx.navigateTo({
      url: event.currentTarget.dataset.path
    })
  }
})
