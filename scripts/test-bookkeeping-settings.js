// 记账设置（首页共享工厂）行为回归：名称校验、异步隔离、防重、写后刷新、排序与复制派生。
// 仅验证共享状态与请求行为；真实 UI/权限验收以微信开发者工具实测为准。
const assert = require('node:assert/strict')

const storage = new Map([['userInfo', { id: 1 }], ['iwtoken', 'token-a']])
global.wx = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
  showToast() {},
  vibrateShort() {}
}

const familyApi = require('../api/family')
const dictApi = require('../api/bookkeeping-dictionaries')
const optionsStore = require('../stores/bookkeeping-options')
const family = require('../stores/family')
const settings = require('../utils/bookkeeping-settings')

let definition
global.Page = (page) => { definition = page }
require('../pagesBookkeeping/bookkeeping/bookkeeping-category-settings')

function context(page) {
  return {
    ...page,
    data: JSON.parse(JSON.stringify(page.data)),
    setData(values) {
      Object.entries(values).forEach(([path, value]) => {
        const parts = String(path).split('.')
        let target = this.data
        parts.slice(0, -1).forEach((part) => { target = target[part] })
        target[parts.at(-1)] = value
      })
    }
  }
}

function makePage() {
  return context(definition)
}

function item(id, name, enabled = true, revision = 1) {
  return { id, name, enabled, sort: id, revision }
}

async function flush(times = 8) {
  for (let i = 0; i < times; i += 1) await Promise.resolve()
}

