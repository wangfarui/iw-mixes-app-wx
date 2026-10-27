const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function page(name, base = {}, category = {}) {
  let definition
  let token = 'session-A'
  const wx = { hideKeyboard() {}, showToast() {}, setNavigationBarTitle() {}, navigateBack() {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pagesBase/base/', name + '.js'), 'utf8'), {
    require: id => id.endsWith('/base') ? base : id.endsWith('/account-categories') ? category : { getToken: () => token },
    Page: p => { definition = p }, wx, setTimeout, clearTimeout, setInterval, clearInterval, console
  })
  const p = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(patch) {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.split('.'); let parent = this.data
      for (const part of parts.slice(0, -1)) parent = parent[part]
      parent[parts.at(-1)] = value
    }
  } }
  p._token = token; p._alive = true; p._visible = true
  return { p, switchSession() { token = 'session-B' } }
}
async function main() {
  {
    const first = deferred(), second = deferred(); let calls = 0
    const { p } = page('account-manage', { getAccountPage: () => (++calls === 1 ? first.promise : second.promise) })
    const old = p.fetchPage(true); p.data.keyword = 'new'; const current = p.fetchPage(true)
    second.resolve({ data: { records: [{ id: 2, name: 'new' }], total: 1 } }); await current
    first.resolve({ data: { records: [{ id: 1, name: 'old' }], total: 1 } }); await old
    assert.equal(p.data.accountList[0].id, 2, 'late old search must not replace current results')
  }
  {
    const response = deferred()
    const { p } = page('account-manage', { viewAccountPassword: () => response.promise })
    const read = p.viewPassword({ currentTarget: { dataset: { id: 1 } } })
    p.onHide(); response.resolve({ data: 'test-only-value' }); await read
    assert.equal(p.data.passwordToShow, ''); assert.equal(p.data.sheet, '', 'background page must not reopen a password panel')
  }
  {
    const response = deferred()
    const { p, switchSession } = page('account-manage', { getAccountPage: () => response.promise })
    const read = p.fetchPage(true); switchSession(); response.resolve({ data: { records: [{ id: 1, name: 'old-owner' }], total: 1 } }); await read
    assert.equal(p.data.accountList.length, 0, 'changed session must not accept previous owner results')
  }
  {
    let creates = 0, reads = 0
    const { p } = page('account-detail', {}, { create: async () => { creates++; return { item: { code: 8, name: '开发' } } }, list: async () => { if (++reads === 1) throw Error('refresh failure'); return { items: [{ id: 1, code: 8, name: '开发', enabled: true }], scopeVersion: 'v2' } } })
    p.data.draftName = '开发'; p.data.sheet = 'quick'; p.data.formData.account = 'draft'; p.data.formData.password = 'test-only-draft'
    await p.saveCategory(); assert.equal(p.data.formData.type, 8); assert.equal(p.data.sheet, 'quick')
    await p.saveCategory(); assert.equal(creates, 1, 'retry after successful create must only refresh')
    assert.equal(p.data.formData.account, 'draft'); assert.equal(p.data.formData.password, 'test-only-draft'); assert.equal(p.data.sheet, '')
  }
  {
    let writes = 0
    const { p } = page('account-category-settings', {}, { order: async () => { writes++ } })
    p.data.items = [{ id: 1 }, { id: 2 }]; p.startSort(); p.move({ currentTarget: { dataset: { index: 0, direction: 1 } } }); p.cancelSort()
    assert.equal(p.data.items[0].id, 1); assert.equal(writes, 0, 'cancel sort must preserve persisted order and make no request')
  }
  console.log('PASS: stale search, password privacy, session isolation, quick-create retry/draft preservation, sort cancellation (5 scenarios)')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
