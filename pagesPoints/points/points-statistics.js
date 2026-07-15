const pointsApi = require('../../api/points')

function calcNet(statistics) {
  return Number((statistics && statistics.increasePoints) || 0) + Number((statistics && statistics.deductPoints) || 0)
}

Page({
  data: {
    totalPoints: 0,
    statistics: {},
    rangeStart: '',
    rangeEnd: '',
    showCurrentMonth: true,
    netPoints: 0,
    netPointsText: '+0'
  },

  onShow() {
    this.fetchData()
  },

  async fetchData() {
    const params = {
      createStartTime: this.data.rangeStart,
      createEndTime: this.data.rangeEnd
    }
    try {
      const [balanceRes, statisticsRes] = await Promise.all([
        pointsApi.getPointsBalance(),
        pointsApi.getPointsRecordStatistics(params)
      ])
      const statistics = statisticsRes.data || {}
      const netPoints = calcNet(statistics)
      this.setData({
        totalPoints: balanceRes.data || 0,
        statistics,
        netPoints,
        netPointsText: `${netPoints > 0 ? '+' : ''}${netPoints}`
      })
    } catch (error) {
      this.setData({
        totalPoints: 0,
        statistics: {},
        netPoints: 0,
        netPointsText: '+0'
      })
    }
  },

  onStartDateChange(event) {
    this.setData({ rangeStart: event.detail.value, showCurrentMonth: false })
    this.fetchData()
  },

  onEndDateChange(event) {
    this.setData({ rangeEnd: event.detail.value, showCurrentMonth: false })
    this.fetchData()
  },

  resetRange() {
    this.setData({
      rangeStart: '',
      rangeEnd: '',
      showCurrentMonth: true
    })
    this.fetchData()
  }
})
