const http = require('./request')
const { getBaseUrl } = require('../config/env')
const sessionStore = require('../stores/session')
const { redirectToLogin } = require('../utils/auth')

function getRecordDetail(id) {
  return http.get('/bookkeeping-service/bookkeeping/records/detail', { id })
}

function addRecord(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/add', data)
}

function parseExpenseAudio(filePath, options = {}) {
  const formData = {}
  if (options.durationMs !== undefined && options.durationMs !== null) {
    formData.durationMs = options.durationMs
  }
  if (options.format) {
    formData.format = options.format
  }
  if (options.sampleRate) {
    formData.sampleRate = options.sampleRate
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${getBaseUrl()}${http.appendQuery('/bookkeeping-service/bookkeeping/assistant/expense/parseAudio', {
        autoSave: options.autoSave === undefined ? true : options.autoSave
      })}`,
      filePath,
      name: 'file',
      formData,
      header: {
        'Content-Type': 'multipart/form-data',
        ...sessionStore.tokenHeader()
      },
      success(uploadFileRes) {
        let result = null
        try {
          result = JSON.parse(uploadFileRes.data || '{}')
        } catch (error) {
          wx.showToast({ title: '语音解析失败', icon: 'none' })
          reject(error)
          return
        }

        if (result && result.code === 401) {
          wx.showToast({ title: '登录状态失效', icon: 'error' })
          sessionStore.clearLoginSession()
          redirectToLogin()
          reject(new Error('未授权，请登录'))
          return
        }

        if (uploadFileRes.statusCode !== 200 || !result || result.code !== 200) {
          const message = (result && (result.message || result.msg)) || '语音解析失败'
          wx.showToast({ title: message, icon: 'none' })
          reject(new Error(message))
          return
        }

        resolve(result)
      },
      fail(error) {
        wx.showToast({ title: '语音上传失败', icon: 'none' })
        reject(error)
      }
    })
  })
}

function confirmAssistantExpense(data) {
  return http.post('/bookkeeping-service/bookkeeping/assistant/expense/confirm', data)
}

function updateRecord(data) {
  return http.put('/bookkeeping-service/bookkeeping/records/update', data)
}

function deleteRecord(id) {
  return http.delete('/bookkeeping-service/bookkeeping/records/delete', { id })
}

function getRecordPage(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/page', data)
}

function getRecordStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/statistics', data)
}

function getRecordList(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/list', data)
}

function getActionList(recordCategory) {
  return http.get('/bookkeeping-service/bookkeeping/actions/list', { recordCategory })
}

function getActionDetail(id) {
  return http.get('/bookkeeping-service/bookkeeping/actions/detail', { id })
}

function addAction(data) {
  return http.post('/bookkeeping-service/bookkeeping/actions/add', data)
}

function updateAction(data) {
  return http.put('/bookkeeping-service/bookkeeping/actions/update', data)
}

function deleteAction(id) {
  return http.delete('/bookkeeping-service/bookkeeping/actions/delete', { id })
}

function getConsumeTotalStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/consume/totalStatistics', data)
}

function getConsumeRankStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/consume/rankStatistics', data)
}

function getConsumePieChartStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/consume/pieChartStatistics', data)
}

function getConsumeBarChartStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/consume/barChartStatistics', data)
}

function getConsumeTagsStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/consume/tagsStatistics', data)
}

function getIncomeTotalStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/income/totalStatistics', data)
}

function getIncomeRankStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/income/rankStatistics', data)
}

function getIncomeChartStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/income/chartStatistics', data)
}

function getYearOverviewStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/yearStatistics/overview', data)
}

function getYearConsumeStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/yearStatistics/consume', data)
}

function getYearIncomeStatistics(data) {
  return http.post('/bookkeeping-service/bookkeeping/records/yearStatistics/income', data)
}

function getTotalBudget(budgetType) {
  return http.get('/bookkeeping-service/bookkeeping/budget/totalBudget', { budgetType })
}

function getCategoryBudget(budgetType) {
  return http.get('/bookkeeping-service/bookkeeping/budget/categoryBudget', { budgetType })
}

function getBudgetDetail(id) {
  return http.get('/bookkeeping-service/bookkeeping/budget/detail', { id })
}

function addBudget(data) {
  return http.post('/bookkeeping-service/bookkeeping/budget/add', data)
}

function updateBudget(data) {
  return http.put('/bookkeeping-service/bookkeeping/budget/update', data)
}

function deleteBudget(id) {
  return http.delete('/bookkeeping-service/bookkeeping/budget/delete', { id })
}

function getWalletDetail() {
  return http.get('/bookkeeping-service/bookkeeping/wallet/detail')
}

function updateWalletAmount(data) {
  return http.put('/bookkeeping-service/bookkeeping/wallet/updateAmount', data)
}

function getWalletRecordPage(data) {
  return http.post('/bookkeeping-service/bookkeeping/wallet/records/page', data)
}

function getMembershipList(data) {
  return http.post('/bookkeeping-service/bookkeeping/membership/list', data)
}

function getMembershipDetail(id) {
  return http.get('/bookkeeping-service/bookkeeping/membership/detail', { id })
}

function addMembership(data) {
  return http.post('/bookkeeping-service/bookkeeping/membership/add', data)
}

function updateMembership(data) {
  return http.put('/bookkeeping-service/bookkeeping/membership/update', data)
}

function deleteMembership(id) {
  return http.delete('/bookkeeping-service/bookkeeping/membership/delete', { id })
}

module.exports = {
  getRecordDetail,
  addRecord,
  parseExpenseAudio,
  confirmAssistantExpense,
  updateRecord,
  deleteRecord,
  getRecordPage,
  getRecordStatistics,
  getRecordList,
  getActionList,
  getActionDetail,
  addAction,
  updateAction,
  deleteAction,
  getConsumeTotalStatistics,
  getConsumeRankStatistics,
  getConsumePieChartStatistics,
  getConsumeBarChartStatistics,
  getConsumeTagsStatistics,
  getIncomeTotalStatistics,
  getIncomeRankStatistics,
  getIncomeChartStatistics,
  getYearOverviewStatistics,
  getYearConsumeStatistics,
  getYearIncomeStatistics,
  getTotalBudget,
  getCategoryBudget,
  getBudgetDetail,
  addBudget,
  updateBudget,
  deleteBudget,
  getWalletDetail,
  updateWalletAmount,
  getWalletRecordPage,
  getMembershipList,
  getMembershipDetail,
  addMembership,
  updateMembership,
  deleteMembership
}
