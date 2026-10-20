const optionsStore = require('../stores/bookkeeping-options')
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

function getRecordTypeName(record, defaultName = '未分类') {
  if (!record || typeof record !== 'object') return defaultName
  if (Number(record.dictionarySnapshotStatus) === 0) return '分类待核对'
  return record.recordTypeName || defaultName
}
function getOptionName(id, defaultName = '') {
  const item = optionsStore.get('CATEGORY').find((item) => Number(item.id) === Number(id))
  return item ? item.name : defaultName
}

function getTagName(recordCategory, id) {
  const dictType = Number(recordCategory) === 2
    ? dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_INCOME
    : dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_CONSUME
  const item = optionsStore.get(dictType).find((item) => Number(item.id) === Number(id))
  return item ? item.name : ''
}

// Action VOs serialize CSV storage as JSON arrays; tolerate either wire shape
// at the client boundary and keep all form selections as numeric ID arrays.
function normalizeTagIds(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return Array.from(new Set(values
    .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0)))
}

function getTagOptions(recordCategory, selectedIds = []) {
  const dictType = Number(recordCategory) === 2
    ? dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_INCOME
    : dictStore.dictTypeEnum.BOOKKEEPING_RECORD_TAG_CONSUME
  const selectedMap = {}
  normalizeTagIds(selectedIds).forEach((id) => {
    selectedMap[String(id)] = true
  })
  return optionsStore.get(dictType).map((item) => ({
    ...item,
    selected: Boolean(selectedMap[String(item.id)])
  }))
}

function getAllTagOptions(selectedIds = []) {
  const consumeTags = optionsStore.get('EXPENSE_TAG')
  const incomeTags = optionsStore.get('INCOME_TAG')
  const selectedMap = {}
  normalizeTagIds(selectedIds).forEach((id) => {
    selectedMap[String(id)] = true
  })
  return consumeTags.concat(incomeTags).map((item) => ({
    ...item,
    selected: Boolean(selectedMap[String(item.id)])
  }))
}

function getRecordTypeOptions(includeAll = false) {
  const types = optionsStore.get('CATEGORY')
  if (!includeAll) return [{ id: null, name: '未分类', dictName: '未分类' }].concat(types)
  return [{ id: '-1', dictName: '全部' }].concat(types)
}

function formatRecordSource(item) {
  if (item && item.recordSource) return item.recordSource
  return Number(item && item.recordCategory) === 2 ? '收入' : '消费'
}

function formatRecordTags(detail) {
  return ((detail && detail.recordTagSnapshots) || []).map((tag) => tag.name).filter(Boolean).join('、')
}

// Old selections are private to this editor and never enter the new-record store.
function getEditorTypeOptions(form) {
  const options = getRecordTypeOptions(false)
  if (form.recordTypeId && !options.some((item) => Number(item.id) === Number(form.recordTypeId))) {
    options.unshift({ id: form.recordTypeId, dictName: `当前：${getRecordTypeName(form)}`, historical: true })
  }
  return options
}

function getEditorTagOptions(form) {
  const selectedIds = normalizeTagIds(form.recordTags)
  const options = getTagOptions(form.recordCategory, selectedIds)
  const type = Number(form.recordCategory) === 2 ? 4011 : 4001
  ;(form.recordTagSnapshots || []).filter((tag) => Number(tag.type) === type).forEach((tag) => {
    if (!options.some((item) => Number(item.id) === Number(tag.id))) {
      options.push({ id: tag.id, name: tag.name, dictName: `当前：${tag.name}`, selected: selectedIds.includes(Number(tag.id)), historical: true })
    }
  })
  return options
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
  const payer = require('./bookkeeping-payer')
  const recordTypeName = getRecordTypeName(item)
  const ownerText = payer.payerText(item, scopeState)

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
  getOptionName,
  getEditorTagOptions,
  getEditorTypeOptions,
  getTagName,
  normalizeTagIds,
  getTagOptions,
  getAllTagOptions,
  getRecordTypeOptions,
  formatRecordSource,
  formatRecordTags,
  getRecordIcon,
  formatListRecord
}
