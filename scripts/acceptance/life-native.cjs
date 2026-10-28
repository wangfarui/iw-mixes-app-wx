// Native WeChat simulator + real authenticated loopback APIs. Only LIFE-AC fixtures are written.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const automator = require(process.env.IW_AUTOMATOR_MODULE || '/tmp/iw-account-tooling/node_modules/miniprogram-automator')
const endpoint = process.env.IW_LIFE_AUTOMATION_ENDPOINT || 'ws://127.0.0.1:9421'
const base = process.env.IW_LIFE_ACCEPTANCE_BASE || 'http://127.0.0.1:18000'
assert.equal(base, 'http://127.0.0.1:18000', 'Acceptance uses the standard local core service only')
// Keep live artifacts outside the watched project; archive after the simulator flow completes.
const out = process.env.IW_LIFE_NATIVE_OUT || '/tmp/iw-life-native-evidence'
const prefix = 'LIFE-AC-20261028-' + Date.now().toString(36) + '-'
const routes = { wish: 'wish', date: 'important-date', bookmark: 'bookmark' }
const cases = []
let mp, token
const fixtures = []
const watchdog = setTimeout(() => { console.error('Life native acceptance timed out'); if (mp) mp.disconnect().catch(() => {}); process.exitCode = 2 }, 180000)
async function raw(method, route, body, authenticated = true) {
  const response = await fetch(base + '/auth-service/' + route, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { iwtoken: token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return response.json()
}
async function api(method, kind, suffix, body) {
  const result = await raw(method, 'life/' + routes[kind] + suffix, body)
  assert.equal(result.code, 200, method + ' ' + kind + suffix.split('?')[0] + ': ' + (result.message || result.msg || ''))
  return result.data
}
async function wait(page, condition) {
  for (let i = 0; i < 80; i++) { const data = await page.data(); if (condition(data)) return data; await page.waitFor(100) }
  throw Error('Timed out waiting for native page')
}
async function shot(name) { console.log('Capture native', name); const current = await mp.currentPage(); if (current && current.path) await current.waitFor(350); await mp.screenshot({ path: path.join(out, name + '.png') }) }
function pass(name) { cases.push({ name, status: 'PASS' }); console.log('PASS', name) }
async function readyRoute(expected) {
  for (let i = 0; i < 100; i++) {
    const current = await mp.currentPage()
    if (current && current.path && (!expected || current.path === expected)) return current
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('Native route did not settle: ' + (expected || 'current page'))
}
async function launch(route) {
  const expected = route.split('?')[0].replace(/^\//, '')
  const current = await readyRoute()
  if (current.path === expected && !route.includes('?')) return current
  return expected === 'pages/menu' ? mp.switchTab(route) : mp.reLaunch(route)
}
async function page(name) {
  console.log('Opening native', name.split('?')[0])
  let current
  if (name.includes('-editor')) {
    // Use the actual list -> editor flow so native Back has a real parent page.
    const list = await launch('/pagesLife/life/' + name.split('-editor')[0] + '-list')
    await wait(list, data => data.loaded && !data.loading)
    current = await mp.navigateTo('/pagesLife/life/' + name)
  } else current = await launch('/pagesLife/life/' + name)
  await wait(current, data => !data.loading)
  assert.equal((await current.data()).error, '')
  await current.waitFor(name.includes('editor') ? 'input[data-field="title"]' : '.search input')
  return current
}
async function find(kind, title) {
  const query = { keyword: title, pageSize: 50, currentPage: 1, ...(kind === 'date' ? { view: 'ALL' } : {}) }
  const records = (await api('POST', kind, '/page', query)).records
  return records.find(r => r.title === title)
}
async function main() {
  fs.mkdirSync(out, { recursive: true })
  mp = await automator.connect({ wsEndpoint: endpoint })
  try {
    const previous = await mp.currentPage(); if (previous && previous.path) { const data = await previous.data(); if (data.form && String(data.form.title).startsWith('LIFE-AC-20261028-')) await previous.callMethod('clearAlert') }
    token = await mp.callWxMethod('getStorageSync', 'iwtoken'); assert.ok(token, 'Existing authorized simulator login required')
    for (const kind of ['wish', 'date', 'bookmark']) {
      const scopes = kind === 'wish' ? [{ status: 'PENDING' }, { status: 'FULFILLED' }, { status: 'ARCHIVED' }] : kind === 'date' ? [{ view: 'ALL' }] : [{}]
      for (const scope of scopes) {
        const prior = await api('POST', kind, '/page', { keyword: 'LIFE-AC-20261028-', pageSize: 50, ...scope })
        for (const row of prior.records.filter(r => r.title.startsWith('LIFE-AC-20261028-'))) await api('DELETE', kind, '/delete?id=' + row.id + '&revision=' + row.revision)
      }
    }
    const unauth = await raw('POST', 'life/wish/page', {}, false); assert.equal(unauth.code, 401)
    const invalid = await raw('POST', 'life/bookmark/add', { title: prefix + 'invalid', url: 'javascript:alert(1)', clientRequestId: 'invalid-' + Date.now() }); assert.notEqual(invalid.code, 200)
    pass('real APIs: authentication and invalid URL rejection')
    await launch('/pages/menu')
    const title = prefix + '舒服的书桌椅，给日常多一点期待🌿'
    let editor = await page('wish-editor')
    await (await editor.$('input[data-field="title"]')).input(title); console.log('Native wish title entered')
    await (await editor.$('input[data-field="estimatedAmount"]')).input('1500.25'); console.log('Native wish amount entered')
    await (await editor.$('textarea[data-field="remark"]')).input('中文输入验证：长备注应自然断行，金额和底部保存按钮不被遮挡。')
    await editor.callMethod('select', { currentTarget: { dataset: { field: 'priority' } }, detail: { value: '1' } })
    await shot('wish-editor')
    await (await editor.$('.primary')).tap()
    await readyRoute('pagesLife/life/wish-list')
    const wish = await find('wish', title); assert.ok(wish); fixtures.push({ kind: 'wish', id: wish.id })
    assert.equal(wish.priority, 'HIGH'); assert.equal(Number(wish.estimatedAmount), 1500.25)
    let list = await page('wish-list'); await shot('wish-list')
    await list.callMethod('action', { currentTarget: { dataset: { id: wish.id, action: 'FULFILL' } } })
    await list.callMethod('choose', { currentTarget: { dataset: { value: 'FULFILLED' } } }); await wait(list, d => !d.loading)
    assert.ok((await list.data()).items.some(i => i.id === wish.id)); await shot('wish-fulfilled')
    pass('native wish: actual Chinese/emoji and money input, save, fulfill, filter')
    editor = await page('date-editor')
    const lunarTitle = prefix + '农历生日'
    await (await editor.$('input[data-field="title"]')).input(lunarTitle)
    await (await editor.$('.segment[data-value="LUNAR"]')).tap()
    await wait(editor, d => !d.calendarLoading)
    await editor.callMethod('chooseYear', { detail: { value: String(2023 - 1901) } }); await wait(editor, d => !d.calendarLoading)
    let state = await editor.data(); const leapIndex = state.lunarMonths.findIndex(m => m.month === 2 && m.leap)
    assert.ok(leapIndex >= 0); await editor.callMethod('chooseMonth', { detail: { value: String(leapIndex) } })
    await editor.callMethod('chooseDay', { detail: { value: '0' } }); await shot('date-lunar-editor')
    await (await editor.$('.primary')).tap(); await readyRoute('pagesLife/life/date-list')
    const lunar = await find('date', lunarTitle); assert.ok(lunar); fixtures.push({ kind: 'date', id: lunar.id })
    assert.equal(lunar.calendarType, 'LUNAR'); assert.equal(lunar.leapMonth, true); assert.ok(lunar.nextOccurrenceDate)
    pass('native lunar date: calendar switch, real leap-month metadata, save and occurrence')
    const today = (await api('GET', 'date', '/reminder-summary')).serverToday
    const when = new Date(today + 'T00:00:00Z'); when.setUTCDate(when.getUTCDate() + 3)
    const dateBody = { title: prefix + '到期提醒', calendarType: 'SOLAR', eventYear: when.getUTCFullYear(), eventMonth: when.getUTCMonth() + 1, eventDay: when.getUTCDate(), repeatType: 'NONE', remindDays: 7, clientRequestId: prefix + 'reminder' }
    const near = await api('POST', 'date', '/add', dateBody); fixtures.push({ kind: 'date', id: near.id })
    const replay = await api('POST', 'date', '/add', dateBody); assert.equal(replay.id, near.id)
    list = await page('date-list'); await list.callMethod('onPullDownRefresh'); await wait(list, d => d.loaded && !d.loading); await shot('date-list')
    assert.ok((await list.data()).items.some(i => i.id === near.id && i.reminderActive))
    let menu = await launch('/pages/menu'); await menu.callMethod('handleSearch', { detail: { value: '' } }); await menu.callMethod('onShow'); await wait(menu, d => d.filteredMenuList.some(g => g.title === '生活工具' && g.components.some(i => i.text === '重要日期' && i.badge > 0)))
    const menuScroll = await menu.$('.menu-scroll'); await menuScroll.scrollTo(0, 10000); await shot('menu-life-tools')
    await menu.callMethod('handleSearch', { detail: { value: '账号管理' } }); assert.ok((await menu.data()).filteredMenuList.some(g => g.components.some(i => i.text === '应用账号')))
    pass('real date reminder, menu badge, create replay and old account search alias')
    editor = await page('bookmark-editor')
    const bookmarkTitle = prefix + '周末旅行资料'
    await (await editor.$('input[data-field="title"]')).input(bookmarkTitle)
    await (await editor.$('textarea[data-field="url"]')).input('https://example.com/travel?q=city#weekend')
    await (await editor.$('textarea[data-field="remark"]')).input('收藏长链接与中文备注，稍后可以复制再打开。')
    await shot('bookmark-editor'); await (await editor.$('.primary')).tap(); await readyRoute('pagesLife/life/bookmark-list')
    const bookmark = await find('bookmark', bookmarkTitle); assert.ok(bookmark); fixtures.push({ kind: 'bookmark', id: bookmark.id })
    assert.equal(bookmark.url, 'https://example.com/travel?q=city#weekend'); assert.equal(bookmark.category, 'OTHER')
    list = await page('bookmark-list'); await list.callMethod('action', { currentTarget: { dataset: { id: bookmark.id } } }); await shot('bookmark-list')
    assert.equal((await api('GET', 'bookmark', '/detail?id=' + bookmark.id)).pinned, true)
    const conflict = await raw('PUT', 'life/bookmark/update', { id: bookmark.id, revision: 1, title: bookmarkTitle, url: bookmark.url, category: bookmark.category }); assert.notEqual(conflict.code, 200)
    editor = await page('bookmark-editor?id=' + bookmark.id); await wait(editor, d => !d.loading); assert.equal((await editor.data()).form.revision, 2)
    await (await editor.$('textarea[data-field="remark"]')).input('修改后保存，再次验证版本递增。'); await (await editor.$('.primary')).tap(); await readyRoute('pagesLife/life/bookmark-list')
    assert.equal((await api('GET', 'bookmark', '/detail?id=' + bookmark.id)).revision, 3)
    pass('native bookmark: create, full URL, pin, conflict rejection and edit')
    const account = await launch('/pagesBase/base/account-manage'); await wait(account, d => !d.loading); await account.callMethod('refresh'); await wait(account, d => d.loaded && !d.loading)
    assert.equal((await account.data()).error, '')
    pass('existing application-account list still loads through original route')
  } finally {
    for (const fixture of fixtures.reverse()) {
      try { const row = await api('GET', fixture.kind, '/detail?id=' + fixture.id); assert.ok(row.title.startsWith(prefix)); await api('DELETE', fixture.kind, '/delete?id=' + fixture.id + '&revision=' + row.revision); fixture.cleanup = 'API soft-deleted' }
      catch (e) { fixture.cleanup = 'FAIL'; cases.push({ name: 'cleanup ' + fixture.kind + ' ' + fixture.id, status: 'FAIL', detail: e.message }) }
    }
    if (mp) {
      await mp.evaluate(() => { const app = getApp(); if (app.__lifeOriginalRequest) { wx.request = app.__lifeOriginalRequest; delete app.__lifeOriginalRequest } })
      await mp.disconnect()
    }
    clearTimeout(watchdog)
    fs.writeFileSync(path.join(out, 'native-results.json'), JSON.stringify({ environment: 'WeChat simulator; real authenticated core APIs on ' + base + (base.endsWith(':18000') ? '; standard app base URL, no forwarding' : '; all requests use the standard app base URL'), prefix, fixtures, cases }, null, 2))
  }
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1 })
