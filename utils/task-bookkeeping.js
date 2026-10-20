const bookkeeping = require('./bookkeeping')

function parseTemplate(template) {
  if (typeof template !== 'string') return template || null
  try { return JSON.parse(template) } catch (error) { return null }
}

// Only business fields travel back from the shared form. IDs, dates and server
// family context are deliberately excluded.
function templateFields(form) {
  form = parseTemplate(form) || {}
  return {
    recordCategory: Number(form.recordCategory),
    recordSource: form.recordSource || '',
    amount: Number(form.amount),
    recordTypeId: form.recordTypeId == null ? null : Number(form.recordTypeId),
    recordIcon: form.recordIcon || '',
    recordTags: bookkeeping.normalizeTagIds(form.recordTags),
    remark: form.remark || '',
    isStatistics: Number(form.isStatistics) === 0 ? 0 : 1,
    isExcitationRecord: Number(form.recordCategory) === 2 && Number(form.isExcitationRecord) === 1 ? 1 : 0,
    shared: Number(form.shared) === 1 ? 1 : 0
  }
}

function templateSummary(template) {
  template = parseTemplate(template)
  if (!template) return ''
  return `${Number(template.recordCategory) === 2 ? '收入' : '支出'} · ${template.recordSource || '未填写项目'} · ¥${bookkeeping.formatMoney(template.amount)}`
}

function taskState(task) {
  const summary = task.bookkeeping || task.bookkeepingSummary || task
  let template = task.bookkeepingTemplate || summary.templateSnapshot || summary.bookkeepingTemplate
  template = parseTemplate(template)
  const recordId = task.bookkeepingRecordId || summary.bookkeepingRecordId
  const status = task.bookkeepingStatus || summary.status || summary.bookkeepingStatus || (recordId ? 'RECORDED' : template ? 'PENDING' : 'NONE')
  const availability = task.bookkeepingRecordAvailability || summary.recordAvailability || summary.bookkeepingRecordAvailability
  const category = summary.bookkeepingRecordCategory || summary.recordCategory || (template && template.recordCategory)
  const source = summary.bookkeepingRecordSource || (template && template.recordSource) || '未填写项目'
  const amount = summary.amount == null ? summary.bookkeepingAmount == null ? template && template.amount : summary.bookkeepingAmount : summary.amount
  return {
    status,
    recordId,
    template,
    availability,
    canEdit: status === 'PENDING' && Number(task.taskStatus) === 0,
    canView: Boolean(recordId) && availability !== 'DELETED' && availability !== 'INACCESSIBLE',
    label: status === 'RECORDED' ? '已关联账单' : status === 'PENDING' ? `${source} · ${Number(category) === 2 ? '收入' : '支出'} ¥${bookkeeping.formatMoney(amount)}` : '',
    templateSummary: templateSummary(template)
  }
}

function completionMessage(result, fallback) {
  if (result && result.bookkeepingAction === 'CREATED') return `已完成，已记账 ¥${bookkeeping.formatMoney(result.recordedAmount)}`
  if (result && result.bookkeepingAction === 'KEPT') return '已完成，关联账单保留'
  return fallback || '已完成'
}

module.exports = { parseTemplate, templateFields, templateSummary, taskState, completionMessage }
