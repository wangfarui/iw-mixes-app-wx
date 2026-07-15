const iconCategories = [
  {
    dir: 'icon/yinshi',
    name: '饮食',
    files: ['lingshi', 'chifan', 'huoguo', 'naicha', 'canyin', 'yanjiu', 'mifan', 'dangao']
  },
  {
    dir: 'icon/gouwu',
    name: '购物',
    files: ['gouwu', 'shoushi', 'gouwuche', 'xiezi', 'xiangji', 'erhuan', 'liwu', 'fushi', 'shucai', 'shuiguo']
  },
  {
    dir: 'icon/shenghuo',
    name: '生活',
    files: ['tongxun', 'yaowan', 'chongwu', 'yiliao', 'tingchechang', 'dazhen', 'yanjing', 'baihuo', 'meifa', 'weixiu', 'kuaidi_']
  },
  {
    dir: 'icon/jiaotong',
    name: '交通',
    files: ['huoche', 'qiche', 'jiudian', 'jiaotong']
  },
  {
    dir: 'icon/yule',
    name: '娱乐',
    files: ['shuma', 'feiji', 'youxi', 'yule', 'liwu', 'shuji']
  },
  {
    dir: 'icon/bangong',
    name: '办公',
    files: ['bangong', 'computer']
  },
  {
    dir: 'icon/jiating',
    name: '家庭',
    files: ['chongwu', 'liwu', 'jujia', 'zhufang']
  },
  {
    dir: 'icon/shouru',
    name: '收入',
    files: ['gongzi', 'chongzhi', 'lijin', 'licai', 'juanzeng', 'gupiao', 'qianbao', 'jianzhi']
  },
  {
    dir: 'icon/qita',
    name: '其他',
    files: ['shezhi', 'xuexi-']
  }
]

function normalizeIcon(icon) {
  if (!icon) return '/icon/amount'
  if (icon.startsWith('/')) return icon
  return `/${icon.replace(/\.svg$/, '')}`
}

function getIconUrl(icon) {
  return `/static/bookkeeping${normalizeIcon(icon)}.svg`
}

function getIconList(selectedIcon = '') {
  const normalizedSelected = normalizeIcon(selectedIcon)
  return iconCategories.map((category) => ({
    category: category.name,
    icons: category.files.map((file) => {
      const recordIcon = `/${category.dir}/${file}`
      return {
        path: getIconUrl(recordIcon),
        recordIcon,
        selected: recordIcon === normalizedSelected
      }
    })
  }))
}

module.exports = {
  getIconUrl,
  getIconList
}
