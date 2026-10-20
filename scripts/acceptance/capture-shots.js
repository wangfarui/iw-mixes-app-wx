// 记账设置 UI 证据截图：每个高风险弹层截图在独立开发者工具会话中完成，避免键盘/弹层态截图导致会话失稳。
// 用法: NODE_PATH=<managed workspace>/node_modules node scripts/acceptance/capture-shots.js <outDir>
const path = require('node:path')
const fs = require('node:fs')
const automator = require('miniprogram-automator')

const PROJECT = '/Users/wangfarui/workspaces/wfr/iw-mixes_ai/iw-mixes-app-wx'
const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const outDir = process.argv[2] || '/tmp/bk-shots'
fs.mkdirSync(outDir, { recursive: true })
const RUN = process.env.BK_RUN || 'a1019'
const PREFIX = `UI-${RUN}-观`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withSession(name, fn) {
  const mp = await automator.launch({ projectPath: PROJECT, cliPath: CLI })
  try {
    await fn(mp)
    console.log(`SHOT-OK ${name}`)
  } catch (error) {
    console.log(`SHOT-FAIL ${name}: ${error.message}`)
  } finally {
    await mp.close().catch(() => {})
  }
}

async function openCategory(mp) {
  await mp.reLaunch('/pagesBookkeeping/bookkeeping/bookkeeping-category-settings')
  const start = Date.now()
  while (Date.now() - start < 15000) {
    const page = await mp.currentPage()
    const el = await page.$('.dm-primary,.dm-state')
    if (el) break
    await sleep(300)
  }
  await sleep(800)
}

async function shot(mp, name) {
  const file = path.join(outDir, `${name}.png`)
  await mp.screenshot({ path: file })
  console.log(`  ${name}.png (${fs.statSync(file).size} bytes)`)
}

async function main() {
  await withSession('add-sheet-empty', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    await (await page.$('.dm-primary')).tap()
    await sleep(1200)
    await shot(mp, 'E01-add-sheet')
  })

  await withSession('editor-input-keyboard', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    await (await page.$('.dm-primary')).tap()
    await sleep(1000)
    const input = await page.$('.dm-input')
    await input.input(PREFIX)
    await sleep(900)
    await shot(mp, 'E02-E04-input-keyboard')
  })

  await withSession('editor-errors', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    await (await page.$('.dm-primary')).tap()
    await sleep(1000)
    const input = await page.$('.dm-input')
    await input.input('餐饮美食')
    await sleep(900)
    await shot(mp, 'E05-duplicate-error')
  })

  await withSession('more-menu', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    const d = await page.data()
    await page.callMethod('openMenu', { currentTarget: { dataset: { id: d.items[0].id } } })
    await sleep(900)
    await shot(mp, 'M01-more-menu')
  })

  await withSession('delete-dialog', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    const d = await page.data()
    await page.callMethod('openMenu', { currentTarget: { dataset: { id: d.items[0].id } } })
    await sleep(700)
    await page.callMethod('menuDelete')
    await sleep(900)
    await shot(mp, 'M03-delete-dialog')
  })

  await withSession('rename-sheet', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    const d = await page.data()
    await page.callMethod('openNameEditor', { currentTarget: { dataset: { id: d.items[0].id } } })
    await sleep(1100)
    await shot(mp, 'E07-rename-sheet')
  })

  await withSession('disabled-expanded', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    // 创建并停用夹具，展开停用区截图，随后清理
    await page.callMethod('openAdd')
    await sleep(900)
    const input = await page.$('.dm-input')
    await input.input(PREFIX)
    await sleep(400)
    await (await page.$('.dm-btn-primary')).tap()
    await sleep(1600)
    let d = await page.data()
    const fixture = d.items.find((i) => i.name === PREFIX)
    await page.callMethod('openMenu', { currentTarget: { dataset: { id: fixture.id } } })
    await sleep(700)
    const menu = await page.$$('.dm-menu-item')
    await menu[1].tap()
    await sleep(1500)
    await (await page.$('.dm-fold')).tap()
    await sleep(700)
    await shot(mp, 'M02-disabled-expanded')
    // 清理：启用后删除
    d = await page.data()
    await page.callMethod('openMenu', { currentTarget: { dataset: { id: fixture.id } } })
    await sleep(700)
    const menu2 = await page.$$('.dm-menu-item')
    await menu2[1].tap()
    await sleep(1400)
    await page.callMethod('openMenu', { currentTarget: { dataset: { id: fixture.id } } })
    await sleep(700)
    const menu3 = await page.$$('.dm-menu-item')
    await menu3[2].tap()
    await sleep(700)
    await (await page.$('.dm-btn-danger')).tap()
    await sleep(1600)
    const left = (await page.data()).items.filter((i) => i.name === PREFIX).length
    console.log(`  cleanup remaining ${left}`)
  })

  await withSession('sort-mode', async (mp) => {
    await mp.reLaunch('/pagesBookkeeping/bookkeeping/bookkeeping-consume-tag-settings')
    await sleep(2500)
    const page = await mp.currentPage()
    await (await page.$('.dm-sort-entry')).tap()
    await sleep(1200)
    await shot(mp, 'R02-sort-mode')
  })

  await withSession('drag-shadow', async (mp) => {
    await mp.reLaunch('/pagesBookkeeping/bookkeeping/bookkeeping-consume-tag-settings')
    await sleep(2500)
    const page = await mp.currentPage()
    await (await page.$('.dm-sort-entry')).tap()
    await sleep(1200)
    const handle = (await page.$$('.dm-handle'))[0]
    const rects = await mp.evaluate(() => new Promise((resolve) => {
      wx.createSelectorQuery().selectAll('.dm-sort-row').boundingClientRect((r) => resolve(r)).exec()
    }))
    const startY = rects[0].top + rects[0].height / 2
    await handle.touchstart({ touches: [{ identifier: 1, clientX: 30, clientY: startY }] })
    await sleep(400)
    await page.callMethod('onHandleLongPress')
    await sleep(500)
    for (let i = 1; i <= 5; i += 1) {
      await page.callMethod('onDragMove', { touches: [{ clientX: 30, clientY: startY + i * 16 }] })
      await sleep(120)
    }
    await shot(mp, 'R03-drag-shadow')
    await handle.touchend({ touches: [] })
    await sleep(400)
    await page.callMethod('cancelSort')
    await sleep(500)
  })

  await withSession('family-scope', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    const scopes = await page.$$('.dm-scope-item')
    await scopes[1].tap()
    await sleep(1800)
    await shot(mp, 'S03-family-scope')
  })

  await withSession('copy-sheet', async (mp) => {
    await openCategory(mp)
    const page = await mp.currentPage()
    const scopes = await page.$$('.dm-scope-item')
    await scopes[1].tap()
    await sleep(1800)
    await (await page.$('.dm-copy-entry')).tap()
    await sleep(1500)
    await shot(mp, 'C01-copy-sheet')
  })

  console.log('CAPTURE DONE')
}

main().catch((error) => { console.error('CAPTURE FAILED', error.message || error); process.exit(1) })
