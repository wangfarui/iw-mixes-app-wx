const { getBaseUrl } = require('../config/env')
const sessionStore = require('./session')

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${getBaseUrl()}/auth-service/file/upload`,
      filePath,
      name: 'file',
      header: {
        'Content-Type': 'multipart/form-data',
        ...sessionStore.tokenHeader()
      },
      success(uploadFileRes) {
        let result = null
        try {
          result = JSON.parse(uploadFileRes.data)
        } catch (error) {
          wx.showToast({ icon: 'error', title: '上传失败' })
          reject(error)
          return
        }

        if (uploadFileRes.statusCode !== 200 || result.code !== 200) {
          wx.showToast({ icon: 'error', title: '上传失败' })
          reject(new Error(result.message || '上传失败'))
          return
        }

        resolve(result.data)
      },
      fail(error) {
        wx.showToast({ icon: 'error', title: '上传失败' })
        reject(error)
      }
    })
  })
}

module.exports = {
  uploadFile
}
