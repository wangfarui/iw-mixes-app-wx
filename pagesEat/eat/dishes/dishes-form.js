const eatApi = require('../../../api/eat')
const dictStore = require('../../../stores/dict')
const fileStore = require('../../../stores/file')
const helper = require('../eat-helper')

function defaultForm() {
  return {
    id: '',
    name: '',
    coverImage: '',
    category: '',
    difficulty: 0,
    estimatedTime: '',
    price: '',
    remark: '',
    ingredients: [],
    steps: []
  }
}

Page({
  data: {
    formData: defaultForm(),
    categoryOptions: [],
    categoryIndex: 0,
    categoryName: '',
    difficultyOptions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    difficultyIndex: 0
  },

  onLoad(options = {}) {
    this.setData({ categoryOptions: helper.optionList(dictStore.dictTypeEnum.EAT_DISHES_TYPE) })
    if (options.id) this.getDishDetail(options.id)
  },

  async getDishDetail(id) {
    const res = await eatApi.getDishesDetail(id)
    const detail = res.data || {}
    const categoryIndex = this.data.categoryOptions.findIndex((item) => Number(item.value) === Number(detail.dishesType))
    const difficulty = Number(detail.difficultyFactor || 0)
    this.setData({
      formData: {
        id: detail.id,
        name: detail.dishesName || '',
        coverImage: detail.dishesImage || '',
        category: detail.dishesType || '',
        difficulty,
        estimatedTime: detail.useTime || '',
        price: detail.prices || '',
        remark: detail.remark || '',
        ingredients: (detail.dishesMaterialList || []).map((item) => ({
          name: item.materialName || '',
          amount: item.materialDosage || '',
          price: item.materialPrice || '',
          needToBuy: Number(item.isPurchase) === 1 || item.isPurchase === true
        })),
        steps: (detail.dishesCreationMethodList || []).map((item) => ({
          image: item.stepImage || '',
          description: item.stepContent || ''
        }))
      },
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      categoryName: helper.dictName(dictStore.dictTypeEnum.EAT_DISHES_TYPE, detail.dishesType, ''),
      difficultyIndex: difficulty
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const option = this.data.categoryOptions[categoryIndex]
    this.setData({
      categoryIndex,
      categoryName: option ? option.text : '',
      'formData.category': option ? option.value : ''
    })
  },

  onDifficultyChange(event) {
    const difficultyIndex = Number(event.detail.value)
    this.setData({
      difficultyIndex,
      'formData.difficulty': this.data.difficultyOptions[difficultyIndex]
    })
  },

  chooseFile() {
    return new Promise((resolve, reject) => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        success: (res) => resolve(res.tempFiles[0].tempFilePath),
        fail: reject
      })
    })
  },

  async chooseCoverImage() {
    const filePath = await this.chooseFile()
    const fileRes = await fileStore.uploadFile(filePath)
    this.setData({ 'formData.coverImage': fileRes.fileUrl || fileRes })
  },

  async chooseStepImage(event) {
    const index = Number(event.currentTarget.dataset.index)
    const filePath = await this.chooseFile()
    const fileRes = await fileStore.uploadFile(filePath)
    this.setData({ [`formData.steps[${index}].image`]: fileRes.fileUrl || fileRes })
  },

  addIngredient() {
    const ingredients = this.data.formData.ingredients.concat({
      name: '',
      amount: '',
      price: '',
      needToBuy: false
    })
    this.setData({ 'formData.ingredients': ingredients })
  },

  removeIngredient(event) {
    const index = Number(event.currentTarget.dataset.index)
    const ingredients = this.data.formData.ingredients.filter((_, i) => i !== index)
    this.setData({ 'formData.ingredients': ingredients })
  },

  handleIngredientInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.ingredients[${index}].${field}`]: event.detail.value })
  },

  toggleIngredientPurchase(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`formData.ingredients[${index}].needToBuy`]: Boolean(event.detail.value) })
  },

  moveIngredient(event) {
    const index = Number(event.currentTarget.dataset.index)
    const direction = event.currentTarget.dataset.direction
    const target = direction === 'up' ? index - 1 : index + 1
    const ingredients = this.data.formData.ingredients.slice()
    if (target < 0 || target >= ingredients.length) return
    const temp = ingredients[index]
    ingredients[index] = ingredients[target]
    ingredients[target] = temp
    this.setData({ 'formData.ingredients': ingredients })
  },

  addStep() {
    this.setData({
      'formData.steps': this.data.formData.steps.concat({ image: '', description: '' })
    })
  },

  removeStep(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ 'formData.steps': this.data.formData.steps.filter((_, i) => i !== index) })
  },

  handleStepInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`formData.steps[${index}].description`]: event.detail.value })
  },

  moveStep(event) {
    const index = Number(event.currentTarget.dataset.index)
    const direction = event.currentTarget.dataset.direction
    const target = direction === 'up' ? index - 1 : index + 1
    const steps = this.data.formData.steps.slice()
    if (target < 0 || target >= steps.length) return
    const temp = steps[index]
    steps[index] = steps[target]
    steps[target] = temp
    this.setData({ 'formData.steps': steps })
  },

  async submitForm() {
    const form = this.data.formData
    if (!String(form.name || '').trim()) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }
    if (form.category === '') {
      wx.showToast({ title: '请选择菜品分类', icon: 'none' })
      return
    }

    const payload = {
      dishesName: String(form.name).trim(),
      dishesImage: form.coverImage,
      dishesType: Number(form.category),
      difficultyFactor: Number(form.difficulty || 0),
      useTime: Number(form.estimatedTime || 0),
      prices: Number(form.price || 0),
      remark: form.remark || '',
      dishesMaterialList: form.ingredients
        .filter((item) => String(item.name || '').trim())
        .map((item) => ({
          materialName: String(item.name).trim(),
          materialDosage: item.amount || '',
          materialPrice: Number(item.price || 0),
          isPurchase: item.needToBuy ? 1 : 0
        })),
      dishesCreationMethodList: form.steps
        .filter((item) => item.image || String(item.description || '').trim())
        .map((item) => ({
          stepImage: item.image || '',
          stepContent: item.description || ''
        }))
    }

    if (form.id) {
      payload.id = form.id
      await eatApi.updateDishes(payload)
    } else {
      await eatApi.addDishes(payload)
    }
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 600)
  }
})
