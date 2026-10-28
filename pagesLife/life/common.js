const api = require('../../api/life')
const session = require('../../stores/session')
const categories = [{ value: '', text: '全部' }, { value: 'WEBSITE', text: '网站' }, { value: 'ARTICLE', text: '文章' }, { value: 'VIDEO', text: '视频' }, { value: 'OTHER', text: '其他' }]
const dateTypes = [{ value: 'BIRTHDAY', text: '生日' }, { value: 'ANNIVERSARY', text: '纪念日' }, { value: 'EXPIRY', text: '到期事项' }, { value: 'OTHER', text: '其他' }]
const reminders = [{ value: null, text: '不提示' }, { value: 0, text: '当天' }, { value: 1, text: '提前1天' }, { value: 3, text: '提前3天' }, { value: 7, text: '提前7天' }, { value: 30, text: '提前30天' }]
const configs = {
  wish: { title: '心愿清单', label: '心愿', filter: 'PENDING', filters: [{ value: 'PENDING', text: '想实现' }, { value: 'FULFILLED', text: '已实现' }, { value: 'ARCHIVED', text: '已搁置' }], placeholder: '搜索心愿名称、备注' },
  date: { title: '重要日期', label: '日期', filter: 'UPCOMING', filters: [{ value: 'UPCOMING', text: '即将到来' }, { value: 'ALL', text: '全部' }], placeholder: '搜索生日、纪念日、到期事项' },
  bookmark: { title: '收藏夹', label: '收藏', filter: '', filters: categories, placeholder: '搜索名称、网址、备注' }
}
function requestId() { return 'life_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }
function formatRow(kind, row) {
  const item = { ...row, amountText: row.estimatedAmount == null ? '' : Number(row.estimatedAmount).toFixed(2) }
  if (kind === 'wish') item.priorityText = row.priority === 'HIGH' ? '优先实现' : '慢慢来'
  if (kind === 'bookmark') {
    item.categoryText = (categories.find(c => c.value === row.category) || categories[4]).text
    item.domain = (row.url || '').replace(/^https?:\/\//i, '').split(/[/?#]/)[0]
  }
  if (kind === 'date') {
    item.dayText = row.daysUntil == null ? '—' : Math.abs(row.daysUntil)
    item.dayLabel = row.daysUntil == null ? '超出范围' : row.daysUntil === 0 ? '今天' : row.daysUntil > 0 ? '天后' : '天前'
    item.repeatText = row.repeatType === 'YEARLY' ? '每年' : '一次性'
    item.remindText = (reminders.find(r => r.value === row.remindDays) || reminders[0]).text
    item.typeText = (dateTypes.find(t => t.value === row.dateType) || dateTypes[3]).text
  }
  return item
}
module.exports = { api, session, configs, categories, dateTypes, reminders, requestId, formatRow }
