const bookkeepingApi = require('../../api/bookkeeping')
const dictStore = require('../../stores/dict')
const utils = require('../../utils/bookkeeping')

const fallbackMembershipTypes = [
  { dictCode: 1, dictName: '视频会员' },
  { dictCode: 2, dictName: '音乐会员' },
  { dictCode: 3, dictName: '软件订阅' },
  { dictCode: 9, dictName: '其他' }
]

const fallbackBillingCycles = [
  { dictCode: 1, dictName: '按月' },
  { dictCode: 2, dictName: '按年' },
  { dictCode: 3, dictName: '按周' },
  { dictCode: 4, dictName: '按天' },
  { dictCode: 5, dictName: '一次性' },
  { dictCode: 6, dictName: '自定义' }
]

const fallbackCycleUnits = [
  { dictCode: 1, dictName: '天' },
  { dictCode: 2, dictName: '周' },
  { dictCode: 3, dictName: '月' },
  { dictCode: 4, dictName: '年' }
]

const expiryTypeOptions = [
  { value: '', label: '到期类型' },
  { value: 1, label: '有效期内' },
  { value: 2, label: '即将到期' },
  { value: 3, label: '已过期' }
]

const sortOptions = [
  { label: '排序', sortType: 0, sortWay: 2 },
  { label: '创建时间', sortType: 0, sortWay: 2 },
  { label: '金额最高', sortType: 1, sortWay: 2 },
  { label: '金额最低', sortType: 1, sortWay: 1 },
  { label: '到期最近', sortType: 2, sortWay: 1 },
  { label: '开始最近', sortType: 3, sortWay: 2 }
]

function defaultForm() {
  return {
    membershipType: '',
    membershipName: '',
    amount: '',
    billingCycle: '',
    cycleNum: '',
    cycleUnit: '',
    startDate: utils.today(),
    endDate: '',
    autoRenew: false,
    payWay: '',
    remindDays: '',
    remark: ''
  }
}

function findOption(options, value) {
  return options.find((item) => Number(item.dictCode) === Number(value))
}

function getCode(value) {
  if (value && typeof value === 'object') {
    if (value.code !== undefined) return Number(value.code)
    if (value.value !== undefined) return Number(value.value)
  }
  if (value === '' || value === undefined || value === null) return null
  const numeric = Number(value)
  return Number.isNaN(numeric) ? null : numeric
}

function getEnumText(value, fallback = '') {
  if (value && typeof value === 'object') {
    return value.name || value.desc || value.text || fallback
  }
  return fallback
}

function getOptionText(options, value, fallback = '') {
  const option = findOption(options, value)
  return option ? option.dictName : fallback
}

