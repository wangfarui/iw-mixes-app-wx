const dictStore = require('../../stores/dict')

const CATEGORY_OPTIONS = [
  { value: 1, text: '上装' },
  { value: 2, text: '下装' },
  { value: 3, text: '连衣裙' },
  { value: 4, text: '内衣' },
  { value: 5, text: '袜子' },
  { value: 6, text: '鞋履' },
  { value: 7, text: '配饰' },
  { value: 8, text: '帽子' },
  { value: 9, text: '包袋' },
  { value: 10, text: '首饰' },
  { value: 11, text: '其他' }
]

const ITEM_STYLE_OPTIONS = [
  { value: 101, text: 'T恤', parentCode: 1 }, { value: 102, text: '衬衫', parentCode: 1 }, { value: 103, text: 'Polo衫', parentCode: 1 },
  { value: 104, text: '卫衣', parentCode: 1 }, { value: 105, text: '毛衣', parentCode: 1 }, { value: 106, text: '针织衫', parentCode: 1 },
  { value: 107, text: '打底衫', parentCode: 1 }, { value: 108, text: '背心', parentCode: 1 }, { value: 109, text: '吊带', parentCode: 1 },
  { value: 110, text: '抹胸', parentCode: 1 }, { value: 111, text: '雪纺衫', parentCode: 1 }, { value: 112, text: '马甲', parentCode: 1 },
  { value: 113, text: '开衫', parentCode: 1 }, { value: 114, text: '防晒衣', parentCode: 1 }, { value: 115, text: '其他上装', parentCode: 1 },
  { value: 201, text: '牛仔裤', parentCode: 2 }, { value: 202, text: '休闲裤', parentCode: 2 }, { value: 203, text: '西裤', parentCode: 2 },
  { value: 204, text: '运动裤', parentCode: 2 }, { value: 205, text: '工装裤', parentCode: 2 }, { value: 206, text: '阔腿裤', parentCode: 2 },
  { value: 207, text: '短裤', parentCode: 2 }, { value: 208, text: '半身裙', parentCode: 2 }, { value: 209, text: '短裙', parentCode: 2 },
  { value: 210, text: '长裙', parentCode: 2 }, { value: 211, text: '打底裤', parentCode: 2 }, { value: 212, text: '瑜伽裤', parentCode: 2 },
  { value: 213, text: '背带裤', parentCode: 2 }, { value: 214, text: '其他下装', parentCode: 2 },
  { value: 301, text: '连衣裙', parentCode: 3 }, { value: 302, text: '衬衫裙', parentCode: 3 }, { value: 303, text: '针织裙', parentCode: 3 },
  { value: 304, text: '吊带裙', parentCode: 3 }, { value: 305, text: '背心裙', parentCode: 3 }, { value: 306, text: '背带裙', parentCode: 3 },
  { value: 307, text: '礼服裙', parentCode: 3 }, { value: 308, text: '旗袍', parentCode: 3 }, { value: 309, text: '连体裤', parentCode: 3 },
  { value: 310, text: '套装裙', parentCode: 3 }, { value: 311, text: '其他连衣裙', parentCode: 3 },
  { value: 401, text: '文胸', parentCode: 4 }, { value: 402, text: '内裤', parentCode: 4 }, { value: 403, text: '保暖内衣', parentCode: 4 },
  { value: 404, text: '睡衣', parentCode: 4 }, { value: 405, text: '家居服', parentCode: 4 }, { value: 406, text: '塑身衣', parentCode: 4 },
  { value: 407, text: '打底背心', parentCode: 4 }, { value: 408, text: '抹胸内衣', parentCode: 4 }, { value: 409, text: '泳衣', parentCode: 4 },
  { value: 410, text: '其他内衣', parentCode: 4 },
  { value: 501, text: '短袜', parentCode: 5 }, { value: 502, text: '中筒袜', parentCode: 5 }, { value: 503, text: '长筒袜', parentCode: 5 },
  { value: 504, text: '船袜', parentCode: 5 }, { value: 505, text: '隐形袜', parentCode: 5 }, { value: 506, text: '堆堆袜', parentCode: 5 },
  { value: 507, text: '连裤袜', parentCode: 5 }, { value: 508, text: '打底袜', parentCode: 5 }, { value: 509, text: '运动袜', parentCode: 5 },
  { value: 510, text: '保暖袜', parentCode: 5 }, { value: 511, text: '其他袜子', parentCode: 5 },
  { value: 601, text: '运动鞋', parentCode: 6 }, { value: 602, text: '休闲鞋', parentCode: 6 }, { value: 603, text: '板鞋', parentCode: 6 },
  { value: 604, text: '帆布鞋', parentCode: 6 }, { value: 605, text: '皮鞋', parentCode: 6 }, { value: 606, text: '乐福鞋', parentCode: 6 },
  { value: 607, text: '靴子', parentCode: 6 }, { value: 608, text: '短靴', parentCode: 6 }, { value: 609, text: '长靴', parentCode: 6 },
  { value: 610, text: '凉鞋', parentCode: 6 }, { value: 611, text: '拖鞋', parentCode: 6 }, { value: 612, text: '高跟鞋', parentCode: 6 },
  { value: 613, text: '雨鞋', parentCode: 6 }, { value: 614, text: '其他鞋履', parentCode: 6 },
  { value: 701, text: '围巾', parentCode: 7 }, { value: 702, text: '披肩', parentCode: 7 }, { value: 703, text: '腰带', parentCode: 7 },
  { value: 704, text: '手套', parentCode: 7 }, { value: 705, text: '领带', parentCode: 7 }, { value: 706, text: '领结', parentCode: 7 },
  { value: 707, text: '丝巾', parentCode: 7 }, { value: 708, text: '发饰', parentCode: 7 }, { value: 709, text: '眼镜', parentCode: 7 },
  { value: 710, text: '墨镜', parentCode: 7 }, { value: 711, text: '口罩', parentCode: 7 }, { value: 712, text: '其他配饰', parentCode: 7 },
  { value: 801, text: '棒球帽', parentCode: 8 }, { value: 802, text: '渔夫帽', parentCode: 8 }, { value: 803, text: '贝雷帽', parentCode: 8 },
  { value: 804, text: '毛线帽', parentCode: 8 }, { value: 805, text: '鸭舌帽', parentCode: 8 }, { value: 806, text: '遮阳帽', parentCode: 8 },
  { value: 807, text: '礼帽', parentCode: 8 }, { value: 808, text: '草帽', parentCode: 8 }, { value: 809, text: '空顶帽', parentCode: 8 },
  { value: 810, text: '其他帽子', parentCode: 8 },
  { value: 901, text: '双肩包', parentCode: 9 }, { value: 902, text: '托特包', parentCode: 9 }, { value: 903, text: '斜挎包', parentCode: 9 },
  { value: 904, text: '单肩包', parentCode: 9 }, { value: 905, text: '手提包', parentCode: 9 }, { value: 906, text: '腰包', parentCode: 9 },
  { value: 907, text: '胸包', parentCode: 9 }, { value: 908, text: '钱包', parentCode: 9 }, { value: 909, text: '卡包', parentCode: 9 },
  { value: 910, text: '化妆包', parentCode: 9 }, { value: 911, text: '旅行包', parentCode: 9 }, { value: 912, text: '其他包袋', parentCode: 9 },
  { value: 1001, text: '项链', parentCode: 10 }, { value: 1002, text: '耳钉', parentCode: 10 }, { value: 1003, text: '耳环', parentCode: 10 },
  { value: 1004, text: '戒指', parentCode: 10 }, { value: 1005, text: '手链', parentCode: 10 }, { value: 1006, text: '手镯', parentCode: 10 },
  { value: 1007, text: '胸针', parentCode: 10 }, { value: 1008, text: '脚链', parentCode: 10 }, { value: 1009, text: '手表', parentCode: 10 },
  { value: 1010, text: '其他首饰', parentCode: 10 },
  { value: 1101, text: '其他款式', parentCode: 11 }, { value: 1102, text: '待分类', parentCode: 11 }
]

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

