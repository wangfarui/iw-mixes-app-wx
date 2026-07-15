const http = require('./request')

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
  return http.post('/eat-service/fridge/food/page', data)
}

function getFridgeFoodDetail(id) {
  return http.get('/eat-service/fridge/food/detail', { id })
}

function addFridgeFood(data) {
  return http.post('/eat-service/fridge/food/add', data)
}

function updateFridgeFood(data) {
  return http.put('/eat-service/fridge/food/update', data)
}

function markFridgeFoodAsUsed(id) {
  return http.put(`/eat-service/fridge/food/markAsUsed?id=${id}`)
}

function deleteFridgeFood(id) {
  return http.delete('/eat-service/fridge/food/delete', { id })
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
  deleteFridgeFood
}
