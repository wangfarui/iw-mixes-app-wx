const assert = require('node:assert/strict')

let walletPage
global.Page = (definition) => {
  walletPage = definition
}

const toastMessages = []
global.wx = {
  getStorageSync() {
    return null
  },
  showToast(options) {
    toastMessages.push(options.title)
  }
}

require('../pagesBookkeeping/bookkeeping/bookkeeping-wallet')
const bookkeepingApi = require('../api/bookkeeping')

let submittedPayload = null
bookkeepingApi.updateWalletAmount = async (payload) => {
  submittedPayload = payload
}

function setData(update) {
  Object.assign(this.data, update)
}

const context = {
  data: {
    ...walletPage.data,
    wallet: {
      walletBalance: 0,
      walletAssets: 100
    },
    updateMode: 'delta',
    updateType: 1,
    updateAmount: ''
  },
  setData,
  closeUpdatePopup() {},
  refreshAll() {}
}

async function run() {
  walletPage.onUpdateAmountInput.call(context, { detail: { value: '-25.50' } })
  assert.equal(context.data.updateAmount, '-25.50', '余额变动输入框应保留负号')
  await walletPage.submitUpdateAmount.call(context)

  assert.deepEqual(submittedPayload, {
    changeType: 1,
    updateAmount: -25.5
  }, '余额的负数变动应允许使调整后余额小于 0')
  assert.equal(toastMessages.includes('调整后金额不能小于0'), false)

  submittedPayload = null
  toastMessages.length = 0
  context.data.updateMode = 'direct'
  walletPage.onUpdateAmountInput.call(context, { detail: { value: '-25.50' } })

  await walletPage.submitUpdateAmount.call(context)

  assert.equal(submittedPayload, null, '直接修改金额仍不允许输入负数')
  assert.equal(toastMessages.includes('请输入正确金额'), true)

  console.log('Wallet negative delta check passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
