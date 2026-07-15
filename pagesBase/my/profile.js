const http = require('../../api/request')
const { uploadFile } = require('../../stores/file')

const DEFAULT_AVATAR = '/static/logo.png'
const GENDER_OPTIONS = [
  { value: 0, text: '保密' },
  { value: 1, text: '男' },
  { value: 2, text: '女' }
]

function resolveGenderOption(gender) {
  return GENDER_OPTIONS.find((item) => item.value === Number(gender)) || GENDER_OPTIONS[0]
}

Page({
  data: {
    userInfo: {},
    avatarUrl: DEFAULT_AVATAR,
    genderOptions: GENDER_OPTIONS,
    genderIndex: 0,
    genderName: '保密',
    editName: '',
    showEditNameDialog: false,
    showUploadActions: false,
    isUpdatingGender: false
  },

  onLoad() {
    this.fetchUserInfo()
  },

  async fetchUserInfo() {
    try {
      const res = await http.get('/auth-service/user/getUserInfo')
      this.setUserInfo(res.data || {})
    } catch (error) {
      wx.showToast({ title: '获取信息失败', icon: 'error' })
    }
  },

  setUserInfo(userInfo) {
    const genderOption = resolveGenderOption(userInfo.gender)
    const normalizedUserInfo = { ...userInfo, gender: genderOption.value }
    wx.setStorageSync('userInfo', normalizedUserInfo)
    this.setData({
      userInfo: normalizedUserInfo,
      avatarUrl: normalizedUserInfo.avatar || DEFAULT_AVATAR,
      genderIndex: GENDER_OPTIONS.indexOf(genderOption),
      genderName: genderOption.text
    })
  },

  async onGenderChange(event) {
    if (this.data.isUpdatingGender) return

    const genderOption = GENDER_OPTIONS[Number(event.detail.value)]
    if (!genderOption || genderOption.value === this.data.userInfo.gender) return

    this.setData({ isUpdatingGender: true })
    wx.showLoading({ title: '保存中...' })
    try {
      await http.put('/auth-service/user/editUserInfo', { gender: genderOption.value })
      this.setUserInfo({ ...this.data.userInfo, gender: genderOption.value })
      wx.showToast({ title: '修改成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '修改失败', icon: 'error' })
    } finally {
      wx.hideLoading()
      this.setData({ isUpdatingGender: false })
    }
  },

  openEditNameDialog() {
    this.setData({
      editName: this.data.userInfo.name || '',
      showEditNameDialog: true
    })
  },

  closeEditNameDialog() {
    this.setData({ showEditNameDialog: false, editName: '' })
  },

  onEditNameInput(event) {
    this.setData({ editName: event.detail.value })
  },

  async submitEditName() {
    const newName = this.data.editName.trim()
    if (!newName) {
      wx.showToast({ title: '姓名不能为空', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      await http.put('/auth-service/user/editUserInfo', { name: newName })
      this.setUserInfo({ ...this.data.userInfo, name: newName })
      this.closeEditNameDialog()
      wx.showToast({ title: '修改成功', icon: 'success' })
    } finally {
      wx.hideLoading()
    }
  },

  openUploadActions() {
    this.setData({ showUploadActions: true })
  },

  closeUploadActions() {
    this.setData({ showUploadActions: false })
  },

  noop() {},

  takePhoto() {
    this.chooseImage(['camera'])
  },

  chooseFromAlbum() {
    this.chooseImage(['album'])
  },

  chooseImage(sourceType) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,
      sizeType: ['compressed'],
      success: async (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (filePath) {
          await this.uploadFileForAvatar(filePath)
          this.closeUploadActions()
        }
      }
    })
  },

  async uploadFileForAvatar(filePath) {
    wx.showLoading({ title: '上传中...' })
    try {
      const fileRes = await uploadFile(filePath)
      const avatarUrl = fileRes.fileUrl
      await http.put('/auth-service/user/editUserInfo', { avatar: avatarUrl })
      this.setUserInfo({ ...this.data.userInfo, avatar: avatarUrl })
      wx.showToast({ title: '更新成功', icon: 'success' })
    } finally {
      wx.hideLoading()
    }
  }
})
