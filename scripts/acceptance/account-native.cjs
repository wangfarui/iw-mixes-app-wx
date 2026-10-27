// Real WeChat simulator + real loopback APIs. No business responses are mocked.
// During this run only account requests are forwarded from localhost:18000 to the isolated build on 18003.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const automator = require(process.env.IW_AUTOMATOR_MODULE || '/tmp/iw-account-tooling/node_modules/miniprogram-automator')
const out = process.env.IW_ACCOUNT_NATIVE_OUT || '/tmp/iw-account-native-evidence'
const base = 'http://127.0.0.1:18003/auth-service/application/account'
const prefix = 'UI-AC-' + Date.now().toString(36)
const watchdog = setTimeout(() => { console.error('Native acceptance timed out'); process.exit(2) }, 150000)
let mp, token
const results = []
async function api(method, suffix, body) {
  const response = await fetch(base + suffix, { method, headers: { iwtoken: token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json()
  assert.equal(data.code, 200, `${method} ${suffix.split('?')[0]}: ${data.message || ''}`)
  return data.data
}
async function wait(page, condition) {
  for (let i = 0; i < 60; i++) { const data = await page.data(); if (condition(data)) return data; await page.waitFor(150) }
  throw Error('Timed out waiting for page state')
}
async function shot(name) { await new Promise(resolve => setTimeout(resolve, 350)); await mp.screenshot({ path: path.join(out, name + '.png') }) }
async function record(name) { results.push({ case: name, status: 'PASS' }); console.log('PASS', name) }
async function main() {
  fs.mkdirSync(out, { recursive: true })
  mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  try {
    token = await mp.callWxMethod('getStorageSync', 'iwtoken'); assert.ok(token)
    await mp.evaluate(() => {
      const app = getApp(); app.__accountOriginalRequest = wx.request
      wx.request = function (options) {
        const next = Object.assign({}, options)
        if (/^http:\/\/(localhost|127\.0\.0\.1):18000\/auth-service\/application\/account/.test(next.url)) next.url = next.url.replace(/^http:\/\/(localhost|127\.0\.0\.1):18000/, 'http://127.0.0.1:18003')
        return app.__accountOriginalRequest.call(wx, next)
      }
    })
    console.log('Opening add account page')
    const create = await mp.reLaunch('/pagesBase/base/account-detail')
    console.log('Add account page opened')
    await wait(create, d => !d.loading)
    assert.equal((await create.data()).error, '')
    await (await create.$('input[data-field="name"]')).input(prefix + '示例应用')
    await (await create.$('input[data-field="address"]')).input('https://example.com')
    await (await create.$('input[data-field="account"]')).input('demo_developer')
    await (await create.$('input[data-field="password"]')).input('sample-only-password')
    await shot('native-add-account')
    await create.callMethod('openTypes'); await create.waitFor('.quick-add'); await wait(create, d => !d.categoryLoading)
    await shot('native-category-picker')
    await (await create.$('.quick-add')).tap()
    await create.waitFor('.sheet-input'); await (await create.$('.sheet-input')).tap(); await (await create.$('.sheet-input')).input(prefix + '开发')
    await shot('native-quick-category-input')
    await create.callMethod('saveCategory')
    await wait(create, d => !d.busy && !d.sheet)
    let draft = await create.data()
    assert.equal(draft.formData.account, 'demo_developer'); assert.equal(draft.formData.password, 'sample-only-password')
    assert.equal(draft.typeName, prefix + '开发')
    await record('new account: actual input, quick category, preserve account/password draft')
    await create.callMethod('handleSave'); await create.waitFor(500)
    let pageData = await api('POST', '/page', { currentPage: 1, pageSize: 10, keyword: prefix })
    assert.equal(pageData.total, 1)
    const account = pageData.records[0]
    const list = await mp.reLaunch('/pagesBase/base/account-manage')
    await wait(list, d => d.loaded && !d.loading)
    await (await list.$('.search input')).input(prefix)
    await list.waitFor(450)
    await wait(list, d => !d.loading && d.accountList.length === 1 && d.accountList[0].id === account.id)
    await shot('native-account-list')
    await (await list.$('.password-button')).tap()
    await wait(list, d => !d.passwordLoading)
    assert.equal((await list.data()).passwordToShow, 'sample-only-password')
    await list.callMethod('closePassword')
    assert.equal((await list.data()).passwordToShow, '')
    await record('saved account, list filter, password button and clear-on-close')
    const manage = await mp.reLaunch('/pagesBase/base/account-category-settings')
    const state = await wait(manage, d => d.loaded && !d.loading)
    const category = state.items.find(i => i.code === account.type)
    assert.ok(category); assert.equal(category.accountCount, 1)
    await shot('native-categories')
    await manage.callMethod('openName', { currentTarget: { dataset: { id: category.id } } })
    await (await manage.$('.sheet-input')).input(prefix + '研发')
    await shot('native-category-rename')
    await manage.callMethod('saveName'); await wait(manage, d => !d.busy && !d.sheet)
    assert.equal((await api('GET', '/detail?id=' + account.id)).typeName, prefix + '研发')
    await manage.callMethod('startSort'); await manage.callMethod('cancelSort')
    assert.equal((await manage.data()).sorting, false)
    await record('native category rename, live account name, sort entry/cancel')
    const edit = await mp.reLaunch('/pagesBase/base/account-detail?id=' + account.id)
    const editState = await wait(edit, d => !d.loading)
    assert.equal(editState.formData.password, '')
    assert.equal(editState.typeName, prefix + '研发')
    await shot('native-edit-account')
    await record('edit account: current category and blank password field')
  } finally {
    if (token) {
      const fixtures = await api('POST', '/page', { currentPage: 1, pageSize: 100, keyword: prefix })
      for (const row of fixtures.records.filter(i => i.name && i.name.startsWith(prefix))) await api('DELETE', '/delete?id=' + row.id)
      let state = await api('GET', '/categories')
      for (const row of state.items.filter(i => i.name.startsWith(prefix))) {
        const query = new URLSearchParams({ revision: String(row.revision), scopeVersion: state.scopeVersion })
        await api('DELETE', '/categories/' + row.id + '?' + query)
        state = await api('GET', '/categories')
      }
      results.push({ case: 'fixture cleanup', status: 'PASS' })
    }
    if (mp) {
      await mp.evaluate(() => { const app = getApp(); if (app.__accountOriginalRequest) { wx.request = app.__accountOriginalRequest; delete app.__accountOriginalRequest } })
      await mp.disconnect()
    }
    clearTimeout(watchdog)
    fs.writeFileSync(path.join(out, 'native-results.json'), JSON.stringify({ environment: 'WeChat developer tools simulator, real APIs on 18003, temporary URL forwarding restored', prefix, results }, null, 2))
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
