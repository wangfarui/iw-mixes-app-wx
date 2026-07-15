const dictStore = require('../stores/dict')

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function today() {
  return formatDate(new Date())
}

function monthRange(dateValue) {
  const source = dateValue ? new Date(dateValue) : new Date()
  const year = source.getFullYear()
  const month = source.getMonth()
  return {
    firstDay: formatDate(new Date(year, month, 1)),
    lastDay: formatDate(new Date(year, month + 1, 0))
  }
}

function yearRange(dateValue) {
  const source = dateValue ? new Date(dateValue) : new Date()
  const year = source.getFullYear()
  return {
    firstDay: `${year}-01-01`,
    lastDay: `${year}-12-31`
  }
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return amount.toFixed(2)
}

function formatMonth(date) {
  const source = date || new Date()
  return `${source.getFullYear()}-${pad2(source.getMonth() + 1)}`
}

function formatYear(date) {
  const source = date || new Date()
  return String(source.getFullYear())
}

function monthStart(monthValue) {
  return `${monthValue || formatMonth()}-01`
}

function percent(value) {
  const ratio = Number(value || 0)
  if (!Number.isFinite(ratio)) return 0
  return Math.max(0, Math.min(100, Number(ratio.toFixed(2))))
}

function enumName(value, fallback = '') {
  if (value == null) return fallback
  if (typeof value === 'object') {
    return value.desc || value.name || value.text || fallback
  }
  return fallback || String(value)
}

function getRecordCategoryText(recordCategory) {
  return Number(recordCategory) === 2 ? '收入' : '支出'
}

function getRecordTypeName(recordType, defaultName = '未知') {
  return dictStore.getDictNameByCode(
    dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TYPE,
    recordType,
    defaultName
  )
}

function getTagName(recordCategory, id) {
  const dictType = Number(recordCategory) === 2
    ? dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_INCOME
    : dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_CONSUME
  return dictStore.getDictNameById(dictType, id)
}

function getTagOptions(recordCategory, selectedIds = []) {
  const dictType = Number(recordCategory) === 2
    ? dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_INCOME
    : dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_CONSUME
  const selectedMap = {}
  selectedIds.forEach((id) => {
    selectedMap[String(id)] = true
  })
  return dictStore.getDictDataArray(dictType).map((item) => ({
    ...item,
    selected: Boolean(selectedMap[String(item.id)])
  }))
}

function getAllTagOptions(selectedIds = []) {
  const consumeTags = dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_CONSUME)
  const incomeTags = dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_INCOME)
  const selectedMap = {}
  selectedIds.forEach((id) => {
    selectedMap[String(id)] = true
  })
  return consumeTags.concat(incomeTags).map((item) => ({
    ...item,
    selected: Boolean(selectedMap[String(item.id)])
  }))
}

function getRecordTypeOptions(includeAll = false) {
  const types = dictStore.getDictDataArray(dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TYPE)
  if (!includeAll) return types
  return [{ id: '-1', dictCode: -1, dictName: '全部' }].concat(types)
}

function formatRecordSource(item) {
  if (item && item.recordSource) return item.recordSource
  return Number(item && item.recordCategory) === 2 ? '收入' : '消费'
}

function formatRecordTags(detail) {
  const tags = detail && Array.isArray(detail.recordTags) ? detail.recordTags : []
  return tags
    .map((id) => getTagName(detail.recordCategory, id))
    .filter(Boolean)
    .join('、')
}

function getRecordIcon(item) {
  if (item && item.recordIcon) {
    return `/static/bookkeeping${item.recordIcon}.svg`
  }
  if (Number(item && item.recordCategory) === 1) return '/static/bookkeeping/icon/zhichu.svg'
  if (Number(item && item.recordCategory) === 2) return '/static/bookkeeping/icon/shouru.svg'
  return '/static/bookkeeping/icon/amount.svg'
}

function formatListRecord(item, scopeState) {
  const recordTypeName = getRecordTypeName(item.recordType, '未知')
  const ownerText = scopeState &&
    scopeState.effectiveScope === 'shared' &&
    item.userName &&
    !item.canEdit
    ? ` · 来自${item.userName}`
    : ''

  return {
    ...item,
    recordTypeName,
    recordSourceText: formatRecordSource(item),
    recordMetaText: `${recordTypeName}${ownerText}`,
    recordIconPath: getRecordIcon(item),
    amountText: `${Number(item.recordCategory) === 1 ? '-' : ''}${item.amount}`,
    recordTimeStr: item.recordTimeStr || item.recordTime || ''
  }
}

module.exports = {
  pad2,
  formatDate,
  today,
  monthRange,
  yearRange,
  formatMoney,
  formatMonth,
  formatYear,
  monthStart,
  percent,
  enumName,
  getRecordCategoryText,
  getRecordTypeName,
  getTagName,
  getTagOptions,
  getAllTagOptions,
  getRecordTypeOptions,
  formatRecordSource,
  formatRecordTags,
  getRecordIcon,
  formatListRecord
}
