const assert = require('node:assert/strict')
const storage = new Map([['userInfo', { id: 1 }]])
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  showToast() {}
}
let definition
global.Page = page => { definition = page }
const familyApi = require('../api/family')
const family = require('../stores/family')
const scope = require('../stores/family-shared-scope')
const payer = require('../utils/bookkeeping-payer')
familyApi.getMemberList = async () => ({ data: [{ userId: 1, name: 'A' }, { userId: 2, name: 'B' }] })
function context(page) {
  return {
    ...page,
    data: JSON.parse(JSON.stringify(page.data)),
    setData(values) {
      Object.entries(values).forEach(([path, value]) => {
        const parts = path.split('.')
        let target = this.data
        parts.slice(0, -1).forEach(part => { target = target[part] })
        target[parts.at(-1)] = value
      })
    }
  }
}
async function run() {
  // A statistics request must await the SAME startup family request, not return cached null.
  let resolveGroup
  let settled = false
  familyApi.getMyGroup = () => new Promise(resolve => { resolveGroup = resolve })
  family.fetchMyGroup()
  const wait = family.ensureMyGroupLoaded().then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false)
  resolveGroup({ data: { id: 10, currentUserRole: 3, queryOnlyMyself: 0, defaultShared: 0 } })
  await wait
  assert.equal(scope.getQueryOnlyMyself(), null)

  require('../pagesBookkeeping/bookkeeping/bookkeeping-action')
  const formDefinition = definition
  const page = context(formDefinition)
  await page.initPayerSelector()
  assert.equal(page.data.showPayer, true)
  assert.equal(page.data.formData.expenseUserId, 1)
  page.onPayerChange({ detail: { value: 1 } })
  assert.equal(page.data.formData.expenseUserId, 2)
  assert.equal(page.data.isShared, true)
  assert.equal(page.data.payerSharedLocked, true)
  page.switchShared({ detail: { value: false } })
  assert.equal(page.data.formData.shared, 1)
  page.onPayerChange({ detail: { value: 0 } })
  assert.equal(page.data.formData.shared, 0)
  assert.equal(page.data.payerSharedLocked, false)

  assert.equal(payer.payerText({ recordCategory: 1, userId: 1, expenseUserId: 2, expenseUserName: 'B' }, scope.getScopeState()), ' · 支出人：B')
  storage.set('userInfo', { id: 2 })
  assert.equal(payer.payerText({ recordCategory: 1, userId: 1, expenseUserId: 2, expenseUserName: 'B' }, scope.getScopeState()), '')
  storage.set('userInfo', { id: 1 })
  assert.equal(payer.payerText({ recordCategory: 2, userId: 2 }, scope.getScopeState()), '')

  page.setData({ 'formData.canChangeExpenseUser': false, 'formData.expenseUserId': 2, 'formData.shared': 0 })
  page.syncPayerState()
  assert.equal(page.data.payerDisabled, true)
  assert.equal(page.data.payerHistorical, true)
  assert.equal(page.data.formData.shared, 0)
  page.onPayerChange({ detail: { value: 0 } })
  assert.equal(page.data.formData.expenseUserId, 2)

  family.updateGroup({ id: 10, currentUserRole: 4 })
  const child = context(formDefinition)
  await child.initPayerSelector()
  assert.equal(child.data.payerDisabled, true)
  assert.equal(child.data.payerOptions.length, 1)

  // A slower family request cannot overwrite the newer personal statistics.
  family.updateGroup({ id: 10, currentUserRole: 3, queryOnlyMyself: 0 })
  require('../pagesBookkeeping/bookkeeping/bookkeeping-consume-statistics')
  const statistics = context(definition)
  const api = require('../api/bookkeeping')
  const pending = []
  api.getConsumeTotalStatistics = () => new Promise(resolve => pending.push(resolve))
  for (const method of ['getConsumePieChartStatistics', 'getConsumeRankStatistics', 'getConsumeTagsStatistics', 'getConsumeBarChartStatistics']) api[method] = async () => ({ data: [] })
  const familyRequest = statistics.fetchStatistics()
  while (pending.length < 1) await Promise.resolve()
  scope.setScope('myself')
  const personalRequest = statistics.fetchStatistics()
  while (pending.length < 2) await Promise.resolve()
  pending[1]({ data: { totalAmount: '300.00' } })
  await personalRequest
  pending[0]({ data: { totalAmount: '650.00' } })
  await familyRequest
  assert.equal(statistics.data.totalAmount, '300.00')

  family.clearGroup()
  familyApi.getMyGroup = async () => ({ data: null })
  const alone = context(formDefinition)
  await alone.initPayerSelector()
  assert.equal(alone.data.showPayer, false)
  assert.equal(alone.data.formData.expenseUserId, 1)
  assert.equal(payer.payerText({ recordCategory: 1, expenseUserId: 2 }, scope.getScopeState()), '')
  console.log('Bookkeeping payer tests passed: family loading, sharing, viewer labels, child and historical restrictions')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
