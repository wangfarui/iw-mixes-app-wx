const http = require('../../api/request')
const scopeStore = require('../../stores/family-shared-scope')
const familyStore = require('../../stores/family')

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getToday() {
  return formatDate(new Date())
}

function getSevenDaysLater() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return formatDate(date)
}

function getDeadlineClass(deadline) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(deadline)
  end.setHours(0, 0, 0, 0)
  const diff = (end - today) / (1000 * 60 * 60 * 24)
  if (diff <= 0) return 'deadline-red'
  if (diff <= 7) return 'deadline-yellow'
  return 'deadline-black'
}

Page({
  data: {
    currentDate: '',
    billTotalAmount: '0.00',
    billRecords: [],
    showBillMore: false,
    taskRecords: [],
    taskTotalCount: 0,
    showTaskMore: false,
    pointsBalance: 0,
    pointsRecords: [],
    showPointsMore: false,
    recipes: [],
    scope: scopeStore.getScopeState(),
    weatherInfo: {
      city: '',
      weather: '',
      temperature: '',
      error: false
    }
  },

  onShow() {
    this.updateCurrentDate()
    this.refreshScope().then(() => this.refreshAll())
  },

  onPullDownRefresh() {
    this.updateCurrentDate()
    this.refreshScope()
      .then(() => this.refreshAll())
      .finally(() => wx.stopPullDownRefresh())
  },

  async refreshScope() {
    await familyStore.fetchMyGroup()
    this.setData({ scope: scopeStore.getScopeState() })
  },

  updateCurrentDate() {
    const now = new Date()
    this.setData({
      currentDate: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
    })
  },

  async refreshAll() {
    await Promise.all([
      this.fetchBillTotalAmount(),
      this.fetchBillRecords(),
      this.fetchWeather(),
      this.fetchTaskRecords(),
      this.fetchPointsBalance(),
      this.fetchPointsRecords(),
      this.fetchRecipes()
    ])
  },

  async fetchWeather() {
    try {
      const res = await http.get('/external-service/api/system/getWeather')
      const lives = res && res.data && res.data.lives
      if (Array.isArray(lives) && lives.length > 0) {
        this.setData({
          weatherInfo: {
            city: lives[0].city,
            weather: lives[0].weather,
            temperature: lives[0].temperature,
            error: false
          }
        })
      } else {
        this.setData({ weatherInfo: { city: '', weather: '', temperature: '', error: true } })
      }
    } catch (error) {
      this.setData({ weatherInfo: { city: '', weather: '', temperature: '', error: true } })
    }
  },

  async fetchBillTotalAmount() {
    const today = getToday()
    try {
      const res = await http.post('/bookkeeping-service/bookkeeping/consume/totalStatistics', {
        recordCategory: 1,
        currentStartMonth: today,
        currentEndMonth: today,
        queryOnlyMyself: scopeStore.getQueryOnlyMyself()
      })
      this.setData({ billTotalAmount: (res.data && res.data.totalAmount) || '0.00' })
    } catch (error) {
      this.setData({ billTotalAmount: '0.00' })
    }
  },

  async fetchBillRecords() {
    const today = getToday()
    try {
      const res = await http.post('/bookkeeping-service/bookkeeping/records/page', {
        recordStartDate: today,
        recordEndDate: today,
        recordCategory: 1,
        pageSize: 4,
        queryOnlyMyself: scopeStore.getQueryOnlyMyself()
      })
      const records = (res.data && res.data.records) || []
      this.setData({
        showBillMore: records.length > 3,
        billRecords: records.slice(0, 3).map((item) => ({
          time: (item.recordTime || '').slice(11, 16),
          desc: this.formatBillRecordDesc(item),
          amount: item.amount
        }))
      })
    } catch (error) {
      this.setData({ billRecords: [], showBillMore: false })
    }
  },

  formatBillRecordDesc(item) {
    const desc = item.recordSource || (item.recordCategory === 2 ? '收入' : '消费')
    const scope = scopeStore.getScopeState()
    if (scope.effectiveScope === 'shared' && item.userName && !item.canEdit) {
      return `${item.userName} · ${desc}`
    }
    return desc
  },

  async fetchTaskRecords() {
    try {
      const res = await http.post('/points-service/points/task/basics/list', {
        sortDeadline: true,
        endDeadlineDate: getSevenDaysLater()
      })
      const records = res.data || []
      this.setData({
        taskTotalCount: records.length,
        showTaskMore: records.length > 3,
        taskRecords: records.slice(0, 3).map((item) => ({
          title: item.taskName,
          deadline: item.deadlineDate || '',
          deadlineClass: item.deadlineDate ? getDeadlineClass(item.deadlineDate) : ''
        }))
      })
    } catch (error) {
      this.setData({ taskRecords: [], taskTotalCount: 0, showTaskMore: false })
    }
  },

  async fetchPointsBalance() {
    try {
      const res = await http.get('/points-service/points/total/getPointsBalance')
      this.setData({ pointsBalance: res.data || 0 })
    } catch (error) {
      this.setData({ pointsBalance: 0 })
    }
  },

  async fetchPointsRecords() {
    const today = getToday()
    try {
      const res = await http.post('/points-service/points/records/page', {
        createStartTime: today,
        createEndTime: today,
        pageSize: 4
      })
      const records = (res.data && res.data.records) || []
      this.setData({
        showPointsMore: records.length > 3,
        pointsRecords: records.slice(0, 3).map((item) => ({
          time: (item.createTime || '').slice(11, 16),
          desc: item.source,
          points: item.points,
          displayPoints: `${item.points >= 0 ? '+' : ''}${item.points}`,
          isAdd: item.points >= 0
        }))
      })
    } catch (error) {
      this.setData({ pointsRecords: [], showPointsMore: false })
    }
  },

  async fetchRecipes() {
    try {
      const res = await http.get('/eat-service/eat/dishes/recommendDishes')
      const recipes = (res.data || []).map((item) => ({
        id: item.id,
        name: item.dishesName,
        image: item.dishesImage
      }))
      this.setData({ recipes })
    } catch (error) {
      this.setData({ recipes: [] })
    }
  },

  navigateToBill() {
    wx.navigateTo({ url: '/pagesBookkeeping/bookkeeping/bookkeeping-records' })
  },

  navigateToTask() {
    wx.switchTab({ url: '/pages/task/index' })
  },

  navigateToPoints() {
    wx.navigateTo({ url: '/pagesPoints/points/points-records' })
  },

  navigateToRecipes() {
    wx.navigateTo({ url: '/pagesEat/eat/recipe/index' })
  },

  navigateToQuickBookkeep() {
    wx.navigateTo({ url: '/pagesBookkeeping/bookkeeping/bookkeeping-quick' })
  },

  navigateToDishesDetail(event) {
    wx.navigateTo({
      url: `/pagesEat/eat/dishes/dishes-detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
