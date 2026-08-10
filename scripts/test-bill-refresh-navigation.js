const assert = require('node:assert/strict')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function setData(update) {
  Object.entries(update).forEach(([path, value]) => {
    const keys = path.split('.')
    let target = this.data
    keys.slice(0, -1).forEach((key) => {
      target[key] = target[key] || {}
      target = target[key]
    })
    target[keys[keys.length - 1]] = value
  })
}

function createEventChannel() {
  const listeners = {}
  return {
    on(name, listener) {
      listeners[name] = listener
    },
    emit(name, payload) {
      if (listeners[name]) listeners[name](payload)
    }
  }
}

let capturedPage
let currentEventChannel
let navigateBackCount = 0

global.Page = (definition) => {
  capturedPage = definition
}

global.wx = {
  getStorageSync() {
    return null
  },
  navigateTo(options) {
    currentEventChannel = createEventChannel()
    if (options.success) options.success({ eventChannel: currentEventChannel })
  },
  navigateBack() {
    navigateBackCount += 1
  },
  showToast() {}
}

require('../pages/bill/index')
const billPage = capturedPage

require('../pagesBookkeeping/bookkeeping/bookkeeping-quick')
const quickPage = capturedPage
const bookkeepingApi = require('../api/bookkeeping')
bookkeepingApi.addRecord = async () => ({ data: { id: 101 } })

let fullRefreshCount = 0
let statisticsRefreshCount = 0
let inPlaceUpdateCount = 0
const billContext = {
  data: clone(billPage.data),
  setData,
  initPage() {
    fullRefreshCount += 1
  },
  getStatistics() {
    statisticsRefreshCount += 1
  },
  updateBillInPlace() {
    inPlaceUpdateCount += 1
  },
  removeBillInPlace() {}
}
billContext.data.initialized = true

billPage.handleFunctionClick.call(billContext, {
  currentTarget: { dataset: { type: 'quick' } }
})

const quickContext = {
  data: {
    ...clone(quickPage.data),
    amount: '12.34',
    selectedDate: '2026-08-10',
    remark: '午餐',
    formData: {
      ...clone(quickPage.data.formData),
      recordCategory: 1,
      recordType: 1
    }
  },
  setData,
  resetBookkeepingPanel() {},
  getOpenerEventChannel() {
    return currentEventChannel
  },
  notifyRecordCreated: quickPage.notifyRecordCreated
}

const originalSetTimeout = global.setTimeout
global.setTimeout = (callback) => {
  callback()
  return 0
}

async function run() {
  try {
    await quickPage.submitBookkeeping.call(quickContext)

    assert.equal(fullRefreshCount, 0, '新增事件应等账单页重新显示后再刷新')
    billPage.onShow.call(billContext)
    assert.equal(fullRefreshCount, 1, '快捷记账返回后应完整刷新账单列表')
    assert.equal(navigateBackCount, 1, '快捷记账成功后应返回一次')

    fullRefreshCount = 0
    statisticsRefreshCount = 0
    billPage.handleRecordClick.call(billContext, {
      currentTarget: { dataset: { id: 7 } }
    })
    currentEventChannel.emit('recordSaved', { id: 7, amount: 20 })
    billPage.onShow.call(billContext)

    assert.equal(inPlaceUpdateCount, 1, '详情编辑保存后应继续就地更新当前账单')
    assert.equal(fullRefreshCount, 0, '详情编辑返回后不应完整刷新账单列表')
    assert.equal(statisticsRefreshCount, 1, '详情编辑返回后只刷新统计数据')

    console.log('Bill navigation refresh check passed')
  } finally {
    global.setTimeout = originalSetTimeout
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
