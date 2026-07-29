const assert = require('node:assert/strict')

global.wx = {
  getStorageSync(key) {
    if (key === 'userInfo') return { id: 12 }
    return {}
  },
  setStorageSync() {},
  removeStorageSync() {}
}

let itemListPage
global.Page = (definition) => {
  itemListPage = definition
}

require('../pagesWardrobe/wardrobe/item-list')
const familyStore = require('../stores/family')

function createContext(overrides = {}) {
  return {
    data: {
      list: [{
        id: 7,
        itemName: '蓝色外套',
        ownerUserId: 12,
        ownerText: '我',
        ownerAvatar: 'old-avatar.png',
        canEdit: true,
        canDelete: true,
        canOptimize: true,
        canMarkWorn: true
      }],
      ownerOptions: [
        { value: '', text: '全部成员' },
        { value: 12, text: '我', avatar: 'self-avatar.png' },
        { value: 13, text: '家人甲', avatar: 'family-avatar.png' }
      ],
      ownerIndex: 0,
      ownerScopeFallback: false,
      ...overrides
    },
    setData(update) {
      Object.assign(this.data, update)
    },
    formatListItem: itemListPage.formatListItem,
    itemMatchesOwnerScope: itemListPage.itemMatchesOwnerScope
  }
}

const context = createContext()
itemListPage.updateItemInPlace.call(context, {
  id: 7,
  itemName: '蓝色外套',
  ownerUserId: 13,
  ownerName: '家人甲',
  ownerAvatar: 'family-avatar.png',
  canEdit: false,
  canDelete: false,
  canOptimize: false,
  canMarkWorn: false
})

const updated = context.data.list[0]
assert.equal(updated.ownerUserId, 13)
assert.equal(updated.ownerText, '家人甲')
assert.equal(updated.ownerAvatar, 'family-avatar.png')
assert.equal(updated.canEdit, false)
assert.equal(updated.canDelete, false)
assert.equal(updated.canOptimize, false)
assert.equal(updated.canMarkWorn, false)

const filteredContext = createContext({ ownerIndex: 1 })
itemListPage.updateItemInPlace.call(filteredContext, {
  id: 7,
  ownerUserId: 13,
  ownerName: '家人甲'
})
assert.equal(filteredContext.data.list.length, 0)

const fallbackContext = createContext({ ownerScopeFallback: true })
itemListPage.updateItemInPlace.call(fallbackContext, {
  id: 7,
  ownerUserId: 13,
  ownerName: '家人甲'
})
assert.equal(fallbackContext.data.list.length, 0)

familyStore.updateGroup({ id: 8, queryOnlyMyself: 1 })
const personalScopeContext = createContext()
itemListPage.updateItemInPlace.call(personalScopeContext, {
  id: 7,
  ownerUserId: 13,
  ownerName: '家人甲'
})
assert.equal(personalScopeContext.data.list.length, 0)
familyStore.clearGroup()

let reloadCount = 0
itemListPage.handleItemSaved.call({
  initPage() {
    reloadCount += 1
  }
}, { id: 7, reloadRequired: true })
assert.equal(reloadCount, 1)

console.log('Wardrobe item list sync check passed')
