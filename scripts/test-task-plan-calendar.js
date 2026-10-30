const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = fs.readFileSync(path.join(__dirname, '../pagesPoints/points/task-plan-add.js'), 'utf8')
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { resolve, reject, promise } }
function fixture(overrides = {}) {
  let page
  const calls = []
  const api = {
    async previewTaskPlan(payload) { calls.push(['preview', payload]); return { data: { anchorDate: payload.planDate, ruleText: '每年农历正月初一', occurrences: [] } } },
    async convertTaskPlanDate(payload) { calls.push(['convert', payload]); return { data: { solarDate: '2023-03-22', lunarYear: 2023, lunarMonth: 2, lunarDay: 1, leapMonth: true } } },
    async getTaskPlanCalendar() { return { data: [{ month: 2, leap: false, label: '二月', days: 30 }, { month: 2, leap: true, label: '闰二月', days: 29 }] } },
    async getTaskPlanDetail() { return { data: { id: 1, taskName: '旧计划', planCycle: 4, planDate: '2027-02-17', anchorDate: '2026-02-17' } } },
    async addTaskPlan(payload) { calls.push(['add', payload]) },
    async updateTaskPlan(payload) { calls.push(['update', payload]) },
    ...overrides
  }
  vm.runInNewContext(source, {
    require(name) {
      if (name.endsWith('/points')) return api
      if (name.endsWith('/bookkeeping')) return { today: () => '2026-10-29' }
      if (name.endsWith('/task-bookkeeping')) return { templateSummary: () => '', parseTemplate: () => null, templateFields: x => x }
      throw Error(name)
    },
    wx: { showToast: p => calls.push(['toast', p.title]), navigateBack() {}, navigateTo() {} },
    Page(value) { page = value },
    setTimeout: (fn, ms) => ms === 600 ? 0 : setTimeout(fn, ms), clearTimeout, console
  })
  page.data = JSON.parse(JSON.stringify(page.data))
  page.setData = function (patch) {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.split('.'); let parent = this.data
      for (const part of parts.slice(0, -1)) parent = parent[part]
      parent[parts.at(-1)] = value
    }
  }
  return { page, calls }
}
const change = value => ({ detail: { value } })
const tap = value => ({ currentTarget: { dataset: { value } } })

