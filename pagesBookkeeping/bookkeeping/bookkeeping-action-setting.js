const bookkeepingApi = require('../../api/bookkeeping')
const { getIconUrl } = require('../../utils/icon')

function toSortNumber(value, fallback) {
  const sort = Number(value)
  return Number.isFinite(sort) ? sort : fallback
}

function normalizeSort(value) {
  return Number(value.toFixed(4))
}

function buildActionUpdatePayload(action, sort) {
  return {
    id: action.id,
    recordCategory: action.recordCategory,
    recordSource: action.recordSource,
    recordType: action.recordType,
    recordIcon: action.recordIcon || '',
    recordTags: action.recordTags || [],
    sort
  }
}

function calculateMovedSort(actions, targetIndex) {
  const currentAction = actions[targetIndex]
  const prevAction = actions[targetIndex - 1]
  const nextAction = actions[targetIndex + 1]

  if (prevAction && nextAction) {
    const prevSort = toSortNumber(prevAction.sort, targetIndex * 10)
    const nextSort = toSortNumber(nextAction.sort, (targetIndex + 2) * 10)
    const gap = nextSort - prevSort
    if (Math.abs(gap) <= 0.0001) return null
    return normalizeSort(prevSort + gap / 2)
  }

  if (prevAction) {
    return normalizeSort(toSortNumber(prevAction.sort, targetIndex * 10) + 10)
  }

  if (nextAction) {
    return normalizeSort(toSortNumber(nextAction.sort, (targetIndex + 2) * 10) - 10)
  }

  return normalizeSort(toSortNumber(currentAction.sort, 10))
}

Page({
  data: {
    selectedCategory: 1,
    actions: [],
    isMoving: false
  },

  onShow() {
    this.fetchActions()
  },

  selectCategory(event) {
    this.setData({
      selectedCategory: Number(event.currentTarget.dataset.category)
    })
    this.fetchActions()
  },

  async fetchActions() {
    try {
      const res = await bookkeepingApi.getActionList(this.data.selectedCategory)
      const actions = (res.data || []).map((action) => ({
        ...action,
        iconUrl: getIconUrl(action.recordIcon)
      }))
      this.setData({ actions })
    } catch (error) {
      this.setData({ actions: [] })
    }
  },

  confirmDelete(event) {
    const action = this.data.actions[Number(event.currentTarget.dataset.index)]
    if (!action) return

    wx.showModal({
      title: '提示',
      content: '删除后不会影响已存在账单中的记录，是否确认删除？',
      confirmText: '删除',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (!res.confirm) return
        await bookkeepingApi.deleteAction(action.id)
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        this.fetchActions()
      }
    })
  },

  async moveAction(event) {
    if (this.data.isMoving) return

    const index = Number(event.currentTarget.dataset.index)
    const dir = Number(event.currentTarget.dataset.dir)
    const targetIndex = index + dir
    if (targetIndex < 0 || targetIndex >= this.data.actions.length) return

    const actions = this.data.actions.slice()
    const currentAction = actions[index]
    const targetAction = actions[targetIndex]
    actions[index] = targetAction
    actions[targetIndex] = currentAction
    this.setData({ actions, isMoving: true })

    try {
      const newSort = calculateMovedSort(actions, targetIndex)

      if (newSort == null) {
        await this.persistActionOrder(actions)
      } else {
        actions[targetIndex] = {
          ...currentAction,
          sort: newSort
        }
        this.setData({ actions })
        await bookkeepingApi.updateAction(buildActionUpdatePayload(currentAction, newSort))
      }

      await this.fetchActions()
    } catch (error) {
      await this.fetchActions()
    } finally {
      this.setData({ isMoving: false })
    }
  },

  async persistActionOrder(actions) {
    for (let index = 0; index < actions.length; index += 1) {
      const sort = (index + 1) * 10
      await bookkeepingApi.updateAction(buildActionUpdatePayload(actions[index], sort))
    }
  },

  editAction(event) {
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-action-edit?id=${event.currentTarget.dataset.id}`
    })
  },

  addCategory() {
    wx.navigateTo({
      url: `/pagesBookkeeping/bookkeeping/bookkeeping-action-edit?recordCategory=${this.data.selectedCategory}`
    })
  }
})
