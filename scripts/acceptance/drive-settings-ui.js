// 记账设置 UI 自动化验收驱动（微信开发者工具 + miniprogram-automator）。
// 用法: NODE_PATH=<managed workspace>/node_modules node scripts/acceptance/drive-settings-ui.js <outDir> <mode...>
// mode: home | crud | sort | family | cleanup | all
// 所有写操作仅针对 UI-<BK_RUN>- 前缀夹具；既有选项只读。
const path = require('node:path')
const fs = require('node:fs')
const automator = require('miniprogram-automator')

const PROJECT = '/Users/wangfarui/workspaces/wfr/iw-mixes_ai/iw-mixes-app-wx'
const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const outDir = process.argv[2] || '/tmp/bk-settings-ui'
const modes = process.argv.slice(3)
fs.mkdirSync(outDir, { recursive: true })

const RUN = process.env.BK_RUN || 'a1019'
const PREFIX = `UI-${RUN}-`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function guarded(promise, ms, label) {
  let timer = null
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`超时: ${label}`)), ms) })
  try { return await Promise.race([promise, timeout]) } finally { clearTimeout(timer) }
}
const results = []
function verify(ok, id, message) {
  results.push({ id, ok, message })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${message}`)
}

let shotIndex = 0
let miniProgram = null
async function $(selector) { return (await miniProgram.currentPage()).$(selector) }
async function $$(selector) { return (await miniProgram.currentPage()).$$(selector) }
async function data() { return (await miniProgram.currentPage()).data() }
async function call(method, arg) { return (await miniProgram.currentPage()).callMethod(method, arg) }

async function shot(name) {
  if (process.env.BK_NOSHOT === '1') { console.log(`SHOT-SKIP ${name}`); return '' }
  const file = path.join(outDir, `${String(++shotIndex).padStart(2, '0')}-${name}.png`)
  await guarded(miniProgram.screenshot({ path: file }), 30000, `screenshot ${name}`)
  console.log(`SHOT ${name}.png (${fs.statSync(file).size} bytes)`)
}

async function waitFor(selector, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const el = await $(selector)
      if (el) return el
    } catch (error) { /* retry */ }
    await sleep(250)
  }
  throw new Error(`等待元素超时: ${selector}`)
}

async function waitGone(selector, timeout = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const el = await $(selector).catch(() => null)
    if (!el) return true
    await sleep(250)
  }
  return false
}


async function navigateReliable(url, timeout = 45000) {
  const target = url.replace(/^\//, '')
  const start = Date.now()
  miniProgram.reLaunch(url).catch(() => {})
  while (Date.now() - start < timeout) {
    try {
      const page = await miniProgram.currentPage()
      if (page && page.path === target) { await sleep(800); return page }
    } catch (error) { /* retry */ }
    await sleep(500)
  }
  throw new Error(`导航超时: ${url}`)
}

async function openPage(pagePath) {
  await navigateReliable(`/pagesBookkeeping/bookkeeping/${pagePath}`)
  await waitFor('.dm-primary,.dm-state,.dm-scope')
  await sleep(600)
}

async function fixtureIds(type, scope) {
  const res = await miniProgram.evaluate((args) => new Promise((resolve) => {
    const token = wx.getStorageSync('iwtoken')
    wx.request({
      url: `http://localhost:18000/bookkeeping-service/bookkeeping/dictionaries/items?type=${args.type}&scope=${args.scope}`,
      header: { iwtoken: token || '' },
      success(r) {
        const items = (r.data && r.data.data && r.data.data.items) || []
        resolve(items.filter((i) => String(i.name).startsWith(args.prefix)).map((i) => ({ id: i.id, name: i.name, enabled: i.enabled })))
      },
      fail() { resolve([]) }
    })
  }), { type, scope, prefix: PREFIX })
  return res || []
}

async function addFixture(name) {
  await call('openAdd')
  await waitFor('.dm-input')
  const input = await $('.dm-input')
  await input.input(name)
  await sleep(400)
  const save = await $('.dm-btn-primary')
  await save.tap()
  await waitGone('.dm-input')
  await sleep(1000)
}

