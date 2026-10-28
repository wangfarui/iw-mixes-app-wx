// Real authenticated HTTP acceptance. Reads the existing simulator session once; never logs it.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const automator = require(process.env.IW_AUTOMATOR_MODULE || '/tmp/iw-account-tooling/node_modules/miniprogram-automator')
const base = 'http://127.0.0.1:18000/auth-service/life/'
const endpoint = process.env.IW_LIFE_AUTOMATION_ENDPOINT || 'ws://127.0.0.1:9420'
const prefix = 'LIFE-AC-20261028-api-' + Date.now().toString(36) + '-'
const out = path.resolve(__dirname, '../../docs/acceptance/life-tools-20261028-r1/api-results.json')
const cases = [], fixtures = []
const routes = { wish: 'wish', date: 'important-date', bookmark: 'bookmark' }
let token
async function raw(method, kind, suffix, body, authenticated = true) {
  const r = await fetch(base + routes[kind] + suffix, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { iwtoken: token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) })
  return r.json()
}
async function api(method, kind, suffix, body) { const r = await raw(method, kind, suffix, body); assert.equal(r.code, 200, method + ' ' + kind + suffix.split('?')[0] + ': ' + (r.message || r.msg || '')); return r.data }
async function add(kind, body) { const r = await api('POST', kind, '/add', body); fixtures.push({ kind, id: r.id }); return r }
function pass(name) { cases.push({ name, status: 'PASS' }); console.log('PASS', name) }
async function cleanupPrior() {
  for (const kind of ['wish', 'date', 'bookmark']) {
    const scopes = kind === 'wish' ? [{ status: 'PENDING' }, { status: 'FULFILLED' }, { status: 'ARCHIVED' }] : kind === 'date' ? [{ view: 'ALL' }] : [{}]
    for (const scope of scopes) {
      const data = await api('POST', kind, '/page', { keyword: 'LIFE-AC-20261028-', pageSize: 50, ...scope })
      for (const row of data.records.filter(r => r.title.startsWith('LIFE-AC-20261028-'))) await api('DELETE', kind, '/delete?id=' + row.id + '&revision=' + row.revision)
    }
  }
}
async function main() {
  const mp = await automator.connect({ wsEndpoint: endpoint })
  try { token = await mp.callWxMethod('getStorageSync', 'iwtoken'); assert.ok(token, 'Existing authorized local login required') }
  finally { await mp.disconnect() }
  try {
    await cleanupPrior()
    assert.equal((await raw('POST', 'wish', '/page', {}, false)).code, 401)
    assert.equal((await raw('GET', 'date', '/calendar?year=2023', undefined, false)).code, 401)
    pass('missing login rejected for data and calendar metadata')
    const requestId = prefix + 'wish'
    const body = { title: prefix + '心愿', estimatedAmount: 0, targetDate: '2027-01-01', priority: 'HIGH', referenceUrl: 'https://example.com/wish?q=1#note', remark: '待清除备注', clientRequestId: requestId }
    const wish = await add('wish', body)
    assert.equal((await api('POST', 'wish', '/add', body)).id, wish.id)
    assert.notEqual((await raw('POST', 'wish', '/add', { ...body, title: prefix + '不同内容' })).code, 200)
    await api('PUT', 'wish', '/change-status', { id: wish.id, revision: 1, action: 'FULFILL' })
    assert.ok((await api('GET', 'wish', '/detail?id=' + wish.id)).fulfilledAt)
    await api('PUT', 'wish', '/change-status', { id: wish.id, revision: 2, action: 'RESTORE' })
    assert.equal((await api('GET', 'wish', '/detail?id=' + wish.id)).fulfilledAt, null)
    await api('PUT', 'wish', '/change-status', { id: wish.id, revision: 3, action: 'ARCHIVE' })
    assert.equal((await api('GET', 'wish', '/detail?id=' + wish.id)).status, 'ARCHIVED')
    await api('PUT', 'wish', '/change-status', { id: wish.id, revision: 4, action: 'RESTORE' })
    await api('PUT', 'wish', '/update', { ...body, id: wish.id, revision: 5, estimatedAmount: null, targetDate: null, referenceUrl: null, remark: null })
    const cleared = await api('GET', 'wish', '/detail?id=' + wish.id)
    for (const field of ['estimatedAmount', 'targetDate', 'referenceUrl']) assert.equal(cleared[field], null)
    assert.equal(cleared.remark, '')
    assert.notEqual((await raw('PUT', 'wish', '/update', { ...body, id: wish.id, revision: 1 })).code, 200)
    pass('wish zero/null, idempotent create, state transitions, explicit clearing and revision conflict')
    const lunar = await add('date', { title: prefix + '农历生日', calendarType: 'LUNAR', dateType: 'BIRTHDAY', eventYear: 2023, eventMonth: 2, eventDay: 1, leapMonth: true, repeatType: 'YEARLY', remindDays: 7, clientRequestId: prefix + 'lunar' })
    const lunarRow = await api('GET', 'date', '/detail?id=' + lunar.id)
    assert.equal(lunarRow.leapMonth, true); assert.equal(lunarRow.eventYear, 2023); assert.ok(lunarRow.nextOccurrenceDate)
    const months = await api('GET', 'date', '/calendar?year=2023'); assert.equal(months.length, 13); assert.ok(months.some(m => m.leap && m.month === 2))
    const summary = await api('GET', 'date', '/reminder-summary'), when = new Date(summary.serverToday + 'T00:00:00Z'); when.setUTCDate(when.getUTCDate() + 3)
    const solar = await add('date', { title: prefix + '公历到期', calendarType: 'SOLAR', dateType: 'EXPIRY', eventYear: when.getUTCFullYear(), eventMonth: when.getUTCMonth() + 1, eventDay: when.getUTCDate(), leapMonth: false, repeatType: 'NONE', remindDays: 7, clientRequestId: prefix + 'solar' })
    const near = await api('GET', 'date', '/detail?id=' + solar.id); assert.equal(near.daysUntil, 3); assert.equal(near.reminderActive, true)
    assert.equal((await api('GET', 'date', '/reminder-summary')).activeReminderCount, summary.activeReminderCount + 1)
    const upcoming = await api('POST', 'date', '/page', { view: 'UPCOMING', keyword: prefix }); assert.ok(upcoming.records.some(r => r.id === solar.id))
    assert.notEqual((await raw('POST', 'date', '/add', { title: prefix + '无效闰月', calendarType: 'LUNAR', eventYear: 2026, eventMonth: 2, eventDay: 1, leapMonth: true, clientRequestId: prefix + 'invalid-lunar' })).code, 200)
    pass('solar/lunar dates, real leap-month metadata, occurrence calculation and reminder count')
    const link = 'https://example.com/travel?q=city#weekend'
    const bookmark = await add('bookmark', { title: prefix + '收藏', url: link, clientRequestId: prefix + 'bookmark', remark: '临时备注' })
    assert.equal((await api('GET', 'bookmark', '/detail?id=' + bookmark.id)).url, link)
    await api('PUT', 'bookmark', '/set-pinned', { id: bookmark.id, revision: 1, pinned: true })
    await api('PUT', 'bookmark', '/update', { id: bookmark.id, revision: 2, title: prefix + '收藏', url: link, category: 'ARTICLE', remark: null })
    const saved = await api('GET', 'bookmark', '/detail?id=' + bookmark.id); assert.equal(saved.remark, ''); assert.equal(saved.pinned, true); assert.equal(saved.category, 'ARTICLE')
    assert.notEqual((await raw('PUT', 'bookmark', '/set-pinned', { id: bookmark.id, revision: 1, pinned: false })).code, 200)
    const duplicate = await add('bookmark', { title: prefix + '同链接不同备注', url: link, clientRequestId: prefix + 'duplicate' }); assert.notEqual(duplicate.id, bookmark.id)
    for (const url of ['javascript:alert(1)', 'https://u:p@example.com']) assert.notEqual((await raw('POST', 'bookmark', '/add', { title: prefix + '无效URL', url, clientRequestId: prefix + 'invalid-url' })).code, 200)
    pass('bookmark full URL, pin, edit, duplicate-link allowance and unsafe URL rejection')
    assert.notEqual((await raw('POST', 'wish', '/page', { pageSize: 51 })).code, 200)
    assert.notEqual((await raw('POST', 'wish', '/add', { title: prefix + '负金额', estimatedAmount: -1, clientRequestId: prefix + 'negative' })).code, 200)
    pass('page-size limit and negative-amount validation')
  } finally {
    for (const fixture of fixtures.reverse()) {
      try { const row = await api('GET', fixture.kind, '/detail?id=' + fixture.id); assert.ok(row.title.startsWith(prefix)); await api('DELETE', fixture.kind, '/delete?id=' + fixture.id + '&revision=' + row.revision); fixture.cleanup = 'API soft-deleted' }
      catch (e) { fixture.cleanup = 'FAIL'; cases.push({ name: 'cleanup ' + fixture.kind + ' ' + fixture.id, status: 'FAIL', detail: e.message }) }
    }
    fs.writeFileSync(out, JSON.stringify({ environment: 'Real local core HTTP API on 18000; existing authorized session; no business responses mocked', prefix, fixtures, cases }, null, 2))
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
