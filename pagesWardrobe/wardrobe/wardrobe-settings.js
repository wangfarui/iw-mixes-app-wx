Page({
  data: { items: [
    {name:'衣物品类',desc:'整理衣物分类与搭配归类',path:'category'},
    {name:'衣物款式',desc:'按品类管理衣物款式',path:'item-style'},
    {name:'衣物颜色',desc:'管理常用颜色名称',path:'color'},
    {name:'使用场景',desc:'管理通勤、运动等场景',path:'scene'},
    {name:'穿搭风格',desc:'管理简约、休闲等风格',path:'style'}
  ] },
  open(event) { wx.navigateTo({url: `/pagesWardrobe/wardrobe/wardrobe-${event.currentTarget.dataset.path}-settings`}) }
})