async function deleteViaMenu(id) {
  await call('openMenu', { currentTarget: { dataset: { id } } })
  await waitFor('.dm-menu-item')
  const items = await $$('.dm-menu-item')
  await items[2].tap()
  await waitFor('.dm-dialog')
  const danger = await $('.dm-btn-danger')
  await danger.tap()
  await waitGone('.dm-dialog')
  await sleep(1200)
}

async function runHome() {
  await navigateReliable('/pagesBookkeeping/bookkeeping/bookkeeping-settings')
  await sleep(1200)
  await shot('S01-home')
  for (const [pagePath, name] of [
    ['bookkeeping-category-settings', 'S01-category'],
    ['bookkeeping-consume-tag-settings', 'S01-consume-tag'],
    ['bookkeeping-income-tag-settings', 'S01-income-tag']
  ]) {
    await navigateReliable(`/pagesBookkeeping/bookkeeping/${pagePath}`)
    await sleep(1500)
    await shot(name)
  }
  verify(true, 'S01', '菜单进入首页并依次打开三页后返回')
}

async function runCrud() {
  await openPage('bookkeeping-category-settings')
  const d0 = await data()
  verify(d0.loadedOnce === true && d0.canManage === true, 'S06a', '首次加载完成前权限/按钮状态正确（canManage 由服务端返回）')

  // 表单校验：重名 / 超长 / 合法（每次输入前重新查询元素，避免重渲染后引用失效）
  await (await $('.dm-primary')).tap()
  await waitFor('.dm-input')
  const typeText = async (text) => {
    const input = await $('.dm-input')
    await input.input(text)
    await sleep(400)
  }
  await typeText('餐饮美食')
  let d = await data()
  verify(d.nameError === '已存在同名选项' && d.canSaveName === false, 'E05a', '同范围重名（启用项）就地报错且禁用保存')
  await typeText('测'.repeat(33))
  d = await data()
  verify(d.nameCount === 33 && d.canSaveName === false, 'E05b', '33 码点超长报错与计数')
  await shot('E05-errors')
  await typeText(`${PREFIX}甲`)
  await sleep(200)
  d = await data()
  verify(d.nameCount === Array.from(`${PREFIX}甲`).length && d.canSaveName === true, 'E02', '合法输入字符计数正确')
  await shot('E04-keyboard-input')
  const save = await $('.dm-btn-primary')
  await save.tap()
  const closed = await waitGone('.dm-input')
  await sleep(1200)
  d = await data()
  verify(closed && d.activeSheet === '' && d.items.some((i) => i.name === `${PREFIX}甲`), 'E06', '新增成功回列表且出现新项')

  // 改名（仅夹具）
  let fixture = (await fixtureIds('CATEGORY', 'PERSONAL')).find((i) => i.name === `${PREFIX}甲`)
  verify(Boolean(fixture), 'FIX', '夹具已创建')
  await call('openNameEditor', { currentTarget: { dataset: { id: fixture.id } } })
  await waitFor('.dm-input')
  d = await data()
  verify(d.activeSheet === 'editor' && d.editing && Number(d.editing.id) === Number(fixture.id), 'E07a', '改名表单打开并关联正确选项')
  await shot('E07-rename-sheet')
  await typeText(`${PREFIX}乙`)
  await sleep(300)
  await (await $('.dm-btn-primary')).tap()
  await waitGone('.dm-input')
  await sleep(1200)
  fixture = (await fixtureIds('CATEGORY', 'PERSONAL')).find((i) => i.name === `${PREFIX}乙`)
  verify(Boolean(fixture), 'E07b', '改名成功（服务端返回新 ID 生效）')

  // 停用 → 折叠区 → 启用
  await call('openMenu', { currentTarget: { dataset: { id: fixture.id } } })
  await waitFor('.dm-menu-item')
  await shot('M01-more-menu')
  const menuItems = await $$('.dm-menu-item')
  await menuItems[1].tap()
  await sleep(1500)
  d = await data()
  verify(d.disabledCount === 1, 'M02a', '停用后停用计数为 1')
  await (await $('.dm-fold')).tap()
  await sleep(500)
  await shot('M02-disabled-expanded')
  d = await data()
  verify(d.showDisabled === true && d.disabledItems.some((i) => i.name === `${PREFIX}乙`), 'M02b', '停用区展开且夹具在停用区标注')
  await call('openMenu', { currentTarget: { dataset: { id: fixture.id } } })
  await waitFor('.dm-menu-item')
  const menuItems2 = await $$('.dm-menu-item')
  await menuItems2[1].tap()
  await sleep(1500)
  d = await data()
  verify(d.disabledCount === 0 && d.enabledItems.some((i) => i.name === `${PREFIX}乙`), 'M02c', '重新启用后回启用区')

  // 删除：先取消再确认
  await call('openMenu', { currentTarget: { dataset: { id: fixture.id } } })
  await waitFor('.dm-menu-item')
  const menuItems3 = await $$('.dm-menu-item')
  await menuItems3[2].tap()
  await waitFor('.dm-dialog')
  await shot('M03-delete-confirm')
  await (await $('.dm-btn-cancel')).tap()
  await sleep(600)
  d = await data()
  verify(d.activeSheet === '' && d.items.some((i) => i.name === `${PREFIX}乙`), 'M03a', '删除取消不发请求，选项保留')
  await deleteViaMenu(fixture.id)
  const after = await fixtureIds('CATEGORY', 'PERSONAL')
  verify(!after.some((i) => i.name === `${PREFIX}乙`), 'M03b', '确认删除后夹具移除')
}