async function main() {
  {
    const { page, calls } = fixture()
    assert.equal(page.data.formData.calendarType, 'SOLAR')
    await page.changeCalendar(tap('LUNAR'))
    assert.equal(page.data.formData.planDate, '2023-03-22', 'Switch preserves the actual day')
    assert.equal(page.data.formData.lunarMonth, 2)
    assert.equal(page.data.formData.leapMonth, true)
    assert.equal(page.data.lunarMonthText, '闰二月')
    page.onPlanCycleChange(change(2))
    page.data.formData.taskName = '农历每月任务'
    await page.handleSubmit()
    const payload = calls.find(([kind]) => kind === 'add')[1]
    assert.equal(payload.calendarType, 'LUNAR'); assert.equal(payload.planCycle, 3)
    assert.equal(payload.lunarMonth, 2); assert.equal(payload.leapMonth, true)
    assert.ok(!Object.hasOwn(payload, 'includeLeapMonth'), 'Monthly leap months need no switch or option')
    await page.changeCalendar(tap('SOLAR'))
    assert.equal(page.data.formData.planDate, '2023-03-22')
    page.onUnload()
  }
  {
    const { page } = fixture()
    page.data.isEdit = true; page.data.taskId = '1'
    await page.loadTaskDetail()
    assert.equal(page.data.formData.calendarType, 'SOLAR', 'Historical missing calendar is solar')
    assert.equal(page.data.formData.planDate, '2026-02-17', 'Editing uses the immutable anchor')
    assert.equal(page.schedulePayload().id, 1)
    page.onUnload()
  }
  {
    const { page, calls } = fixture({ getTaskPlanDetail: async () => { throw Error('offline') } })
    page.data.isEdit = true; await page.loadTaskDetail()
    assert.ok(page.data.loadError)
    await page.handleSubmit()
    assert.equal(calls.filter(([kind]) => kind === 'update').length, 0, 'A failed load cannot overwrite a plan')
  }
  {
    const { page } = fixture()
    await page.changeCalendar(tap('LUNAR'))
    page.data.formData.lunarDay = 30
    page.chooseLunarMonth(change(1))
    assert.equal(page.data.formData.lunarDay, null, 'Invalid original dates require reselection')
    assert.match(page.scheduleError(), /农历/)
    page.chooseLunarDay(change(28))
    assert.equal(page.data.formData.lunarDay, 29)
    page.onUnload()
  }
  {
    const first = deferred(), second = deferred(); let request = 0
    const { page } = fixture({ previewTaskPlan: () => (++request === 1 ? first.promise : second.promise) })
    const older = page.refreshPreview()
    page.data.formData.planDate = '2026-11-01'
    const newer = page.refreshPreview()
    second.resolve({ data: { anchorDate: '2026-11-01', ruleText: 'new', occurrences: [] } }); await newer
    first.resolve({ data: { anchorDate: '2026-10-29', ruleText: 'old', occurrences: [] } }); await older
    assert.equal(page.data.preview.ruleText, 'new')
    assert.equal(page.data.formData.planDate, '2026-11-01')
    page.onUnload()
  }
  {
    const first = deferred(), second = deferred(); let request = 0
    const { page } = fixture({ getTaskPlanCalendar: () => (++request === 1 ? first.promise : second.promise) })
    Object.assign(page.data.formData, { calendarType: 'LUNAR', lunarYear: 2023, lunarMonth: 2, lunarDay: 1, leapMonth: true })
    const older = page.loadCalendar()
    page.data.formData.lunarYear = 2026
    const newer = page.loadCalendar()
    second.resolve({ data: [{ month: 2, leap: false, label: '二月', days: 29 }] }); await newer
    first.resolve({ data: [{ month: 2, leap: true, label: '闰二月', days: 29 }] }); await older
    assert.equal(page.data.formData.lunarMonth, null, 'Year without the selected leap month requires explicit reselection')
    assert.equal(page.data.lunarMonths[0].leap, false)
    page.onUnload()
  }
  {
    const { page } = fixture({ convertTaskPlanDate: async () => { throw Error('offline') } })
    await page.changeCalendar(tap('LUNAR'))
    assert.equal(page.data.formData.calendarType, 'SOLAR')
    assert.ok(page.data.previewError)
    assert.equal(page.data.converting, false)
  }
  {
    const { page, calls } = fixture()
    page.data.formData.taskName = '非法间隔'
    page.data.formData.planCycle = 5; page.data.formData.cycleDays = '0'
    await page.handleSubmit()
    assert.ok(calls.find(([kind]) => kind === 'toast'))
    assert.equal(calls.filter(([kind]) => kind === 'add').length, 0)
  }
  {
    const pending = deferred(); let writes = 0
    const { page } = fixture({ addTaskPlan: () => { writes++; return pending.promise } })
    page.data.formData.taskName = '防重复保存'
    const save = page.handleSubmit(); await page.handleSubmit()
    assert.equal(writes, 1)
    pending.resolve({}); await save
  }
  {
    const pending = deferred()
    const { page } = fixture({ previewTaskPlan: () => pending.promise })
    const preview = page.refreshPreview(); page.onUnload()
    pending.resolve({ data: { anchorDate: '2026-11-01' } }); await preview
    assert.equal(page.data.preview, null, 'Late response cannot update an unloaded page')
  }
  console.log('PASS: solar default, calendar conversion, lunar payload, historical edit, failed load, invalid day, stale previews/months, request failure, validation, duplicate save, unload')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
