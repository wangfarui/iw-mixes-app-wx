const { createGroup } = require('../../api/family')
const { uploadFile } = require('../../stores/file')
const familyStore = require('../../stores/family')

function chooseSingleImage(onChoose) {
  if (wx.chooseMedia) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (filePath) onChoose(filePath)
      }
    })
    return
  }

  wx.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success(res) {
      if (res.tempFilePaths && res.tempFilePaths[0]) {
        onChoose(res.tempFilePaths[0])
      }
    }
  })
}

function goDetailAfterSuccess() {
  const pages = getCurrentPages()
  const delta = pages.length - 1

  if (delta > 0) {
    wx.navigateBack({
      delta,
      success() {
        setTimeout(() => {
          wx.navigateTo({ url: '/pagesBase/family/detail' })
        }, 100)
      },
      fail() {
        wx.redirectTo({ url: '/pagesBase/family/detail' })
      }
    })
    return
  }

  wx.redirectTo({ url: '/pagesBase/family/detail' })
}

Page({
  data: {
    formData: {
      groupName: '',
      groupAvatar: '',
      groupDesc: '',
      maxMember: 10
    },
    isSubmitting: false
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: event.detail.value
    })
  },

  chooseAvatar() {
    chooseSingleImage(async (filePath) => {
      wx.showLoading({ title: '上传中...' })
      try {
        const fileRecord = await uploadFile(filePath)
        this.setData({
          'formData.groupAvatar': fileRecord.fileUrl
        })
      } catch (error) {
        wx.showToast({
          title: '上传失败',
          icon: 'error'
        })
      } finally {
        wx.hideLoading()
      }
    })
  },

  async handleSubmit() {
    const formData = this.data.formData
    if (!String(formData.groupName || '').trim()) {
      wx.showToast({
        title: '请输入家庭组名称',
        icon: 'none'
      })
      return
    }

    if (this.data.isSubmitting) return
    this.setData({ isSubmitting: true })

    try {
      await createGroup({
        ...formData,
        groupName: String(formData.groupName).trim(),
        maxMember: Number(formData.maxMember) || 10
      })
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      })
      await familyStore.fetchMyGroup()
      setTimeout(goDetailAfterSuccess, 1500)
    } catch (error) {
    } finally {
      this.setData({ isSubmitting: false })
    }
  }
})