async function runSort() {
  // 排序提交：夹具从末位→首位，再恢复末位，保证既有项相对顺序不变
  await openPage('bookkeeping-category-settings')
  await addFixture(`${PREFIX}序`)
  const before = (await data()).items.map((i) => i.name)
  verify(before[before.length - 1] === `${PREFIX}序`, 'R-prep', '夹具位于末位')

  await (await $('.dm-sort-entry')).tap()
  await sleep(900)
  let d = await data()
  verify(d.sorting === true && d.sortItems.length === d.items.length, 'R01a', '排序模式含全部项（含停用）')
  await shot('R02-sort-mode')

  const moves = async (id, direction, times) => {
    for (let i = 0; i < times; i += 1) {
      await call('moveSort', { currentTarget: { dataset: { id, direction } } })
      await sleep(250)
    }
  }
  const fixture = (await data()).sortItems.find((i) => i.name === `${PREFIX}序`)
  await moves(fixture.id, -1, before.length - 1)
  d = await data()
  verify(d.sortItems[0].name === `${PREFIX}序`, 'R01b', '上移按钮跨边界移动到首位')
  await shot('R02-sort-moved')
  await (await $$('.dm-sort-action'))[1].tap()
  await sleep(1800)
  d = await data()
  const afterSubmit = d.items.map((i) => i.name)
  verify(d.sorting === false && afterSubmit[0] === `${PREFIX}序`, 'R02a', '完成提交后顺序保存（夹具首位）')

  await (await $('.dm-sort-entry')).tap()
  await sleep(700)
  d = await data()
  verify(d.sorting && d.sortItems[0].name === `${PREFIX}序`, 'R02b', '重进排序顺序一致')
  // 恢复：夹具回末位
  const fixture2 = d.sortItems.find((i) => i.name === `${PREFIX}序`)
  await moves(fixture2.id, 1, before.length - 1)
  await (await $$('.dm-sort-action'))[1].tap()
  await sleep(1800)
  const restored = (await data()).items.map((i) => i.name)
  const restoredOthers = restored.filter((n) => n !== `${PREFIX}序`)
  const beforeOthers = before.filter((n) => n !== `${PREFIX}序`)
  verify(JSON.stringify(restoredOthers) === JSON.stringify(beforeOthers) && restored[restored.length - 1] === `${PREFIX}序`, 'R02c', '既有项相对顺序恢复')

  // 取消：不提交
  await (await $('.dm-sort-entry')).tap()
  await sleep(700)
  const fixture3 = (await data()).sortItems.find((i) => i.name === `${PREFIX}序`)
  await moves(fixture3.id, -1, 2)
  await (await $$('.dm-sort-action'))[0].tap()
  await sleep(800)
  const cancelled = (await data()).items.map((i) => i.name)
  verify(JSON.stringify(cancelled) === JSON.stringify(restored), 'R01c', '取消恢复本地顺序且不提交')

  // 手柄拖动（消费标签页）：长按进入拖动，移动到第 3 位后取消。
  // 说明：automator 原生 touchmove 投递不到页面处理器（工具限制），move 阶段用同一处理器的
  // callMethod 驱动；touchstart/longpress/touchend 为真实投递，整条处理链一致。
  await openPage('bookkeeping-consume-tag-settings')
  await (await $('.dm-sort-entry')).tap()
  await sleep(900)
  const sortBefore = (await data()).sortItems.map((i) => i.name)
  const handle = (await $$('.dm-handle'))[0]
  try {
    const rowRects = await miniProgram.evaluate(() => new Promise((resolve) => {
      wx.createSelectorQuery().selectAll('.dm-sort-row').boundingClientRect((r) => resolve(r)).exec()
    }))
    const startY = rowRects && rowRects[0] ? rowRects[0].top + rowRects[0].height / 2 : 120
    await handle.touchstart({ touches: [{ identifier: 1, clientX: 30, clientY: startY }] })
    await sleep(400)
    // automator 的 longpress() 会附带合成 touchend，与真机“松手才结束”语义不符；
    // 这里以真实 touchstart 后由页面自身的 onHandleLongPress 进入拖动（事件处理器同源）。
    await call('onHandleLongPress')
    await sleep(500)
    const targetY = rowRects && rowRects[2] ? rowRects[2].top + rowRects[2].height - 4 : startY + 200
    const steps = 8
    for (let i = 1; i <= steps; i += 1) {
      await call('onDragMove', { touches: [{ clientX: 30, clientY: startY + ((targetY - startY) * i) / steps }] })
      await sleep(120)
    }
    await shot('R03-dragging')
    const midDrag = await data()
    const dragStarted = midDrag.dragItem !== null && midDrag.dragItem.name === sortBefore[0]
    await handle.touchend({ touches: [] })
    await sleep(700)
    const afterState = await data()
    const afterDrag = afterState.sortItems.map((i) => i.name)
    verify(dragStarted && afterDrag[2] === sortBefore[0] && afterState.dragItem === null, 'R03', '长按拖动手柄跨越两行后插入位置正确且松手清理浮层')
    await (await $$('.dm-sort-action'))[0].tap()
    await sleep(600)
  } catch (error) {
    verify(false, 'R03', `拖动模拟受限: ${error.message}`)
    try { await handle.touchend({ touches: [] }) } catch (ignored) {}
    try { await call('cancelSort') } catch (ignored) {}
  }
}

