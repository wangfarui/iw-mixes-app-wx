const http = require('./request')

function addPointsRecord(data) {
  return http.post('/points-service/points/records/add', data)
}

function getPointsRecordDetail(id) {
  return http.get('/points-service/points/records/detail', { id })
}

function deletePointsRecord(id) {
  return http.delete('/points-service/points/records/delete', { id })
}

function getPointsRecordPage(data) {
  return http.post('/points-service/points/records/page', data)
}

function getPointsRecordStatistics(data) {
  return http.post('/points-service/points/records/statistics', data)
}

function getPointsBalance() {
  return http.get('/points-service/points/total/getPointsBalance')
}

function getTaskPlanPage(data) {
  return http.post('/points-service/points/task/plan/page', data)
}

function getTaskPlanDetail(id) {
  return http.get('/points-service/points/task/plan/detail', { id })
}

function addTaskPlan(data) {
  return http.post('/points-service/points/task/plan/add', data)
}

function updateTaskPlan(data) {
  return http.put('/points-service/points/task/plan/update', data)
}

function updateTaskPlanStatus(data) {
  return http.put('/points-service/points/task/plan/updateStatus', data)
}

function deleteTaskPlan(id) {
  return http.delete('/points-service/points/task/plan/delete', { id })
}

function getFixedTaskList() {
  return http.get('/points-service/points/task/fixed/list')
}

function addFixedTask(data) {
  return http.post('/points-service/points/task/fixed/add', data)
}

function updateFixedTask(data) {
  return http.put('/points-service/points/task/fixed/update', data)
}

function deleteFixedTask(id) {
  return http.delete('/points-service/points/task/fixed/delete', { id })
}

function submitFixedTask(id) {
  return http.get('/points-service/points/task/fixed/submit', { id })
}

function getTaskBasicsDetail(id) {
  return http.get('/points-service/points/task/basics/detail', { id })
}

function updateTaskParam(data) {
  return http.put('/points-service/points/task/basics/updateTaskParam', data)
}

module.exports = {
  addPointsRecord,
  getPointsRecordDetail,
  deletePointsRecord,
  getPointsRecordPage,
  getPointsRecordStatistics,
  getPointsBalance,
  getTaskPlanPage,
  getTaskPlanDetail,
  addTaskPlan,
  updateTaskPlan,
  updateTaskPlanStatus,
  deleteTaskPlan,
  getFixedTaskList,
  addFixedTask,
  updateFixedTask,
  deleteFixedTask,
  submitFixedTask,
  getTaskBasicsDetail,
  updateTaskParam
}
