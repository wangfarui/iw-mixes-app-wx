const eatApi = require('../../../api/eat')
const dictStore = require('../../../stores/dict')
const utils = require('../../../utils/bookkeeping')
const helper = require('../eat-helper')

function fallbackMealTimeOptions() {
  return [
    { value: 1, text: '早餐' },
    { value: 2, text: '午餐' },
    { value: 3, text: '晚餐' }
  ]
}

Page({
  data: {
    cartItems: [],
    cartSummary: helper.calcCartSummary([]),
    mealTimeOptions: [],
    mealTimeIndex: 0,
    mealTimeName: '',
    submitting: false,
    formData: {
      mealDate: utils.today(),
      mealTime: '',
      diners: '',
      remark: ''
    }
  },

  onShow() {
    const options = helper.optionList(dictStore.dictTypeEnum.EAT_MEAL_TIME)
    const mealTimeOptions = options.length ? options : fallbackMealTimeOptions()
    this.setData({
      mealTimeOptions,
      mealTimeName: mealTimeOptions[0] ? mealTimeOptions[0].text : '',
      'formData.mealTime': mealTimeOptions[0] ? mealTimeOptions[0].value : ''
    })
    this.refreshCart()
  },

  refreshCart(cartItems) {
    const items = cartItems || helper.getCartItems()
    this.setData({
      cartItems: items,
      cartSummary: helper.calcCartSummary(items)
    })
  },

  onMealDateChange(event) {
    this.setData({ 'formData.mealDate': event.detail.value })
  },

  onMealTimeChange(event) {
    const mealTimeIndex = Number(event.detail.value)
    const option = this.data.mealTimeOptions[mealTimeIndex]
    this.setData({
      mealTimeIndex,
      mealTimeName: option ? option.text : '',
      'formData.mealTime': option ? option.value : ''
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  removeCartItem(event) {
    const cartItems = helper.removeCartItem(event.currentTarget.dataset.id)
    this.refreshCart(cartItems)
  },

  clearCart() {
    if (!this.data.cartItems.length) return
    wx.showModal({
      content: '确定清空购物车吗？',
      success: (res) => {
        if (!res.confirm) return
        this.refreshCart(helper.clearCartItems())
      }
    })
  },

  goDishDetail(event) {
    wx.navigateTo({ url: `/pagesEat/eat/dishes/dishes-detail?id=${event.currentTarget.dataset.id}&mode=order` })
  },

  async submitMeal() {
    if (this.data.submitting) return
    if (!this.data.formData.mealDate) {
      wx.showToast({ title: '请选择用餐日期', icon: 'none' })
      return
    }
    if (this.data.formData.mealTime === '') {
      wx.showToast({ title: '请选择用餐时间', icon: 'none' })
      return
    }
    if (!this.data.cartItems.length) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }
    if (this.data.formData.diners !== '') {
      const diners = Number(this.data.formData.diners)
      if (!Number.isInteger(diners) || diners < 0 || diners >= 99) {
        wx.showToast({ title: '用餐人数格式有误', icon: 'none' })
        return
      }
    }

    this.setData({ submitting: true })
    try {
      const res = await eatApi.addMeal({
        mealDate: this.data.formData.mealDate,
        mealTime: Number(this.data.formData.mealTime),
        diners: this.data.formData.diners === '' ? 0 : Number(this.data.formData.diners),
        remark: this.data.formData.remark || '',
        mealMenuList: this.data.cartItems.map((item) => ({
          dishesId: item.id,
          dishesName: item.dishesName
        }))
      })
      helper.clearCartItems()
      this.refreshCart([])
      wx.showToast({ title: '下单成功', icon: 'success' })
      const mealId = res && res.data
      setTimeout(() => {
        if (mealId) {
          wx.redirectTo({ url: `/pagesEat/eat/meal/meal-detail?id=${mealId}` })
        } else {
          wx.navigateBack()
        }
      }, 600)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
