const assert = require('node:assert/strict')

global.wx = {
  getStorageSync() {
    return {}
  },
  setStorageSync() {},
  removeStorageSync() {},
  hideLoading() {}
}

let itemFormPage
global.Page = (definition) => {
  itemFormPage = definition
}

require('../pagesWardrobe/wardrobe/item-form')
const wardrobeApi = require('../api/wardrobe')

function recoverCalls(canOptimize) {
  let calls = 0
  const context = {
    data: {
      formData: { id: 7 },
      canOptimize
    },
    setData() {},
    formOptionData() {
      return {}
    },
    recoverImageOptimizeTask() {
      calls += 1
    }
  }
  itemFormPage.onShow.call(context)
  return calls
}

async function main() {
  assert.equal(recoverCalls(false), 0, '只读详情 onShow 不应恢复图片优化任务')
  assert.equal(recoverCalls(true), 1, '可维护详情仍应恢复图片优化任务')

  wardrobeApi.getItemDetail = async () => ({
    data: {
      id: 7,
      itemName: '蓝色外套',
      ownerUserId: 13,
      canEdit: false,
      canOptimize: false
    }
  })
  let loadDetailRecoverCalls = 0
  const loadDetailContext = {
    data: { ownerOptions: [], formData: {}, statusOptions: [] },
    setData(update) {
      Object.assign(this.data, update)
    },
    ownerIndex() {
      return 0
    },
    formOptionData() {
      return {}
    },
    imageOptimizeIdleState() {
      return {}
    },
    recoverImageOptimizeTask() {
      loadDetailRecoverCalls += 1
    }
  }
  await itemFormPage.loadDetail.call(loadDetailContext, 7)
  assert.equal(loadDetailRecoverCalls, 0, '只读详情加载完成后不应恢复图片优化任务')

  let taskApiCalls = 0
  wardrobeApi.getLatestOptimizeItemImageTask = async () => {
    taskApiCalls += 1
    return { data: {} }
  }
  await itemFormPage.recoverImageOptimizeTask.call({
    data: { canOptimize: false },
    latestOptimizeQueryToken: 0,
    pageActive: true,
    setData() {},
    imageOptimizeIdleState() {
      return {}
    }
  }, 7)
  assert.equal(taskApiCalls, 0, '只读详情的任务恢复方法必须在调用接口前直接返回')

  console.log('Wardrobe read-only item form check passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
