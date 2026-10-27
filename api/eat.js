const http = require('./request')
const kitchenHeader = { 'X-IW-Kitchen-Contract': '1' }

function fridgeRequest(path, method, data) {
  const query = method === 'GET' || method === 'DELETE'
  return http.request(
    query ? http.appendQuery(`/eat-service/fridge/food${path}`, data) : `/eat-service/fridge/food${path}`,
    method,
    query ? {} : data,
    { header: kitchenHeader }
  )
}

function getDishesPage(data) {
  return http.post('/eat-service/eat/dishes/page', data)
}

function getDishesDetail(id) {
  return http.get('/eat-service/eat/dishes/detail', { id })
}

function addDishes(data) {
  return http.post('/eat-service/eat/dishes/add', data)
}

function updateDishes(data) {
  return http.put('/eat-service/eat/dishes/update', data)
}

function deleteDishes(id) {
  return http.delete('/eat-service/eat/dishes/delete', { id })
}

function getMealPage(data) {
  return http.post('/eat-service/eat/meal/page', data)
}

function getMealDetail(id) {
  return http.get('/eat-service/eat/meal/detail', { id })
}

function getMealMaterialDetail(id) {
  return http.get('/eat-service/eat/meal/dishes/materialDetail', { id })
}

function addMeal(data) {
  return http.post('/eat-service/eat/meal/add', data)
}

function deleteMeal(id) {
  return http.delete('/eat-service/eat/meal/delete', { id })
}

function getFridgeFoodPage(data) {
  return fridgeRequest('/page', 'POST', data)
}

function getFridgeFoodDetail(id) {
  return fridgeRequest('/detail', 'GET', { id })
}

function addFridgeFood(data) {
  return fridgeRequest('/add', 'POST', data)
}

function updateFridgeFood(data) {
  return fridgeRequest('/update', 'PUT', data)
}

function markFridgeFoodAsUsed(id) {
  return http.request(`/eat-service/fridge/food/markAsUsed?id=${encodeURIComponent(id)}`, 'PUT', {}, { header: kitchenHeader })
}

function deleteFridgeFood(id) {
  return fridgeRequest('/delete', 'DELETE', { id })
}

function getFridgeFoodOptions(params) {
  return fridgeRequest('/options', 'GET', params)
}

function getFridgeFoodFilters(params) {
  return fridgeRequest('/filters', 'GET', params)
}

module.exports = {
  getDishesPage,
  getDishesDetail,
  addDishes,
  updateDishes,
  deleteDishes,
  getMealPage,
  getMealDetail,
  getMealMaterialDetail,
  addMeal,
  deleteMeal,
  getFridgeFoodPage,
  getFridgeFoodDetail,
  addFridgeFood,
  updateFridgeFood,
  markFridgeFoodAsUsed,
  deleteFridgeFood,
  getFridgeFoodOptions,
  getFridgeFoodFilters
}