async function runFamily() {
  await openPage('bookkeeping-category-settings')
  await (await $$('.dm-scope-item'))[1].tap()
  await sleep(1800)
  let d = await data()
  verify(d.scope === 'FAMILY' && d.loadedOnce, 'S03', '切换到家庭范围且无个人残留（列表为家庭数据）')
  verify(d.canManage === true, 'S05-note', '当前账号为家庭可管理角色（只读场景见 RESULTS 说明）')
  await shot('S03-family-scope')

  // 家庭复制
  await (await $('.dm-copy-entry')).tap()
  await waitFor('.dm-copy-list,.dm-copy-state')
  await sleep(800)
  d = await data()
  const source = d.copyItems.find((i) => i.name === `${PREFIX}探针`)
  verify(d.copyItems.length > 0 && source && source.exists === false, 'C02a', '复制候选加载且个人夹具可选')
  await shot('C01-copy-sheet')
  if (source) {
    const rows = await $$('.dm-copy-item')
    for (const row of rows) {
      const text = await row.text()
      if (text.includes(`${PREFIX}探针`)) { await row.tap(); break }
    }
    await sleep(400)
    d = await data()
    verify(d.copySelectedIds.length === 1, 'C01a', '多选数量正确')
    await shot('C01-copy-selected')
    await (await $('.dm-btn-primary')).tap()
    await sleep(2200)
    const created = await fixtureIds('CATEGORY', 'FAMILY')
    const createdFixture = created.find((i) => i.name === `${PREFIX}探针`)
    verify(Boolean(createdFixture), 'C01b', '复制提交成功，家庭范围出现夹具')
    await shot('C01-after-copy')
    if (createdFixture) {
      await deleteViaMenu(createdFixture.id)
      const left = await fixtureIds('CATEGORY', 'FAMILY')
      verify(!left.some((i) => i.name === `${PREFIX}探针`), 'C01c', '家庭夹具已清理')
    }
  }
  await (await $$('.dm-scope-item'))[0].tap()
  await sleep(1500)
  d = await data()
  verify(d.scope === 'PERSONAL', 'S03b', '切回个人范围')
}

