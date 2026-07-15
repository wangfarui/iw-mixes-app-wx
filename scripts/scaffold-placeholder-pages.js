const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const appConfig = require(path.join(rootDir, 'app.json'))

const titles = new Map([
  ['pages/home/index', '首页'],
  ['pages/bill/index', '账单'],
  ['pages/menu', '菜单'],
  ['pages/task/index', '任务'],
  ['pages/my/my', '我的'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-quick', '记账'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-action', '表单记账'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-action-setting', '类别设置'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-action-edit', '编辑类别'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-records', '记账记录'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-detail', '记录详情'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-consume-statistics', '支出统计'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-income-statistics', '收入统计'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-budget', '预算'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-wallet', '钱包'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-membership-subscription', '会员订阅'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-yearly-statistics', '年度统计'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-yearly-overview-statistics', '年度总览统计'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-yearly-consume-statistics', '年度支出统计'],
  ['pagesBookkeeping/bookkeeping/bookkeeping-yearly-income-statistics', '年度收入统计'],
  ['pagesBase/base/dict-manage', '字典管理'],
  ['pagesBase/base/dict-detail', '字典详情'],
  ['pagesBase/base/account-manage', '账号管理'],
  ['pagesBase/base/account-detail', '账号详情'],
  ['pagesBase/my/profile', '个人信息'],
  ['pagesBase/my/security', '账号安全'],
  ['pagesBase/my/settings', '系统设置'],
  ['pagesBase/my/about', '关于我们'],
  ['pagesBase/my/feedback', '意见反馈'],
  ['pagesBase/family/index', '家庭组'],
  ['pagesBase/family/create', '创建家庭组'],
  ['pagesBase/family/join', '加入家庭组'],
  ['pagesBase/family/detail', '家庭组'],
  ['pagesBase/family/invite', '邀请成员'],
  ['pagesBase/family/manage', '管理家庭组'],
  ['pagesBase/family/edit', '编辑家庭组'],
  ['pagesBase/family/inviteList', '邀请记录'],
  ['pagesBase/family/transfer', '转让群主'],
  ['pagesEat/eat/recipe/index', '食谱'],
  ['pagesEat/eat/dishes/index', '点餐'],
  ['pagesEat/eat/dishes/dishes-detail', '菜品详情'],
  ['pagesEat/eat/dishes/dishes-form', '菜品添加'],
  ['pagesEat/eat/dishes/cart-confirm', '确认订单'],
  ['pagesEat/eat/meal/index', '用餐记录'],
  ['pagesEat/eat/meal/meal-detail', '用餐详情'],
  ['pagesEat/eat/fridge/index', '冰箱'],
  ['pagesEat/eat/fridge/detail', '食材详情'],
  ['pagesPoints/points/points-action', '新增积分'],
  ['pagesPoints/points/points-records', '积分记录'],
  ['pagesPoints/points/points-statistics', '积分分析'],
  ['pagesPoints/points/points-detail', '记录详情'],
  ['pagesPoints/points/task-plan', '任务计划'],
  ['pagesPoints/points/task-plan-add', '编辑任务计划'],
  ['pagesPoints/points/task-list', '常用任务'],
  ['pagesPoints/task/task-edit-detail', '任务详情'],
  ['pagesAuth/login/index', '登录']
])

const pageOptions = new Map([
  ['pages/home/index', { enablePullDownRefresh: true }],
  ['pages/bill/index', { enablePullDownRefresh: true }],
  ['pagesBookkeeping/bookkeeping/bookkeeping-records', { enablePullDownRefresh: true }],
  ['pagesBase/base/dict-manage', { enablePullDownRefresh: true }],
  ['pagesBase/base/account-manage', { enablePullDownRefresh: true }],
  ['pagesEat/eat/meal/index', { enablePullDownRefresh: true }],
  ['pagesPoints/points/points-records', { enablePullDownRefresh: true }],
  ['pagesPoints/points/task-plan', { enablePullDownRefresh: true }],
  ['pagesPoints/points/task-list', { enablePullDownRefresh: true }]
])

function collectPages() {
  const pages = [...(appConfig.pages || [])]
  for (const subPackage of appConfig.subPackages || []) {
    for (const page of subPackage.pages || []) {
      pages.push(`${subPackage.root}/${page}`)
    }
  }
  return pages
}

function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  return true
}

function createPage(pagePath) {
  const absoluteBase = path.join(rootDir, pagePath)
  const title = titles.get(pagePath) || '迁移中'
  const pageConfig = {
    navigationBarTitleText: title,
    ...(pageOptions.get(pagePath) || {})
  }

  const files = [
    {
      path: `${absoluteBase}.json`,
      content: `${JSON.stringify(pageConfig, null, 2)}\n`
    },
    {
      path: `${absoluteBase}.wxml`,
      content: `<view class="placeholder-page">
  <view class="placeholder-card">
    <view class="placeholder-title">{{title}}</view>
    <view class="placeholder-path">{{path}}</view>
    <view class="placeholder-desc">该页面正在迁移为原生微信小程序页面。</view>
    <view class="placeholder-actions">
      <button class="weui-btn weui-btn_primary" bindtap="goHome">返回首页</button>
    </view>
  </view>
</view>
`
    },
    {
      path: `${absoluteBase}.js`,
      content: `Page({
  data: {
    title: ${JSON.stringify(title)},
    path: ${JSON.stringify(pagePath)}
  },

  goHome() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  }
})
`
    },
    {
      path: `${absoluteBase}.wxss`,
      content: `/* 页面业务迁移完成后替换本占位样式。 */
`
    }
  ]

  return files.reduce((count, file) => count + (writeFileIfMissing(file.path, file.content) ? 1 : 0), 0)
}

let createdCount = 0
for (const page of collectPages()) {
  createdCount += createPage(page)
}

console.log(`placeholder files created: ${createdCount}`)
