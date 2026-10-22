const wardrobeOptions = require('../../stores/wardrobe-options')

const COLOR_OPTIONS = [
  { value: '黑色', text: '黑色', hex: '#1f2329' },
  { value: '白色', text: '白色', hex: '#f8f8f8' },
  { value: '灰色', text: '灰色', hex: '#8a8f99' },
  { value: '蓝色', text: '蓝色', hex: '#2f80ed' },
  { value: '绿色', text: '绿色', hex: '#2e7d32' },
  { value: '红色', text: '红色', hex: '#d93026' },
  { value: '黄色', text: '黄色', hex: '#f6c343' },
  { value: '粉色', text: '粉色', hex: '#e88aa8' },
  { value: '紫色', text: '紫色', hex: '#7e57c2' },
  { value: '棕色', text: '棕色', hex: '#8d6e63' },
  { value: '米色', text: '米色', hex: '#d8c7a3' },
  { value: '卡其色', text: '卡其色', hex: '#c3a36b' },
  { value: '牛仔蓝', text: '牛仔蓝', hex: '#3f6f9f' },
  { value: '藏青色', text: '藏青色', hex: '#1f2a44' },
  { value: '彩色', text: '彩色', hex: '#6c8cff' }
]

const SEASON_OPTIONS = [
  { value: 'spring', text: '春' },
  { value: 'summer', text: '夏' },
  { value: 'autumn', text: '秋' },
  { value: 'winter', text: '冬' }
]

const STATUS_OPTIONS = [
  { value: 1, text: '在穿' },
  { value: 2, text: '闲置' },
  { value: 5, text: '已淘汰' }
]

const SORT_OPTIONS = [
  { value: 'createTime', text: '新录入' },
  { value: 'recentWear', text: '最近穿' },
  { value: 'leastWear', text: '少穿优先' },
  { value: 'mostWear', text: '常穿优先' },
  { value: 'priceDesc', text: '价格高' },
  { value: 'purchaseDate', text: '购买新' },
  { value: 'idleDays', text: '闲置久' }
]

const COLOR_HEX_MAP = COLOR_OPTIONS.reduce((map, option) => {
  map[option.value] = option.hex
  return map
}, {})

function getCategoryOptions(owner) {
  const options = wardrobeOptions.get(owner)
  const categories = options && options.categories || []
  const kinds = ['上装','下装','连衣裙','内衣','袜子','鞋履','配饰','帽子','包袋','首饰','其他']
  return categories.map(item => ({ value: item.preferredSourceId, id: item.preferredSourceId,
    text: categories.some(other => other.name === item.name && other.matchKind !== item.matchKind) ? item.name + '（' + (kinds[item.matchKind - 1] || '未归类') + '）' : item.name, matchKind: item.matchKind, sourceIds: item.sources.map(source => source.id), itemStyles: item.itemStyles }))
}
function getItemStyleOptions(category, owner) {
  return getCategoryOptions(owner).filter(item => !category || item.sourceIds.some(id => String(id) === String(category)))
    .flatMap(item => (item.itemStyles || []).map(style => ({value: style.sourceId, id: style.sourceId, text: style.name, parentId: style.categorySourceId})))
}
function getColorOptions(owner) {
  const options = wardrobeOptions.get(owner)
  return (options && options.colors || []).map(item => ({ value: item.sourceId, text: item.name, hex: COLOR_HEX_MAP[item.name] || '' }))
}
function getSceneOptions(owner) {
  const options = wardrobeOptions.get(owner)
  return (options && options.scenes || []).map(item => ({value: item.sourceId, text: item.name}))
}
function getStyleOptions(owner) {
  const options = wardrobeOptions.get(owner)
  return (options && options.styleTags || []).map(item => ({value: item.sourceId, text: item.name}))
}

function today() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function currentMonth() {
  return today().slice(0, 7)
}

function optionText(options, value, fallback = '未设置') {
  const item = options.find((option) => String(option.value) === String(value))
  return item ? item.text : fallback
}

function optionIndex(options, value) {
  const index = options.findIndex((option) => (String(option.value) === String(value) || (option.sourceIds || []).some(id => String(id) === String(value))))
  return index >= 0 ? index : 0
}

function normalizeStatus(value) {
  const status = Number(value)
  if (status === 2) return 2
  if (status === 5) return 5
  if (status === 3 || status === 4) return 2
  return 1
}

