// Focused regression: real local HTTP + native simulator. Runtime artifacts stay outside the watched project.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const automator = require('/tmp/iw-account-tooling/node_modules/miniprogram-automator')
const endpoint = process.env.IW_LIFE_AUTOMATION_ENDPOINT || 'ws://127.0.0.1:9420'
const out = '/tmp/iw-bookmark-optional-evidence'
const base = 'http://127.0.0.1:18000/auth-service/life/bookmark'
const prefix = 'LIFE-AC-20261028-optional-' + Date.now().toString(36)
const fixtures = [], results = []
let mp, token
async function raw(method, suffix, body) {
  return (await fetch(base + suffix, { method, headers: { iwtoken: token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) })).json()
}
async function api(method, suffix, body) { const r = await raw(method, suffix, body); assert.equal(r.code, 200, method + suffix.split('?')[0] + ': ' + (r.message || '')); return r.data }
async function wait(page, condition) { for (let i = 0; i < 100; i++) { const d = await page.data(); if (condition(d)) return d; await page.waitFor(100) } throw Error('Native page did not reach expected state') }
async function shot(name) { await new Promise(r => setTimeout(r, 350)); await mp.screenshot({ path: path.join(out, name + '.png') }) }
function pass(name) { results.push({ name, status: 'PASS' }); console.log('PASS', name) }
async function main() {
  fs.mkdirSync(out, { recursive: true })
  mp = await automator.connect({ wsEndpoint: endpoint })
  try {
    token = await mp.callWxMethod('getStorageSync', 'iwtoken'); assert.ok(token)
    const added = await api('POST', '/add', { title: prefix + '-只填名称', clientRequestId: prefix + '-api' }); fixtures.push(added.id)
    assert.equal((await api('GET', '/detail?id=' + added.id)).url, null)
    await api('PUT', '/update', { id: added.id, revision: 1, title: prefix + '-只填名称', url: 'https://example.com/saved?q=1#x' })
    assert.equal((await api('GET', '/detail?id=' + added.id)).url, 'https://example.com/saved?q=1#x')
    await api('PUT', '/update', { id: added.id, revision: 2, title: prefix + '-只填名称', url: '' })
    assert.equal((await api('GET', '/detail?id=' + added.id)).url, null)
    assert.notEqual((await raw('POST', '/add', { title: prefix + '-非法链接', url: 'javascript:alert(1)', clientRequestId: prefix + '-invalid' })).code, 200)
    pass('real API: omitted URL, existing URL preserved, URL cleared and invalid filled URL rejected')
    let list = await mp.reLaunch('/pagesLife/life/bookmark-list'); await wait(list, d => d.loaded && !d.loading)
    const editor = await mp.navigateTo('/pagesLife/life/bookmark-editor'); await wait(editor, d => !d.loading)
    const title = prefix + '-名称即可收藏'
    await (await editor.$('input[data-field="title"]')).input(title)
    assert.equal((await editor.data()).form.url, '')
    await shot('name-only-editor')
    await (await editor.$('.primary')).tap()
    for (let i = 0; i < 50; i++) { const current = await mp.currentPage(); if (current.path === 'pagesLife/life/bookmark-list') { list = current; break } await new Promise(r => setTimeout(r, 100)) }
    await wait(list, d => d.loaded && !d.loading && d.items.some(r => r.title === title))
    const row = (await list.data()).items.find(r => r.title === title); fixtures.push(row.id); assert.equal(row.url, null)
    const selector = '.row[data-id="' + row.id + '"]'
    let buttons = await list.$$(selector + ' .small-button'); assert.equal(buttons.length, 1)
    assert.equal((await buttons[0].text()).trim(), '置顶')
    await buttons[0].tap(); await wait(list, d => !d.busy && !d.loading && d.items.some(r => r.id === row.id && r.pinned))
    buttons = await list.$$(selector + ' .small-button'); assert.equal(buttons.length, 1); assert.equal((await buttons[0].text()).trim(), '取消置顶')
    await shot('single-pin-list')
    await buttons[0].tap(); await wait(list, d => !d.busy && !d.loading && d.items.some(r => r.id === row.id && !r.pinned))
    assert.equal((await api('GET', '/detail?id=' + row.id)).pinned, false)
    pass('native UI: save with name only, exactly one list action, pin and unpin')
  } finally {
    for (const id of fixtures) { const row = await api('GET', '/detail?id=' + id); assert.ok(row.title.startsWith(prefix)); await api('DELETE', '/delete?id=' + id + '&revision=' + row.revision) }
    const remaining = await api('POST', '/page', { keyword: prefix }); assert.equal(remaining.total, 0)
    results.push({ name: 'fixture cleanup: no active records', status: 'PASS' })
    if (mp) await mp.disconnect()
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ environment: 'WeChat simulator + real localhost:18000 core APIs', prefix, fixtures, results }, null, 2))
  }
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1 })
