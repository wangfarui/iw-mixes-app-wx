const assert = require('node:assert/strict')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture() {
  Object.keys(require.cache).filter(key => key.startsWith(root + path.sep)).forEach(key => delete require.cache[key])
  const storage = new Map([['iwtoken', 'session-a'], ['userInfo', { id: 1 }]])
  global.wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    showToast() {}
  }
  let definition
  global.Page = value => { definition = value }
  const api = require('../api/bookkeeping')
  const familyApi = require('../api/family')
  const dictionaryApi = require('../api/bookkeeping-dictionaries')
  const options = require('../stores/bookkeeping-options')
  const family = require('../stores/family')
  let familyCalls = 0, dictionaryCalls = 0
  familyApi.getMyGroup = async () => { familyCalls += 1; return { data: null } }
  dictionaryApi.options = async type => { dictionaryCalls += 1; return { data: [{ id: 10, name: type }] } }
  require('../pagesBookkeeping/bookkeeping/bookkeeping-quick')
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) }
  }
  return { page, api, familyApi, dictionaryApi, options, family, storage,
    counts: () => ({ familyCalls, dictionaryCalls }) }
}

async function run() {
  let f = fixture()
  const firstList = deferred()
  let listCalls = 0
  f.api.getActionList = () => { listCalls += 1; return firstList.promise }
  const showing = f.page.onShow()
  assert.equal(listCalls, 1, '首屏立即请求快捷项，不等待家庭或字典接口')
  assert.deepEqual(f.counts(), { familyCalls: 0, dictionaryCalls: 0 }, '列表展示不需要加载编辑候选项')
  assert.equal(f.page.data.actionsLoading, true)
  firstList.resolve({ data: [{ id: 1, recordSource: '餐饮' }] })
  await showing
  assert.equal(f.page.data.actions.length, 1)
  assert.equal(f.page.data.actionsLoading, false)

  const returningList = deferred()
  f.api.getActionList = () => returningList.promise
  const returning = f.page.onShow()
  assert.equal(f.page.data.actions.length, 1, '同一身份返回页面时保留旧列表，后台刷新')
  returningList.reject(new Error('离线'))
  await returning
  assert.equal(f.page.data.actions.length, 1, '刷新失败保留同一身份已显示的快捷项')

  const oldSessionList = deferred()
  f.api.getActionList = () => oldSessionList.promise
  const oldShow = f.page.onShow()
  f.storage.set('iwtoken', 'session-b')
  f.api.getActionList = async () => ({ data: [{ id: 2, recordSource: '新账号' }] })
  await f.page.onShow()
  oldSessionList.resolve({ data: [{ id: 3, recordSource: '旧账号' }] })
  await oldShow
  assert.equal(f.page.data.actions[0].id, 2, '切账号后旧响应不能覆盖新账号')

  const lateList = deferred()
  f.api.getActionList = () => lateList.promise
  const unloading = f.page.fetchActions()
  f.page.onUnload()
  lateList.resolve({ data: [{ id: 4 }] })
  await unloading
  assert.equal(f.page.data.actions[0].id, 2, '卸载后不更新页面')

  f = fixture()
  await Promise.all([f.options.ensureLoaded(), f.options.ensureLoaded()])
  assert.deepEqual(f.counts(), { familyCalls: 1, dictionaryCalls: 3 }, '并发候选加载合并为同一请求')
  await f.options.ensureLoaded()
  assert.deepEqual(f.counts(), { familyCalls: 1, dictionaryCalls: 3 }, '短时复用完整候选缓存')
  f.options.invalidate()
  await f.options.ensureLoaded()
  assert.deepEqual(f.counts(), { familyCalls: 2, dictionaryCalls: 6 }, '字典写入失效后重新请求')
  const now = Date.now
  try {
    Date.now = () => now() + 31_000
    await f.options.ensureLoaded()
    assert.deepEqual(f.counts(), { familyCalls: 3, dictionaryCalls: 9 }, '超过30秒重新校验家庭与字典')
  } finally { Date.now = now }

  f = fixture()
  const delayed = deferred()
  f.dictionaryApi.options = () => delayed.promise
  const loading = f.options.ensureLoaded()
  await new Promise(resolve => setImmediate(resolve))
  f.storage.set('iwtoken', 'session-b')
  delayed.resolve({ data: [{ id: 99, name: '旧会话候选' }] })
  assert.equal(await loading, false)
  assert.deepEqual(f.options.get('CATEGORY'), [], '切账号后不接收旧候选响应')

  f = fixture()
  const invalidated = deferred()
  f.dictionaryApi.options = () => invalidated.promise
  const stale = f.options.ensureLoaded()
  await new Promise(resolve => setImmediate(resolve))
  f.options.invalidate()
  invalidated.resolve({ data: [{ id: 99, name: '写入前候选' }] })
  assert.equal(await stale, false)
  assert.deepEqual(f.options.get('CATEGORY'), [], '写入失效期间的旧请求不能重新填充缓存')

  f = fixture()
  f.family.updateGroup({ id: 8 })
  f.familyApi.getMyGroup = async () => ({ data: { id: 8 } })
  await f.options.ensureLoaded()
  f.family.updateGroup({ id: 9 })
  assert.deepEqual(f.options.get('CATEGORY'), [], '切家庭立即失效')
  f.familyApi.getMyGroup = async () => ({ data: { id: 9 } })
  await f.options.ensureLoaded()
  assert.equal(f.options.get('CATEGORY').length, 1)

  f = fixture()
  const group = deferred(), detail = deferred()
  f.familyApi.getMyGroup = () => group.promise
  let detailCalls = 0
  f.api.getActionDetail = () => { detailCalls += 1; return detail.promise }
  f.page.data.actions = [{ id: 1 }]
  f.page.initPayerSelector = async () => {}
  const opening = f.page.openBookkeepingPanel({ currentTarget: { dataset: { index: 0 } } })
  assert.equal(detailCalls, 1, '详情请求与候选加载并行启动')
  assert.equal(f.page.data.showPanel, false, '校验完成前不打开金额面板')
  group.resolve({ data: null })
  detail.resolve({ data: { id: 1, recordCategory: 1, recordSource: '餐饮', available: true } })
  await opening
  assert.equal(f.page.data.showPanel, true)
  f.page.closeBookkeepingPanel()
  await f.page.openBookkeepingPanel({ currentTarget: { dataset: { index: 0 } } })
  assert.equal(f.counts().dictionaryCalls, 3, '重复打开面板不重拉三类字典')

  f.page.closeBookkeepingPanel()
  const hiddenDetail = deferred()
  f.api.getActionDetail = () => hiddenDetail.promise
  const hiddenOpening = f.page.openBookkeepingPanel({ currentTarget: { dataset: { index: 0 } } })
  f.page.onHide()
  hiddenDetail.resolve({ data: { id: 1, recordCategory: 1, available: true } })
  await hiddenOpening
  assert.equal(f.page.data.showPanel, false, '页面隐藏后迟到的详情不重新打开面板')

  f.api.getActionDetail = async () => ({ data: { id: 1, available: false } })
  await f.page.openBookkeepingPanel({ currentTarget: { dataset: { index: 0 } } })
  assert.equal(f.page.data.showPanel, false, '失效快捷项仍须重新配置')

  f = fixture()
  f.family.updateGroup({ id: 8 })
  f.familyApi.getMyGroup = async () => ({ data: { id: 8 } })
  await f.options.ensureLoaded()
  const oldFamilyDetail = deferred()
  let familyDetailCalls = 0
  f.api.getActionDetail = () => {
    familyDetailCalls += 1
    return familyDetailCalls === 1 ? oldFamilyDetail.promise : Promise.resolve({ data: { id: 1, recordSource: '新家庭', available: true } })
  }
  f.page.data.actions = [{ id: 1 }]
  f.page.initPayerSelector = async () => {}
  const changingFamily = f.page.openBookkeepingPanel({ currentTarget: { dataset: { index: 0 } } })
  f.family.updateGroup({ id: 9 })
  f.familyApi.getMyGroup = async () => ({ data: { id: 9 } })
  oldFamilyDetail.resolve({ data: { id: 1, recordSource: '旧家庭', available: true } })
  await changingFamily
  assert.equal(familyDetailCalls, 2, '加载期间切家庭时必须重新校验详情')
  assert.equal(f.page.data.formData.recordSource, '新家庭')

  console.log('test-bookkeeping-quick-loading: all assertions passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
