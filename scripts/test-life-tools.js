const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function fixture(type, kind, api = {}) {
  let token = 'A'
  const calls = []
  const wx = { setNavigationBarTitle() {}, enableAlertBeforeUnload() {}, disableAlertBeforeUnload() {}, navigateBack() { calls.push('back') }, redirectTo() { calls.push('list') }, showToast(p) { calls.push(p.title) }, stopPullDownRefresh() {}, navigateTo() {} }
  const session = { getToken: () => token }
  function evaluate(file, requireFn) { const module = { exports: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), { module, exports: module.exports, require: requireFn, wx, getCurrentPages: () => [{}], Date, console, setTimeout, clearTimeout }); return module.exports }
  const common = evaluate('pagesLife/life/common.js', p => p.endsWith('/life') ? api : session)
  const factory = evaluate('pagesLife/life/' + type + '-page.js', () => common)
  const definition = factory(kind)
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(patch) {
    for (const [key, value] of Object.entries(patch)) { const parts = key.split('.'); let parent = this.data; for (const p of parts.slice(0, -1)) parent = parent[p]; parent[parts.at(-1)] = value }
  } }
  page._alive = true; page._visible = true; page._token = token; page._requestId = 'test-request'
  return { page, calls, switchSession() { token = 'B' } }
}
async function main() {
  {
    const first = deferred(), second = deferred(); let count = 0
    const { page } = fixture('list', 'wish', { page: () => (++count === 1 ? first.promise : second.promise) })
    const old = page.load(true); page.data.keyword = 'new'; const current = page.load(true)
    second.resolve({ data: { records: [{ id: 2, title: 'new' }], total: 1 } }); await current
    first.resolve({ data: { records: [{ id: 1, title: 'old' }], total: 1 } }); await old
    assert.equal(page.data.items[0].id, 2)
  }
  {
    const pending = deferred(), f = fixture('list', 'bookmark', { page: () => pending.promise })
    const load = f.page.load(true); f.switchSession(); pending.resolve({ data: { records: [{ id: 1, title: 'private' }], total: 1 } }); await load
    assert.equal(f.page.data.items.length, 0)
  }
  {
    const first = deferred(), second = deferred(); let count = 0
    const { page } = fixture('editor', 'date', { calendar: () => (++count === 1 ? first.promise : second.promise) })
    page.data.form.calendarType = 'LUNAR'; page.data.form.eventYear = 2023
    const old = page.loadCalendar(); page.data.form.eventYear = 2026; const current = page.loadCalendar()
    second.resolve({ data: [{ month: 1, leap: false, label: '1月', days: 29 }] }); await current
    first.resolve({ data: [{ month: 2, leap: true, label: '闰2月', days: 29 }] }); await old
    assert.equal(page.data.lunarMonths[0].label, '1月'); assert.equal(page.data.calendarLoading, false)
    page.data.form.eventDay = 30; page.data.form.eventMonth = 1; page.syncLunarDays(0)
    assert.equal(page.data.form.eventDay, null, 'invalid day must require explicit re-selection')
  }
  {
    const { page } = fixture('editor', 'wish')
    page.data.form.title = '免费体验'; page.data.form.estimatedAmount = '0'
    assert.equal(page.payload().estimatedAmount, 0)
    page.data.form.estimatedAmount = ''; assert.equal(page.payload().estimatedAmount, null)
    page.data.form.estimatedAmount = '-1'; assert.throws(() => page.payload())
  }
  {
    const pending = deferred(); let writes = 0
    const { page, calls } = fixture('editor', 'wish', { add: () => { writes++; return pending.promise } })
    page.data.form.title = '防连点'; const save = page.save(); await page.save(); assert.equal(writes, 1)
    pending.resolve({ data: { id: 1, revision: 1 } }); await save; assert.ok(calls.includes('list'), 'a root editor must redirect to its list instead of calling navigateBack')
  }
  {
    let writes = 0; const sent = []
    const { page } = fixture('editor', 'bookmark', { add: async (kind, body) => { sent.push(JSON.stringify(body)); if (++writes === 1) throw { errMsg: 'request:fail timeout' }; return { data: { id: 1 } } } })
    page.data.form.title = '重试原请求'; page.data.form.url = 'https://example.com?q=1#x'
    await page.save(); assert.equal(page.data.uncertain, true); assert.equal(page.data.form.title, '重试原请求')
    page.input({ currentTarget: { dataset: { field: 'title' } }, detail: { value: '不能覆盖不明结果' } }); assert.equal(page.data.form.title, '重试原请求')
    await page.save(); assert.equal(sent[0], sent[1], 'uncertain retry must reuse exact payload and request ID')
  }
  {
    let sent
    const { page } = fixture('editor', 'bookmark', { add: async (kind, body) => { sent = body; return { data: { id: 1 } } } })
    page.data.form.title = '只保存名称'
    assert.equal(page.payload().url, null)
    await page.save(); assert.equal(sent.title, '只保存名称'); assert.equal(sent.url, null)
    page.data.form.url = 'javascript:alert(1)'; assert.throws(() => page.payload(), /HTTP/)
  }
  console.log('PASS: 7 life-tool behavior scenarios (stale results, session privacy, lunar options, null/zero, duplicate submit, uncertain retry, name-only bookmark)')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
