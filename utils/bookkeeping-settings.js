// 记账设置共享纯逻辑：名称规范化/校验、复制派生状态、排序纯计算。
// 不依赖页面实例与 wx API，可在 Node 行为测试中直接运行。

// 与服务端保持一致的 Unicode 首尾空白定义（trim 语义），只去首尾，不改内部空白/大小写/重音。
const EDGE_SPACE = /^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu
const MAX_NAME_LENGTH = 32

function nameValue(value) {
  return String(value == null ? '' : value).replace(EDGE_SPACE, '')
}

function nameLength(value) {
  return Array.from(nameValue(value)).length
}

// 就地校验草稿名称；items 为当前范围全量列表（含停用项），excludeId 用于改名排除自己。
// 返回 { name, count, error, canSave }；error 为空字符串表示通过。
function validateName(draft, items, excludeId) {
  const name = nameValue(draft)
  const count = Array.from(name).length
  let error = ''
  if (!name) error = '请输入名称'
  else if (count > MAX_NAME_LENGTH) error = `名称不能超过${MAX_NAME_LENGTH}个字符`
  else if ((items || []).some((item) => Number(item.id) !== Number(excludeId || 0) && nameValue(item.name) === name)) error = '已存在同名选项'
  return { name, count, error, canSave: !error }
}

// 家庭复制候选派生：与当前家庭范围已有项（含停用）按规范化名称判重；个人停用项保留来源状态。
function deriveCopyItems(personalItems, familyItems) {
  const familyNames = new Set((familyItems || []).map((item) => nameValue(item.name)))
  return (personalItems || []).map((item) => ({
    id: item.id,
    name: item.name,
    enabled: Boolean(item.enabled),
    selected: false,
    exists: familyNames.has(nameValue(item.name))
  }))
}

// 排序重排纯计算：把 fromIndex 的项移动到 toIndex（同数组内移动语义），返回新数组。
function reorder(list, fromIndex, toIndex) {
  const next = (list || []).slice()
  if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex >= next.length || fromIndex === toIndex) return next
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

// 按手指坐标与各行矩形（同一坐标系）计算应插入的索引：越过相邻行中心线才更新。
// rects: [{top, height}] 按当前顺序排列；返回 -1 表示保持原位。
function dragTargetIndex(rects, currentIndex, pointerY) {
  if (!rects || !rects.length) return -1
  let target = -1
  for (let index = 0; index < rects.length; index += 1) {
    if (index === currentIndex) continue
    const center = rects[index].top + rects[index].height / 2
    if (index < currentIndex && pointerY < center) { target = index; break }
    if (index > currentIndex && pointerY > center) target = index
  }
  return target
}

module.exports = { nameValue, nameLength, validateName, deriveCopyItems, reorder, dragTargetIndex, MAX_NAME_LENGTH }