const SCENE_OPTIONS = [
  { value: 1, text: '日常' },
  { value: 2, text: '通勤' },
  { value: 3, text: '约会' },
  { value: 4, text: '运动' },
  { value: 5, text: '旅行' },
  { value: 6, text: '正式' },
  { value: 7, text: '居家' },
  { value: 8, text: '户外' },
  { value: 9, text: '聚会' }
]

const STYLE_OPTIONS = [
  { value: 1, text: '休闲' },
  { value: 2, text: '简约' },
  { value: 3, text: '利落' },
  { value: 4, text: '甜美' },
  { value: 5, text: '街头' },
  { value: 6, text: '复古' },
  { value: 7, text: '户外' },
  { value: 8, text: '运动' },
  { value: 9, text: '通勤' },
  { value: 10, text: '优雅' },
  { value: 11, text: '中性' },
  { value: 12, text: '学院' },
  { value: 13, text: '度假' }
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

const WEAR_STATE_OPTIONS = [
  { value: '', text: '全部穿着' },
  { value: 1, text: '未穿过' },
  { value: 2, text: '最近穿过' },
  { value: 3, text: '最少穿' }
]

const COLOR_HEX_MAP = COLOR_OPTIONS.reduce((map, option) => {
  map[option.value] = option.hex
  return map
}, {})

function dictCodeOptions(dictType, fallback) {
  const list = dictStore.getDictDataArray(dictType)
  if (!list.length) return fallback.slice()
  return list
    .filter((item) => item && item.dictCode !== undefined && item.dictCode !== null && item.dictName)
    .map((item) => ({
      id: item.id,
      parentId: item.parentId || 0,
      value: item.dictCode,
      text: item.dictName
    }))
}

function getCategoryOptions() {
  return dictCodeOptions(dictStore.dictTypeEnum.WARDROBE_ITEM_CATEGORY, CATEGORY_OPTIONS)
}

function getItemStyleOptions(category) {
  const options = dictCodeOptions(dictStore.dictTypeEnum.WARDROBE_ITEM_SUBCATEGORY, ITEM_STYLE_OPTIONS)
  if (!category) return options
  const categoryOption = getCategoryOptions().find((option) => String(option.value) === String(category))
  const parentId = categoryOption && categoryOption.id
  return options.filter((option) => {
    if (option.parentId) return parentId && String(option.parentId) === String(parentId)
    return String(option.parentCode) === String(category)
  })
}

function getColorOptions() {
  const list = dictStore.getDictDataArray(dictStore.dictTypeEnum.WARDROBE_ITEM_COLOR)
  if (!list.length) return COLOR_OPTIONS.slice()
  return list
    .filter((item) => item && item.dictName)
    .map((item) => ({
      value: item.dictName,
      text: item.dictName,
      hex: COLOR_HEX_MAP[item.dictName] || ''
    }))
}

function getSceneOptions() {
  return dictCodeOptions(dictStore.dictTypeEnum.WARDROBE_ITEM_SCENE, SCENE_OPTIONS)
}

function getStyleOptions() {
  return dictCodeOptions(dictStore.dictTypeEnum.WARDROBE_ITEM_STYLE, STYLE_OPTIONS)
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
  const index = options.findIndex((option) => String(option.value) === String(value))
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
    categoryName: optionText(categoryOptions, item.category, '未分类'),
    itemStyleName: optionText(itemStyleOptions, item.itemStyle, ''),
    statusName: optionText(STATUS_OPTIONS, normalizeStatus(item.status), '在穿'),
    seasonNames: tagNames(SEASON_OPTIONS, item.seasonTags),
    sceneNames: tagNames(sceneOptions, item.sceneTags),
    styleNames: tagNames(styleOptions, item.styleTags),
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
    sceneNames: tagNames(sceneOptions, outfit.sceneTags),
    styleNames: tagNames(styleOptions, outfit.styleTags),
    customTagNames: customTagNames(outfit.customTags),
    itemList: (outfit.itemList || []).map((item) => ({
      ...item,
      categoryName: optionText(categoryOptions, item.category, '未分类'),
      itemStyleName: optionText(getItemStyleOptions(item.category), item.itemStyle, '')
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
    sceneNames: tagNames(sceneOptions, record.sceneTags),
    itemList: (record.itemList || []).map((item) => ({
      ...item,
      categoryName: optionText(categoryOptions, item.category, '未分类'),
      itemStyleName: optionText(getItemStyleOptions(item.category), item.itemStyle, '')
    }))
  }
}

module.exports = {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  SEASON_OPTIONS,
  SCENE_OPTIONS,
  STYLE_OPTIONS,
  ITEM_STYLE_OPTIONS,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  WEAR_STATE_OPTIONS,
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
