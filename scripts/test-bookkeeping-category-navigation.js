const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const clone = (value) => JSON.parse(JSON.stringify(value))
const api = {}
let route = ''
let queryScope = null
const wx = { navigateTo: ({ url }) => { route = url } }

function load(file, dependencies) {
  let definition
  const sandbox = {
    require(name) {
      assert.ok(name in dependencies, `Missing dependency: ${name}`)
      return dependencies[name]
    },
    Page(value) { definition = value },
    module: { exports: {} },
    wx
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file })
  return definition || sandbox.module.exports
}

const utils = load('utils/bookkeeping.js', {
  '../stores/bookkeeping-options': {},
  '../stores/dict': {}
})
const dependencies = {
  '../../api/bookkeeping': api,
  '../../stores/family-shared-scope': {
    getQueryOnlyMyself: () => queryScope,
    getScopeState: () => ({})
  },
  '../../stores/family': { ensureMyGroupLoaded: async () => {} },
  '../../utils/bookkeeping': utils,
  '../../utils/bookkeeping-payer': {},
  '../../stores/bookkeeping-options': { identity: () => 'fixture' }
}
const statisticsDefinition = load('pagesBookkeeping/bookkeeping/bookkeeping-consume-statistics.js', dependencies)
const budgetDefinition = load('pagesBookkeeping/bookkeeping/bookkeeping-budget.js', dependencies)
const recordsDefinition = load('pagesBookkeeping/bookkeeping/bookkeeping-records.js', dependencies)

function page(definition) {
  return {
    ...definition,
    data: clone(definition.data),
    setData(update, callback) {
      for (const [key, value] of Object.entries(update)) {
        const parts = key.split('.')
        let target = this.data
        for (const part of parts.slice(0, -1)) target = target[part]
        target[parts.at(-1)] = value
      }
      if (callback) callback()
    }
  }
}

// Native onLoad receives the raw encoded query values, as confirmed in DevTools.
function routeOptions() {
  return Object.fromEntries(route.split('?')[1].split('&').map((pair) => {
    const separator = pair.indexOf('=')
    return [pair.slice(0, separator), pair.slice(separator + 1)]
  }))
}

function hasSelectedChip(records, name) {
  return records.data.recordTypeButtons.some((item) => item.name === name && item.dictName === name)
}

async function scenario({ name, state = '', tab = 'month', ignore = true, scope = null, entry = 'statistics', missing = false, failOptions = false }) {
  queryScope = scope
  if (entry === 'budget') {
    const budget = page(budgetDefinition)
    budget.setData({ categoryBudgets: [{ recordTypeName: name }] })
    budget.goToRecords({ currentTarget: { dataset: { index: 0 } } })
  } else {
    const statistics = page(statisticsDefinition)
    statistics.setData({ currentTab: tab, selectedMonth: '2026-10', selectedYear: '2026', ignoreNotStatistics: ignore })
    const [item] = statistics.buildCategoryList([{
      recordTypeName: name,
      dictionarySnapshotStatus: state === 'PENDING' ? 0 : 1,
      amount: 10
    }])
    statistics.goToRecords({ currentTarget: { dataset: { categoryName: item.recordTypeName, categoryState: item.categoryState } } })
  }

  const records = page(recordsDefinition)
  records.onLoad(routeOptions())
  api.getRecordFilterOptions = async () => {
    if (failOptions) throw new Error('filter-options unavailable')
    return { data: { categories: missing || name == null ? [] : [{ name }], expenseTags: [] } }
  }
  const requests = []
  api.getRecordStatistics = async (dto) => { requests.push(['statistics', clone(dto)]); return { data: {} } }
  api.getRecordPage = async (dto) => { requests.push(['page', clone(dto)]); return { data: { records: [] } } }
  await records.initPage()

  assert.equal(requests.length, 2)
  assert.deepEqual(requests[0][1], requests[1][1], 'summary and list use the same filters')
  const dto = requests[1][1]
  if (state || name == null) {
    assert.equal(dto.categoryState, state || 'UNCATEGORIZED')
    assert.deepEqual(dto.categoryNames, [])
  } else {
    assert.equal(records.data.selectedCategoryName, name)
    assert.deepEqual(dto.categoryNames, [name])
    assert.equal(dto.categoryState, null)
    assert.ok(hasSelectedChip(records, name), 'selected category remains visible')
    assert.equal(records.data.recordTypeButtons.filter((item) => item.name === name).length, 1)
  }
  assert.ok(records.data.recordTypeButtons.some((item) => item.name === '' && item.dictName === '全部'))
  assert.equal(dto.queryOnlyMyself, scope)
  if (entry === 'statistics') {
    assert.equal(dto.recordCategory, 1)
    assert.equal(dto.recordStartDate, tab === 'month' ? '2026-10-01' : '2026-01-01')
    assert.equal(dto.recordEndDate, tab === 'month' ? '2026-10-31' : '2026-12-31')
    assert.equal(dto.isSearchAll, ignore ? 0 : 1)
  } else {
    assert.equal(dto.recordCategory, '')
    const range = utils.monthRange()
    assert.equal(dto.recordStartDate, range.firstDay)
    assert.equal(dto.recordEndDate, range.lastDay)
  }
  return records
}

async function run() {
  const scenarios = [
    { name: '餐饮' },
    { name: 'Food' },
    { name: '交通 & 出行+50%' },
    { name: '字面量%26' },
    { name: '旧餐饮', missing: true },
    { name: '餐饮', failOptions: true },
    { name: '餐饮', tab: 'year', ignore: false, scope: 1 },
    { name: '餐饮', scope: 0 },
    { name: null },
    { name: null, state: 'PENDING' },
    { name: '餐饮', entry: 'budget' },
    { name: '餐饮 & 50%+出行', entry: 'budget', missing: true }
  ]
  let failures = 0
  for (const item of scenarios) {
    try {
      await scenario(item)
      console.log('PASS', JSON.stringify(item))
    } catch (error) {
      failures++
      console.error('FAIL', JSON.stringify(item), error.message)
    }
  }

  const records = page(recordsDefinition)
  records.onLoad({ categoryName: 'raw%invalid' })
  assert.equal(records.data.selectedCategoryName, 'raw%invalid', 'malformed input must not crash or disappear')
  const selected = await scenario({ name: 'Food', missing: true })
  const initPage = selected.initPage.bind(selected)
  let pending
  selected.initPage = () => { pending = initPage(); return pending }
  selected.selectButton({ currentTarget: { dataset: { name: '' } } })
  await pending
  assert.deepEqual(clone(selected.data.dto.categoryNames), [], 'all clears the selected category')
  assert.equal(selected.data.recordTypeButtons.length, 1, 'temporary category disappears after clearing')
  selected.setData({ selectedCategoryState: 'PENDING' })
  selected.resetFilter()
  await pending
  assert.equal(selected.data.selectedCategoryState, null)
  assert.deepEqual(clone(selected.data.dto.categoryNames), [])
  console.log('PASS malformed route, clear selection and reset')
  assert.equal(failures, 0, `${failures} navigation scenarios failed`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
