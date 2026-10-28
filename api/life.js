const http = require('./request')
const routes = { wish: 'wish', date: 'important-date', bookmark: 'bookmark' }
function base(kind) { if (!routes[kind]) throw new Error('未知生活工具'); return '/auth-service/life/' + routes[kind] }
module.exports = {
  page: (kind, query) => http.post(base(kind) + '/page', query),
  detail: (kind, id) => http.get(base(kind) + '/detail', { id }),
  add: (kind, data) => http.post(base(kind) + '/add', data),
  update: (kind, data) => http.put(base(kind) + '/update', data),
  remove: (kind, id, revision) => http.delete(base(kind) + '/delete', { id, revision }),
  changeStatus: data => http.put(base('wish') + '/change-status', data),
  setPinned: data => http.put(base('bookmark') + '/set-pinned', data),
  reminders: () => http.get(base('date') + '/reminder-summary'),
  calendar: year => http.get(base('date') + '/calendar', { year })
}