function splitTags(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinTags(values) {
  return Array.from(new Set(values || [])).filter(Boolean).join(',')
}

function toggleTag(tags, value) {
  const current = splitTags(tags)
  const nextValue = String(value)
  const index = current.indexOf(nextValue)
  if (index >= 0) {
    current.splice(index, 1)
  } else {
    current.push(nextValue)
  }
  return joinTags(current)
}

function tagNames(options, tags) {
  if (Array.isArray(tags)) return tags.length ? tags.map(tag => tag.nameSnapshot).join('、') : '未设置'
  const values = splitTags(tags)
  if (!values.length) return '未设置'
  return values.map((value) => optionText(options, value, value)).join('、')
}

function customTagNames(tags) {
  const values = splitTags(tags)
  return values.length ? values.join('、') : ''
}

function daysSince(dateText) {
  if (!dateText) return ''
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  return Math.max(Math.floor(diff / (24 * 60 * 60 * 1000)), 0)
}

function enhanceTagOptions(options, tags) {
  const values = splitTags(tags)
  return options.map((option) => ({
    ...option,
    active: values.includes(String(option.value))
  }))
}

function formatItem(item) {
  const categoryOptions = getCategoryOptions()
  const itemStyleOptions = getItemStyleOptions(item.category)
  const colorOptions = getColorOptions()
  const sceneOptions = getSceneOptions()
  const styleOptions = getStyleOptions()
  const colorOption = colorOptions.find((option) => option.value === item.colorName)
  const wearCount = Number(item.wearCount || 0)
  const price = Number(item.price || 0)
  const idleDays = daysSince(item.lastWearDate)
  return {
    ...item,
    image: item.itemImage || '',
    categoryName: item.categoryNameSnapshot || '未分类',
    itemStyleName: item.itemStyleNameSnapshot || '',
    statusName: optionText(STATUS_OPTIONS, normalizeStatus(item.status), '在穿'),
    seasonNames: tagNames(SEASON_OPTIONS, item.seasonTags),
    sceneNames: tagNames(sceneOptions, item.sceneSnapshots || []),
    styleNames: tagNames(styleOptions, item.styleSnapshots || []),
    colorHex: item.colorHex || (colorOption ? colorOption.hex : ''),
    priceText: item.price == null ? '0' : String(item.price),
    wearCountText: `${wearCount}次`,
    customTagNames: customTagNames(item.customTags),
    costPerWearText: wearCount > 0 ? (price / wearCount).toFixed(2) : price.toFixed(2),
    idleDaysText: idleDays === '' ? '未穿过' : `${idleDays}天未穿`,
    storageText: item.storageLocation || '未设位置'
  }
}

function formatOutfit(outfit) {
  const categoryOptions = getCategoryOptions()
  const sceneOptions = getSceneOptions()
  const styleOptions = getStyleOptions()
  return {
    ...outfit,
    coverImage: outfit.coverImage || '',
    seasonNames: tagNames(SEASON_OPTIONS, outfit.seasonTags),
    sceneNames: tagNames(sceneOptions, outfit.sceneSnapshots || []),
    styleNames: tagNames(styleOptions, outfit.styleSnapshots || []),
    customTagNames: customTagNames(outfit.customTags),
    itemList: (outfit.itemList || []).map((item) => ({
      ...item,
      categoryName: item.categoryNameSnapshot || '未分类',
      itemStyleName: item.itemStyleNameSnapshot || ''
    }))
  }
}

function formatRecord(record) {
  const categoryOptions = getCategoryOptions()
  const sceneOptions = getSceneOptions()
  return {
    ...record,
    dateText: record.wearDate || '',
    typeText: Number(record.recordType) === 1 ? '计划' : '已穿',
    sceneNames: tagNames(sceneOptions, record.sceneSnapshots || []),
    itemList: (record.itemList || []).map((item) => ({
      ...item,
      categoryName: item.categoryNameSnapshot || '未分类',
      itemStyleName: item.itemStyleNameSnapshot || ''
    }))
  }
}

module.exports = {
  COLOR_OPTIONS,
  SEASON_OPTIONS,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  getCategoryOptions,
  getItemStyleOptions,
  getColorOptions,
  getSceneOptions,
  getStyleOptions,
  today,
  currentMonth,
  optionText,
  optionIndex,
  normalizeStatus,
  splitTags,
  joinTags,
  toggleTag,
  tagNames,
  customTagNames,
  enhanceTagOptions,
  formatItem,
  formatOutfit,
  formatRecord
}
