const eatApi = require('../../../api/eat')
const helper = require('../eat-helper')

Page({
  data: {
    id: '',
    detail: {
      mealMenuList: []
    },
    material: {
      needPurchaseMaterialList: [],
      commonMaterialList: []
    }
  },

  onLoad(options = {}) {
    if (options.id) {
      this.setData({ id: options.id })
      this.fetchDetail(options.id)
    }
  },

  async fetchDetail(id) {
    const [detailRes, materialRes] = await Promise.all([
      eatApi.getMealDetail(id),
      eatApi.getMealMaterialDetail(id)
    ])
    const material = materialRes.data || {}
    this.setData({
      detail: {
        ...helper.formatMeal(detailRes.data || {}),
        mealMenuList: (detailRes.data && detailRes.data.mealMenuList) || []
      },
      material: {
        needPurchaseMaterialList: (material.needPurchaseMaterialList || []).map((item) => ({
          ...item,
          materialDosagesText: (item.materialDosages || []).join('、')
        })),
        commonMaterialList: Array.isArray(material.commonMaterialList)
          ? material.commonMaterialList
          : Array.from(material.commonMaterialList || [])
      }
    })
  },

  goDishDetail(event) {
    wx.navigateTo({ url: `/pagesEat/eat/dishes/dishes-detail?id=${event.currentTarget.dataset.id}` })
  },

  confirmDelete() {
    wx.showModal({
      content: '确定删除该用餐记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        await eatApi.deleteMeal(this.data.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  }
})
