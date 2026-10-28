const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
// Isolated controller tests; these mocks are not real-account acceptance evidence.
function pageFor(api, tokenRef = { value: 'unit-session' }) {
  let definition
  const session = { getToken: () => tokenRef.value }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pagesBase/base/system-options.js'), 'utf8'), {
    require: name => name.includes('system-options') ? api : name.includes('session') ? session : { refreshDictCache: async () => {} },
    Page: p => { definition = p }, wx: { setNavigationBarTitle() {}, showToast() {} }
  })
  const page = { ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch) } }
  page.onLoad({ domain: 'kitchen', type: '3003' })
  return page
}
const fixture = () => ({ definitions: [{ type: 3003, name: '菜品分类', options: [] }], differences: [], issues: [], scopeVersion: 'unit-version', addCount: 1, correctCount: 0, userCount: 2 })
test('committed database result never repeats sync when cache refresh needs retry', async () => {
  let writes = 0, refreshes = 0
  const api = { capabilities: async () => ({ data: { manageSystemOptions: true } }), preview: async () => ({ data: fixture() }), sync: async () => { writes++; return { data: { cacheRefreshed: false } } }, refresh: async () => { refreshes++; return { data: true } } }
  const page = pageFor(api)
  await page.reload(); page.openConfirm(); await page.confirmSync()
  assert.equal(page.data.committed, true); assert.equal(page.data.cachePending, true)
  page.openConfirm(); await page.confirmSync(); assert.equal(writes, 1)
  await page.retryCache(); assert.equal(writes, 1); assert.equal(refreshes, 1)
})
test('failed write retains preview and server capability loss removes all actions', async () => {
  let allowed = true
  const api = { capabilities: async () => ({ data: { manageSystemOptions: allowed } }), preview: async () => ({ data: fixture() }), sync: async () => { throw new Error('conflict') } }
  const page = pageFor(api); await page.reload(); page.openConfirm(); await page.confirmSync()
  assert.equal(page.data.preview.scopeVersion, 'unit-version'); assert.equal(page.data.busy, false)
  allowed = false; await page.confirmSync(); assert.equal(page.data.allowed, false); assert.equal(page.data.preview, null)
})
test('late permission response cannot restore old-session capabilities', async () => {
  let resolve, previews = 0
  const token = { value: 'old-unit-session' }
  const api = { capabilities: () => new Promise(r => { resolve = r }), preview: async () => { previews++; return { data: fixture() } } }
  const page = pageFor(api, token); const pending = page.reload()
  token.value = 'new-unit-session'; resolve({ data: { manageSystemOptions: true } }); await pending
  assert.equal(page.data.allowed, false); assert.equal(page.data.preview, null); assert.equal(previews, 0)
})
test('unknown permission failure hides cached management data', async () => {
  const page = pageFor({ capabilities: async () => { throw new Error('offline') } })
  page.setData({ allowed: true, preview: fixture() }); await page.reload()
  assert.equal(page.data.allowed, false); assert.equal(page.data.preview, null); assert.equal(page.data.error, 'offline')
})

test('leaving during a write cannot leave the page permanently busy on return', async () => {
  const page = pageFor({ capabilities: async () => ({ data: { manageSystemOptions: true } }), preview: async () => ({ data: fixture() }) })
  await page.reload(); page.setData({ busy: true }); page.onHide(); assert.equal(page.data.busy, false)
  await page.onShow(); assert.equal(page.data.allowed, true); assert.equal(page.data.loading, false)
})
