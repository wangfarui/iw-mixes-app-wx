const wardrobeApi = require('../../api/wardrobe')
const helper = require('./wardrobe-helper')

function defaultForm() {
  return {
    wearDate: helper.today(),
    outfitId: '',
    recordType: 2,
    sceneTags: '',
    weatherText: '',
    moodText: '',
    remark: ''
  }
}

Page({
  data: {
    month: helper.currentMonth(),
    records: [],
    outfitOptions: [],
    outfitIndex: 0,
    recordTypeOptions: [
      { value: 2, text: '已穿' },
      { value: 1, text: '计划' }
    ],
    recordTypeIndex: 0,
    formData: defaultForm(),
    sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), ''),
    loading: false
  },

  onLoad() {
    this.loadOutfits()
    this.loadMonthRecords()
  },

  onShow() {
    this.setData({
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), this.data.formData.sceneTags)
    })
  },

  onPullDownRefresh() {
    Promise.all([this.loadOutfits(), this.loadMonthRecords()]).finally(() => wx.stopPullDownRefresh())
  },

  async loadOutfits() {
    const res = await wardrobeApi.getOutfitPage({
      currentPage: 1,
      pageSize: 100,
      status: 1
    })
    const rows = ((res.data && res.data.records) || []).map(helper.formatOutfit)
    this.setData({
      outfitOptions: rows.map((item) => ({
        value: item.id,
        text: item.outfitName
      }))
    })
  },

  async loadMonthRecords() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wardrobeApi.getWearRecordMonth({ month: this.data.month })
      this.setData({ records: (res.data || []).map(helper.formatRecord) })
    } finally {
      this.setData({ loading: false })
    }
  },

  onMonthChange(event) {
    this.setData({ month: event.detail.value })
    this.loadMonthRecords()
  },

  onWearDateChange(event) {
    this.setData({ 'formData.wearDate': event.detail.value })
  },

  onOutfitChange(event) {
    const outfitIndex = Number(event.detail.value)
    const option = this.data.outfitOptions[outfitIndex]
    this.setData({
      outfitIndex,
      'formData.outfitId': option ? option.value : ''
    })
  },

  onRecordTypeChange(event) {
    const recordTypeIndex = Number(event.detail.value)
    const option = this.data.recordTypeOptions[recordTypeIndex]
    this.setData({
      recordTypeIndex,
      'formData.recordType': option.value
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  toggleScene(event) {
    const value = event.currentTarget.dataset.value
    const next = helper.toggleTag(this.data.formData.sceneTags, value)
    this.setData({
      'formData.sceneTags': next,
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), next)
    })
  },

  async submitRecord() {
    const form = this.data.formData
    if (!form.outfitId) {
      wx.showToast({ title: '请选择搭配', icon: 'none' })
      return
    }
    await wardrobeApi.addWearRecord({
      wearDate: form.wearDate,
      outfitId: Number(form.outfitId),
      recordType: Number(form.recordType),
      sceneTags: form.sceneTags || '',
      weatherText: form.weatherText || '',
      moodText: form.moodText || '',
      remark: form.remark || ''
    })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({
      formData: defaultForm(),
      sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), ''),
      recordTypeIndex: 0
    })
    this.loadMonthRecords()
  },

  markRecordWorn(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      content: '将这条计划标记为已穿？',
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.markWearRecordWorn(id)
        wx.showToast({ title: '已记录', icon: 'success' })
        this.loadMonthRecords()
      }
    })
  },

  copyRecord(event) {
    const id = event.currentTarget.dataset.id
    const targetDate = this.data.formData.wearDate || helper.today()
    wx.showModal({
      content: `复制到 ${targetDate}？`,
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.copyWearRecord({
          id,
          targetDate,
          recordType: Number(this.data.formData.recordType || 1)
        })
        wx.showToast({ title: '已复制', icon: 'success' })
        this.loadMonthRecords()
      }
    })
  },

  deleteRecord(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      content: '确定删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        await wardrobeApi.deleteWearRecord(id)
        wx.showToast({ title: '已删除', icon: 'success' })
        this.loadMonthRecords()
      }
    })
  }
})
