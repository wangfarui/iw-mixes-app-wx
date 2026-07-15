const LOGIN_PAGE = '/pagesAuth/login/index'
let redirectingToLogin = false

function isOnLoginPage() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return currentPage && currentPage.route === 'pagesAuth/login/index'
}

function redirectToLogin() {
  if (redirectingToLogin || isOnLoginPage()) return

  redirectingToLogin = true

  setTimeout(() => {
    wx.reLaunch({
      url: LOGIN_PAGE,
      complete() {
        redirectingToLogin = false
      }
    })
  }, 0)
}

module.exports = {
  LOGIN_PAGE,
  redirectToLogin
}