async function run() {
  // ---------- 1. 名称规范化与校验 ----------
  assert.equal(settings.nameValue('  餐饮 美食  '), '餐饮 美食', '内部空格不改写')
  assert.equal(settings.nameValue('\u3000工资\u3000'), '工资', '全角空白去除')
  assert.equal(settings.nameValue('   '), '', '全空白归一为空')
  assert.equal(settings.nameLength('🍚🍜食'), 3, 'emoji 按码点计数')
  assert.equal(settings.nameLength('a'.repeat(32)), 32)
  assert.equal(settings.nameLength('a'.repeat(33)), 33)

  const list = [item(1, '餐饮'), item(2, '日用', false), item(3, 'AbC')]
  assert.equal(settings.validateName('  餐饮 ', list).error, '已存在同名选项', '启用重名拒绝')
  assert.equal(settings.validateName('日用', list).error, '已存在同名选项', '停用同名占名')
  assert.equal(settings.validateName('abc', list).error, '', '大小写不同不算重名')
  assert.equal(settings.validateName('餐饮', list, 1).error, '', '改名排除自己')
  assert.equal(settings.validateName('', list).canSave, false)
  assert.equal(settings.validateName('x'.repeat(33), list).error.includes('32'), true)
  assert.equal(settings.validateName('🍚'.repeat(32), list).canSave, true, '32 码点 emoji 合法')
  assert.equal(settings.validateName('🍚'.repeat(33), list).canSave, false, '33 码点拒绝')

  // ---------- 7. 复制派生（纯计算） ----------
  const derived = settings.deriveCopyItems(
    [item(10, '餐饮'), item(11, '旅行', false), item(12, ' 日用 '), item('13', '固定支出')],
    [item(20, '餐饮', true), item(21, '日用', false)]
  )
  assert.equal(derived[0].exists, true, '家庭启用重名不可选')
  assert.equal(derived[1].exists, false)
  assert.equal(derived[1].enabled, false, '个人停用来源保留停用状态')
  assert.equal(derived[2].exists, true, '家庭停用同名也占名，不允许复制自动启用')

  // 复制勾选的展示状态必须与已选数量同步，不能只验证提交 ID。
  const copying = makePage()
  copying.setData({ copyItems: derived })
  const tapCopy = (id) => copying.toggleCopyItem({ currentTarget: { dataset: { id } } })
  const checkedCopyIds = () => copying.data.copyItems.filter((row) => row.selected).map((row) => Number(row.id))
  tapCopy('11')
  assert.deepEqual(copying.data.copySelectedIds, [11])
  assert.deepEqual(checkedCopyIds(), [11], '勾选后选项框展示必须与添加所选数量同步')
  tapCopy(10)
  assert.deepEqual(checkedCopyIds(), [11], '已存在项点击不得改变勾选状态')
  tapCopy('13')
  assert.deepEqual(copying.data.copySelectedIds, [11, 13], '多选数量正确')
  assert.deepEqual(checkedCopyIds(), [11, 13], '多选的所有勾选框均展示选中状态')
  tapCopy(11)
  assert.deepEqual(checkedCopyIds(), [13], '取消一项不影响其他勾选框')
  tapCopy(13)
  assert.deepEqual(copying.data.copySelectedIds, [])
  assert.deepEqual(checkedCopyIds(), [], '再次点击取消勾选')
  tapCopy(11)
  copying.closeCopy()
  assert.deepEqual(copying.data.copySelectedIds, [], '关闭弹层清空勾选')
  assert.deepEqual(copying.data.copyItems, [], '关闭弹层清空显示状态')

  const template = require('node:fs').readFileSync(require('node:path').join(__dirname, '../pagesBookkeeping/bookkeeping/dictionary-management.wxml'), 'utf8')
  const checkboxBindings = template.match(/<view class="dm-checkbox[\s\S]*?<\/view>/)[0]
  assert.doesNotMatch(checkboxBindings, /\b\w+\s*\(/, 'WXML 勾选绑定不能调用数组方法')

  // ---------- 6. 排序纯计算 ----------
  const base = [1, 2, 3, 4].map((id) => item(id, `n${id}`, id !== 2))
  assert.deepEqual(settings.reorder(base, 0, 2).map((i) => i.id), [2, 3, 1, 4])
  assert.deepEqual(settings.reorder(base, 3, 0).map((i) => i.id), [4, 1, 2, 3])
  assert.deepEqual(settings.reorder(base, -1, 2).map((i) => i.id), base.map((i) => i.id), '非法输入不变')
  const rects = [{ top: 0, height: 50 }, { top: 50, height: 80 }, { top: 130, height: 50 }]
  assert.equal(settings.dragTargetIndex(rects, 1, 20), 0, '手指越过上一行中心线')
  assert.equal(settings.dragTargetIndex(rects, 1, 10), 0, '不等高行按中心线判断')
  assert.equal(settings.dragTargetIndex(rects, 1, 60), -1, '未越线保持原位')
  assert.equal(settings.dragTargetIndex(rects, 0, 300), 2, '向下越过所有中心线')
  assert.equal(settings.dragTargetIndex(rects, 2, 20), 0, '反向拖动越过首行中心线')
  assert.equal(settings.dragTargetIndex(rects, 2, 40), 1, '反向拖动停在两行之间')

  // ---------- 2. scope A 慢响应不能覆盖 scope B ----------
  familyApi.getMyGroup = async () => ({ data: { id: 88, familyGroupId: 88 } })
  const listCalls = []
  dictApi.list = (type, scope) => new Promise((resolve) => {
    listCalls.push(scope)
    const items = scope === 'PERSONAL' ? [item(1, '个人项')] : [item(2, '家庭项')]
    const delay = scope === 'PERSONAL' ? 30 : 1
    setTimeout(() => resolve({ data: { items, canManage: true, scopeVersion: `v-${scope}`, familyGroupId: 88 } }), delay)
  })
  const slowFirst = makePage()
  slowFirst.load(true)
  slowFirst.changeScope({ currentTarget: { dataset: { scope: 'FAMILY' } } })
  await flush(30)
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(slowFirst.data.scope, 'FAMILY')
  assert.equal(slowFirst.data.items.length, 1)
  assert.equal(slowFirst.data.items[0].name, '家庭项', '慢的 personal 响应不能覆盖家庭列表')

  // ---------- 3/4/5. 写入流程 ----------
  let adds = 0
  let listFails = 0
  dictApi.add = async () => { adds += 1; await flush(); return { data: item(99, 'UI-x-新增') } }
  dictApi.rename = async () => ({ data: { oldId: 1, item: item(100, '新名字', true, 2) } })
  dictApi.list = async (type, scope) => {
    if (listFails > 0) { listFails -= 1; throw new Error('网络抖动') }
    return { data: { items: [item(1, '餐饮'), item(2, '日用', false)], canManage: true, scopeVersion: 'v1', familyGroupId: 88 } }
  }

  const page = makePage()
  page.load(true)
  await flush(20)
  assert.equal(page.data.loadedOnce, true)
  assert.equal(page.data.canManage, true)

  // 保存连点只发一次写请求
  page.openAdd()
  page.setData({ draftName: 'UI-x-新增' })
  page._syncDraft()
  assert.equal(page.data.canSaveName, true)
  const save1 = page.saveName()
  const save2 = page.saveName()
  await Promise.all([save1, save2])
  assert.equal(adds, 1, '连点只写入一次')
  assert.equal(page.data.busy, false)
  assert.equal(page.data.activeSheet, '', '成功后关闭弹层')
  assert.equal(optionsStore.get('CATEGORY').length >= 0, true, '写入后候选缓存失效流程不抛错')

  // 写成功但列表刷新失败：不重复 POST，仅可只读重试
  adds = 0
  listFails = 1
  page.openAdd()
  page.setData({ draftName: 'UI-x-新增2' })
  page._syncDraft()
  await page.saveName()
  assert.equal(adds, 1, '刷新失败不再次新增')
  assert.equal(page.data.refreshFailed, true)
  await page.retryRefresh()
  assert.equal(page.data.refreshFailed, false, '只读重试恢复')
  assert.equal(adds, 1, '重试不再发 POST')

  // 普通失败保留草稿可重试
  let failOnce = 1
  dictApi.add = async () => { if (failOnce > 0) { failOnce -= 1; throw new Error('服务端繁忙') } adds += 1; return { data: item(98, '重试成功') } }
  page.openAdd()
  page.setData({ draftName: '保留草稿' })
  page._syncDraft()
  await page.saveName()
  assert.equal(page.data.activeSheet, 'editor', '失败保留表单')
  assert.equal(page.data.draftName, '保留草稿', '草稿保留')
  assert.equal(page.data.writeError, '服务端繁忙')
  await page.saveName()
  assert.equal(page.data.activeSheet, '', '重试成功关闭')

  // 改名接受服务端新 ID/revision 流程；过期 revision 不自动重放
  let renames = 0
  dictApi.rename = async () => { renames += 1; throw new Error('数据已变化，请刷新后重试') }
  page.openNameEditor({ currentTarget: { dataset: { id: 1 } } })
  assert.equal(page.data.editing.id, 1)
  page.setData({ draftName: '餐饮改名' })
  page._syncDraft()
  await page.saveName()
  assert.equal(renames, 1, '冲突只写一次，不自动重放')
  assert.equal(page.data.writeError.includes('刷新'), true)

  // ---------- 6. 排序流程 ----------
  let orderCalls = 0
  let lastOrder = null
  dictApi.order = async (payload) => { orderCalls += 1; lastOrder = payload; return { data: null } }
  page.startSort()
  assert.equal(page.data.sorting, true)
  assert.equal(page.data.sortItems.length, 2, '排序包含全部项（含停用）')
  page.moveSort({ currentTarget: { dataset: { id: 2, direction: -1 } } })
  assert.deepEqual(page.data.sortItems.map((i) => i.id), [2, 1])
  page.cancelSort()
  assert.equal(orderCalls, 0, '取消不调用排序 API')
  assert.equal(page.data.sorting, false)

  page.startSort()
  await page.finishSort()
  assert.equal(orderCalls, 1)
  assert.deepEqual(lastOrder.ids, [1, 2], '提交进入排序时的全量顺序')
  assert.equal(lastOrder.scopeVersion, 'v1', '携带进入时的 scopeVersion')
  assert.equal(new Set(lastOrder.ids).size, lastOrder.ids.length, 'ID 无重复')
  assert.equal(page.data.sorting, false)

  // 提交失败：保留草稿与排序模式，可取消或重试，不自动重放
  dictApi.order = async () => { throw new Error('版本冲突') }
  page.startSort()
  page.moveSort({ currentTarget: { dataset: { id: 2, direction: -1 } } })
  await page.finishSort()
  assert.equal(page.data.sortError, '版本冲突')
  assert.equal(page.data.sorting, true, '失败保留排序草稿')
  assert.deepEqual(page.data.sortItems.map((i) => i.id), [2, 1], '草稿顺序保留')
  assert.equal(orderCalls, 1, '不自动重放旧 payload')
  page.cancelSort()
  assert.equal(page.data.sorting, false, '可取消恢复')
  await flush(10)

  // ---------- 8. 身份切换隔离 / 无家庭 / 卸载 ----------
  const stale = makePage()
  stale.onShow()
  await flush(10)
  stale.openAdd()
  stale.setData({ draftName: '旧身份草稿' })
  // 模拟切账号：token 变化
  storage.set('iwtoken', 'token-b')
  stale.onShow()
  await flush(10)
  assert.equal(stale.data.activeSheet, '', '身份变化清空弹层')
  assert.equal(stale.data.draftName, '', '身份变化清空草稿')

  family.clearGroup()
  familyApi.getMyGroup = async () => ({ data: null })
  const noFamily = makePage()
  noFamily.onShow()
  await flush(20)
  assert.equal(noFamily.data.hasFamily, false)
  assert.equal(noFamily.data.scope, 'PERSONAL', '无家庭仅个人范围')
  noFamily.openCopy()
  await flush(10)
  assert.equal(noFamily.data.activeSheet, '', '无家庭不可进入复制')

  // 只读：canManage=false 时写操作全部被拒绝
  dictApi.list = async () => ({ data: { items: [item(1, '家庭项')], canManage: false, scopeVersion: 'v9', familyGroupId: 88 } })
  family.updateGroup({ id: 88, familyGroupId: 88 })
  const readonlyPage = makePage()
  readonlyPage.onShow()
  await flush(20)
  assert.equal(readonlyPage.data.canManage, false)
  readonlyPage.openAdd()
  assert.equal(readonlyPage.data.activeSheet, '', '只读不可新增')
  readonlyPage.openMenu({ currentTarget: { dataset: { id: 1 } } })
  assert.equal(readonlyPage.data.activeSheet, '', '只读无更多菜单')
  readonlyPage.startSort()
  assert.equal(readonlyPage.data.sorting, false, '只读不可排序')

  // 卸载后迟到 finally 不清理新请求状态
  const dying = makePage()
  dying.onShow()
  await flush(10)
  dying.onUnload()
  const before = JSON.stringify([dying.data.loading, dying.data.busy])
  await flush(10)
  assert.equal(JSON.stringify([dying.data.loading, dying.data.busy]), before, '卸载后无迟到状态污染')

  console.log('test-bookkeeping-settings: all assertions passed')
}

run().catch((error) => { console.error(error); process.exit(1) })