function toNumber(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function getDateValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

function getCycleText(item, billingCycleOptions, cycleUnitOptions) {
  const billingCycleCode = getCode(item.billingCycle)
  const billingCycleText = getEnumText(
    item.billingCycle,
    getOptionText(billingCycleOptions, billingCycleCode, '计费周期')
  )
  if (billingCycleCode === 6) {
    const cycleUnitCode = getCode(item.cycleUnit)
    const unitText = getEnumText(
      item.cycleUnit,
      getOptionText(cycleUnitOptions, cycleUnitCode, '')
    )
    return `${item.cycleNum || ''}${unitText || billingCycleText}`
  }
  return billingCycleText
}

function normalizeCost(item) {
  const amount = toNumber(item.amount)
  const cycleCode = getCode(item.billingCycle)
  if (cycleCode === 1) return { monthly: amount, yearly: amount * 12 }
  if (cycleCode === 2) return { monthly: amount / 12, yearly: amount }
  if (cycleCode === 3) return { monthly: (amount * 52) / 12, yearly: amount * 52 }
  if (cycleCode === 4) return { monthly: amount * 30, yearly: amount * 365 }
  if (cycleCode === 5) return { monthly: 0, yearly: 0 }
  if (cycleCode === 6) {
    const interval = Math.max(1, Number(item.cycleNum || 1))
    const unitCode = getCode(item.cycleUnit)
    if (unitCode === 1) return { monthly: amount * (30 / interval), yearly: amount * (365 / interval) }
    if (unitCode === 2) return { monthly: amount * ((52 / 12) / interval), yearly: amount * (52 / interval) }
    if (unitCode === 3) return { monthly: amount / interval, yearly: (amount * 12) / interval }
    if (unitCode === 4) return { monthly: amount / (12 * interval), yearly: amount / interval }
  }
  return { monthly: 0, yearly: 0 }
}

function getStatus(item) {
  const endDate = getDateValue(item.endDate)
  if (!endDate) return { text: '有效', className: 'active' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(`${endDate}T00:00:00`)
  if (end < today) return { text: '已过期', className: 'expired' }
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  const remindDays = Number(item.remindDays || 7)
  if (diffDays <= remindDays) return { text: item.autoRenew ? '即将扣费' : '即将到期', className: 'warning' }
  return { text: '有效', className: 'active' }
}

function buildSummary(list) {
  return (list || []).reduce((summary, item) => {
    const cost = normalizeCost(item)
    summary.monthlyTotal += cost.monthly
    summary.yearlyTotal += cost.yearly
    summary.count += 1
    return summary
  }, { monthlyTotal: 0, yearlyTotal: 0, count: 0 })
}

function normalizeItem(item, membershipTypeOptions, billingCycleOptions, cycleUnitOptions) {
  const typeOption = findOption(membershipTypeOptions, item.membershipType)
  const status = getStatus(item)
  const startDate = getDateValue(item.startDate)
  const endDate = getDateValue(item.endDate)
  return {
    ...item,
    amountText: utils.formatMoney(item.amount),
    membershipTypeName: typeOption ? typeOption.dictName : `类型${item.membershipType || '-'}`,
    billingCycleText: getCycleText(item, billingCycleOptions, cycleUnitOptions),
    startDateText: startDate || '-',
    endDateText: endDate || '长期',
    statusText: status.text,
    statusClass: status.className
  }
}

Page({
  data: {
    searchKeyword: '',
    membershipTypeFilter: '',
    expiryType: '',
    sortOptionIndex: 0,
    membershipTypeFilterIndex: 0,
    expiryTypeIndex: 0,
    membershipTypeFilterName: '服务类型',
    expiryTypeName: '到期类型',
    sortOptionName: '排序',
    list: [],
    displayList: [],
    summary: {
      monthlyTotal: '0.00',
      yearlyTotal: '0.00',
      count: 0
    },
    showForm: false,
    showActions: false,
    isEditing: false,
    currentItem: null,
    formData: defaultForm(),
    membershipTypeOptions: [],
    membershipTypeFilterOptions: [{ dictCode: '', dictName: '服务类型' }],
    billingCycleOptions: [],
    cycleUnitOptions: [],
    expiryTypeOptions,
    sortOptions,
    membershipTypeIndex: 0,
    billingCycleIndex: 0,
    membershipTypeName: '',
    billingCycleName: ''
  },

  onShow() {
    this.refreshOptions()
    this.fetchList()
  },

  refreshOptions() {
    const membershipTypeOptions = dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_MEMBERSHIP_TYPE)
    const billingCycleOptions = dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_MEMBERSHIP_BILLING_CYCLE)
    const cycleUnitOptions = dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_MEMBERSHIP_CYCLE_UNIT)
    const safeMembershipTypeOptions = membershipTypeOptions.length ? membershipTypeOptions : fallbackMembershipTypes
    this.setData({
      membershipTypeOptions: safeMembershipTypeOptions,
      membershipTypeFilterOptions: [{ dictCode: '', dictName: '服务类型' }].concat(safeMembershipTypeOptions),
      billingCycleOptions: billingCycleOptions.length ? billingCycleOptions : fallbackBillingCycles,
      cycleUnitOptions: cycleUnitOptions.length ? cycleUnitOptions : fallbackCycleUnits
    })
  },

  async fetchList() {
    const sortOption = this.data.sortOptions[this.data.sortOptionIndex] || this.data.sortOptions[0]
    try {
      const res = await bookkeepingApi.getMembershipList({
        membershipType: this.data.membershipTypeFilter === '' ? null : Number(this.data.membershipTypeFilter),
        expiryType: this.data.expiryType === '' ? null : Number(this.data.expiryType),
        sortType: sortOption.sortType,
        sortWay: sortOption.sortWay
      })
      const list = (res.data || []).map((item) => normalizeItem(
        item,
        this.data.membershipTypeOptions,
        this.data.billingCycleOptions,
        this.data.cycleUnitOptions
      ))
      this.setData({
        list
      }, () => this.applyLocalFilters())
    } catch (error) {
      this.setData({ list: [], displayList: [], summary: { monthlyTotal: '0.00', yearlyTotal: '0.00', count: 0 } })
    }
  },

  applyLocalFilters() {
    const keyword = String(this.data.searchKeyword || '').trim().toLowerCase()
    const displayList = keyword
      ? this.data.list.filter((item) => {
        const name = String(item.membershipName || '').toLowerCase()
        const remark = String(item.remark || '').toLowerCase()
        return name.includes(keyword) || remark.includes(keyword)
      })
      : this.data.list.slice()
    const summary = buildSummary(displayList)
    this.setData({
      displayList,
      summary: {
        monthlyTotal: utils.formatMoney(summary.monthlyTotal),
        yearlyTotal: utils.formatMoney(summary.yearlyTotal),
        count: summary.count
      }
    })
  },

  handleSearchInput(event) {
    this.setData({ searchKeyword: event.detail.value }, () => this.applyLocalFilters())
  },

  clearSearch() {
    this.setData({ searchKeyword: '' }, () => this.applyLocalFilters())
  },

  onMembershipTypeFilterChange(event) {
    const membershipTypeFilterIndex = Number(event.detail.value)
    const option = this.data.membershipTypeFilterOptions[membershipTypeFilterIndex]
    this.setData({
      membershipTypeFilterIndex,
      membershipTypeFilter: option && option.dictCode !== '' ? Number(option.dictCode) : '',
      membershipTypeFilterName: option ? option.dictName : '服务类型'
    })
    this.fetchList()
  },

  onExpiryTypeChange(event) {
    const expiryTypeIndex = Number(event.detail.value)
    const option = this.data.expiryTypeOptions[expiryTypeIndex]
    this.setData({
      expiryTypeIndex,
      expiryType: option && option.value !== '' ? Number(option.value) : '',
      expiryTypeName: option ? option.label : '到期类型'
    })
    this.fetchList()
  },

  onSortChange(event) {
    const sortOptionIndex = Number(event.detail.value)
    const option = this.data.sortOptions[sortOptionIndex]
    this.setData({
      sortOptionIndex,
      sortOptionName: option ? option.label : '排序'
    })
    this.fetchList()
  },

  openItemActions(event) {
    const currentItem = this.data.displayList[Number(event.currentTarget.dataset.index)]
    if (!currentItem) return
    this.setData({
      currentItem,
      showActions: true
    })
  },

  openForm() {
    this.setData({
      showForm: true,
      isEditing: false,
      currentItem: null,
      formData: defaultForm(),
      membershipTypeIndex: 0,
      billingCycleIndex: 0,
      membershipTypeName: '',
      billingCycleName: ''
    })
  },

  closeForm() {
    this.setData({
      showForm: false,
      isEditing: false,
      currentItem: null,
      formData: defaultForm()
    })
  },

  onMembershipTypeChange(event) {
    const membershipTypeIndex = Number(event.detail.value)
    const option = this.data.membershipTypeOptions[membershipTypeIndex]
    this.setData({
      membershipTypeIndex,
      membershipTypeName: option ? option.dictName : '',
      'formData.membershipType': option ? option.dictCode : ''
    })
  },

  onBillingCycleChange(event) {
    const billingCycleIndex = Number(event.detail.value)
    const option = this.data.billingCycleOptions[billingCycleIndex]
    this.setData({
      billingCycleIndex,
      billingCycleName: option ? option.dictName : '',
      'formData.billingCycle': option ? option.dictCode : ''
    })
  },

  onStartDateChange(event) {
    this.setData({ 'formData.startDate': event.detail.value })
  },

  onEndDateChange(event) {
    this.setData({ 'formData.endDate': event.detail.value })
  },

  onAutoRenewChange(event) {
    this.setData({ 'formData.autoRenew': Boolean(event.detail.value) })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  openActions(event) {
    const currentItem = this.data.displayList[Number(event.currentTarget.dataset.index)]
    if (!currentItem) return
    this.setData({
      currentItem,
      showActions: true
    })
  },

  closeActions() {
    this.setData({ showActions: false, currentItem: null })
  },

  buildEditFormState(detail) {
    const membershipTypeValue = getCode(detail.membershipType)
    const billingCycleValue = getCode(detail.billingCycle)
    const cycleUnitValue = getCode(detail.cycleUnit)
    const membershipTypeIndex = this.data.membershipTypeOptions.findIndex((item) => Number(item.dictCode) === membershipTypeValue)
    const billingCycleIndex = this.data.billingCycleOptions.findIndex((item) => Number(item.dictCode) === billingCycleValue)
    const membershipTypeName = getEnumText(
      detail.membershipType,
      detail.membershipTypeName || getOptionText(this.data.membershipTypeOptions, membershipTypeValue, '')
    )
    const billingCycleName = getEnumText(
      detail.billingCycle,
      getOptionText(this.data.billingCycleOptions, billingCycleValue, '')
    )

    return {
      showForm: true,
      isEditing: true,
      currentItem: detail,
      formData: {
        ...defaultForm(),
        ...detail,
        membershipType: membershipTypeValue || '',
        membershipName: detail.membershipName || '',
        amount: detail.amount === undefined || detail.amount === null ? '' : detail.amount,
        billingCycle: billingCycleValue || '',
        cycleUnit: cycleUnitValue || '',
        startDate: getDateValue(detail.startDate) || utils.today(),
        endDate: getDateValue(detail.endDate),
        autoRenew: Boolean(detail.autoRenew),
        payWay: detail.payWay || '',
        remindDays: detail.remindDays === undefined || detail.remindDays === null ? '' : detail.remindDays,
        remark: detail.remark || ''
      },
      membershipTypeIndex: membershipTypeIndex >= 0 ? membershipTypeIndex : 0,
      billingCycleIndex: billingCycleIndex >= 0 ? billingCycleIndex : 0,
      membershipTypeName,
      billingCycleName
    }
  },

  async editMembership() {
    const currentItem = this.data.currentItem
    if (!currentItem) return

    this.setData({
      showActions: false,
      ...this.buildEditFormState(currentItem)
    })

    try {
      const res = await bookkeepingApi.getMembershipDetail(currentItem.id)
      const detail = res.data || currentItem
      this.setData(this.buildEditFormState(detail))
    } catch (error) {
      this.setData(this.buildEditFormState(currentItem))
    }
  },

  async saveMembership() {
    const form = this.data.formData
    if (!form.membershipType) {
      wx.showToast({ title: '请选择会员类型', icon: 'none' })
      return
    }
    if (!String(form.membershipName || '').trim()) {
      wx.showToast({ title: '请输入会员名称', icon: 'none' })
      return
    }
    if (!form.billingCycle) {
      wx.showToast({ title: '请选择计费周期', icon: 'none' })
      return
    }

    const payload = {
      membershipType: Number(form.membershipType),
      membershipName: String(form.membershipName).trim(),
      amount: form.amount === '' ? null : Number(form.amount),
      billingCycle: Number(form.billingCycle),
      startDate: form.startDate,
      endDate: form.endDate || null,
      autoRenew: Boolean(form.autoRenew),
      payWay: form.payWay || '',
      remindDays: form.remindDays === '' ? null : Number(form.remindDays),
      remark: form.remark || ''
    }

    if (form.cycleNum !== '') payload.cycleNum = Number(form.cycleNum)
    if (form.cycleUnit !== '') payload.cycleUnit = Number(form.cycleUnit)
    if (this.data.isEditing && this.data.currentItem) payload.id = this.data.currentItem.id

    if (this.data.isEditing) {
      await bookkeepingApi.updateMembership(payload)
    } else {
      await bookkeepingApi.addMembership(payload)
    }

    wx.showToast({ title: '保存成功', icon: 'success' })
    this.closeForm()
    this.fetchList()
  },

  confirmDeleteMembership() {
    const item = this.data.currentItem
    if (!item) return
    this.deleteMembership(item)
  },

  confirmDeleteFromList(event) {
    const item = this.data.displayList[Number(event.currentTarget.dataset.index)]
    if (!item) return
    this.deleteMembership(item)
  },

  deleteMembership(item) {
    wx.showModal({
      title: '提示',
      content: '确定删除该会员订阅吗？',
      confirmText: '删除',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (!res.confirm) return
        await bookkeepingApi.deleteMembership(item.id)
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.closeActions()
        this.fetchList()
      }
    })
  },

  noop() {}
})