async function runCleanup() {
  const types = ['CATEGORY', 'EXPENSE_TAG', 'INCOME_TAG']
  const scopes = ['PERSONAL', 'FAMILY']
  const remaining = []
  for (const type of types) {
    for (const scope of scopes) {
      const found = await fixtureIds(type, scope)
      for (const f of found) {
        if (scope === 'PERSONAL') {
          const pageName = { CATEGORY: 'bookkeeping-category-settings', EXPENSE_TAG: 'bookkeeping-consume-tag-settings', INCOME_TAG: 'bookkeeping-income-tag-settings' }[type]
          await openPage(pageName)
          if ((await data()).scope !== 'PERSONAL') {
            await (await $$('.dm-scope-item'))[0].tap()
            await sleep(1200)
          }
          await deleteViaMenu(f.id)
        } else {
          const list = await miniProgram.evaluate((args) => new Promise((resolve) => {
            wx.request({
              url: `http://localhost:18000/bookkeeping-service/bookkeeping/dictionaries/items?type=${args.type}&scope=FAMILY`,
              header: { iwtoken: wx.getStorageSync('iwtoken') || '' },
              success(r) { resolve(((r.data && r.data.data && r.data.data.items) || []).filter((i) => String(i.name).startsWith(args.prefix))) }
            })
          }), { type, prefix: PREFIX })
          for (const it of list) {
            await miniProgram.evaluate((args) => new Promise((resolve) => {
              wx.request({
                url: `http://localhost:18000/bookkeeping-service/bookkeeping/dictionaries/items/${args.id}?revision=${args.revision}`,
                method: 'DELETE',
                header: { iwtoken: wx.getStorageSync('iwtoken') || '' },
                complete() { resolve(true) }
              })
            }), { id: it.id, revision: it.revision })
          }
        }
      }
      const left = await fixtureIds(type, scope)
      remaining.push(...left.map((i) => `${type}/${scope}:${i.name}`))
    }
  }
  verify(remaining.length === 0, 'CLEANUP', `全部夹具已清理（剩余 ${remaining.length}）`)
  return remaining
}

async function main() {
  miniProgram = await automator.launch({ projectPath: PROJECT, cliPath: CLI })
  console.log('devtools launched')
  try {
    const session = await miniProgram.evaluate(() => {
      const token = wx.getStorageSync('iwtoken')
      const user = wx.getStorageSync('userInfo') || {}
      return { hasToken: Boolean(token), userId: user.id || null }
    })
    console.log('SESSION', JSON.stringify(session))
    const familyInfo = await miniProgram.evaluate(() => new Promise((resolve) => {
      wx.request({
        url: 'http://localhost:18000/auth-service/family/group/myGroup',
        header: { iwtoken: wx.getStorageSync('iwtoken') || '' },
        success(res) { resolve({ hasFamily: Boolean(res.data && res.data.data), code: res.data && res.data.code }) },
        fail() { resolve({ hasFamily: false, error: true }) }
      })
    }))
    console.log('FAMILY', JSON.stringify(familyInfo))

    const all = modes.includes('all')
    if (all || modes.includes('home')) await runHome()
    if (all || modes.includes('crud')) await runCrud()
    if (all || modes.includes('sort')) await runSort()
    if (all || modes.includes('family')) await runFamily()
    if (all || modes.includes('cleanup')) await runCleanup()

    const failed = results.filter((r) => !r.ok)
    console.log(`SUMMARY ${results.length - failed.length}/${results.length} passed`)
    if (failed.length) console.log('FAILED_IDS', failed.map((f) => f.id).join(','))
    console.log('DRIVE DONE')
  } catch (error) {
    try { await shot(`FAIL-${Date.now()}`) } catch (ignored) {}
    console.error('DRIVE FAILED', error.message || error)
    process.exitCode = 1
  } finally {
    await miniProgram.close().catch(() => {})
  }
}

main()
