const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../pagesPoints/points/task-plan.js'), 'utf8')
const storage = new Map()
const generated = new Map()
const requests = []
const modals = []
const previews = []
const navigation = []
let currentUser = 1
let confirm = true
let timeoutAfterCreation = false
let nextDeleted = false
let actionSheet
let nextTaskId = 100
const plan = { id: 10, taskName: '交电费', deadlineDays: 2, rewardPoints: 10, punishPoints: 5, status: 0 }

function page() {
  let definition
  vm.runInNewContext(source, {
    require(name) {
      if (name === '../../api/points') return {
        async getTaskPlanDetail() { return { data: plan } },
        async generateTaskPlanNow(request) {
          requests.push(request)
          const key = `${currentUser}:${request.id}:${request.requestId}`
          if (!generated.has(key)) generated.set(key, { taskId: nextTaskId++, deadlineDate: '2026-10-15', taskDeleted: nextDeleted })
          if (timeoutAfterCreation) {
            timeoutAfterCreation = false
            throw new Error('Network timeout after the server committed')
          }
          return { data: generated.get(key) }
        }
      }
      if (name === '../../stores/session') return { getUserInfo: () => ({ id: currentUser }) }
      if (name === '../../utils/task-bookkeeping') return { templateSummary: () => '支出 · 电费 · ¥100.00' }
      throw new Error(`Unexpected module: ${name}`)
    },
    wx: {
      getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key),
      showModal(options) { modals.push(options); options.success({ confirm, cancel: !confirm }) },
      showActionSheet(options) { actionSheet = options },
      showLoading() {}, hideLoading() {}, showToast() {},
      navigateTo: options => navigation.push(options.url)
    },
    Page: value => { definition = value }
  }, { filename: 'task-plan.js' })
  definition.setData = values => {
    Object.assign(definition.data, values)
    if (values.generationConfirmVisible) {
      previews.push(values.generationPreview)
      queueMicrotask(() => definition.finishGenerationConfirm(confirm))
    }
  }
  return definition
}

async function main() {
  const first = page()
  first.data.list = [plan]
  first.openActions({ currentTarget: { dataset: { index: 0 } } })
  assert.deepEqual(Array.from(actionSheet.itemList), ['立即生成', '编辑', '启用', '删除'])
  const wxml = fs.readFileSync(path.join(__dirname, '../pagesPoints/points/task-plan.wxml'), 'utf8')
  assert.ok(!wxml.includes('bindtap="handleGenerate"'), 'No list-item generation button')

  confirm = false
  await first.handleGenerate(plan)
  assert.equal(requests.length, 0, 'Cancel never submits or stores an operation')
  assert.equal(storage.size, 0)
  confirm = true
  timeoutAfterCreation = true
  await first.handleGenerate(plan)
  assert.equal(first.data.generating, false)
  assert.equal(generated.size, 1)
  assert.equal(storage.size, 1, 'An uncertain operation survives a page exit')

  const reopened = page()
  await reopened.handleGenerate(plan)
  assert.equal(requests[0].requestId, requests[1].requestId)
  assert.equal(generated.size, 1, 'Retry recovers the existing task')
  assert.equal(storage.size, 0)
  assert.ok(previews.some(item => item.retry))
  assert.equal(navigation.at(-1), '/pagesPoints/task/task-edit-detail?taskId=100')

  await reopened.handleGenerate(plan)
  assert.notEqual(requests[1].requestId, requests[2].requestId)
  assert.equal(generated.size, 2, 'Another deliberate action creates another task')

  timeoutAfterCreation = true
  await reopened.handleGenerate(plan)
  const ownerRequest = requests.at(-1).requestId
  currentUser = 2
  await page().handleGenerate(plan)
  assert.notEqual(requests.at(-1).requestId, ownerRequest, 'Another user never inherits the pending request')
  assert.equal(storage.size, 1)
  currentUser = 1
  await page().handleGenerate(plan)
  assert.equal(requests.at(-1).requestId, ownerRequest)
  assert.equal(storage.size, 0)

  const beforeDeletedView = navigation.length
  nextDeleted = true
  await page().handleGenerate(plan)
  assert.equal(navigation.length, beforeDeletedView, 'Deleted retries do not open an unavailable task')
  assert.equal(storage.size, 0)
  const guarded = page()
  guarded.data.generating = true
  const beforeGuard = requests.length
  await guarded.handleGenerate(plan)
  assert.equal(requests.length, beforeGuard)
  assert.ok(previews.some(item => item.rewardPoints === 10 && item.punishPoints === 5))
  console.log('PASS: long-press entry, cancel, disabled plan, persistent retry, new operation, owner isolation, deleted result, double-tap guard')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
