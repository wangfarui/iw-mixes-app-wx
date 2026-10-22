# 衣柜 / 记账设置：方案 B 底部操作栏

2026-10-22，用户确认采用方案 B，并明确扩展至记账设置。本补充只针对本轮 UI 调整，不覆盖或改写前一轮完整业务验收状态。

## 改动

仅调整小程序两组独立的 `dictionary-management.wxml` / `dictionary-management.wxss`，覆盖衣柜 5 类和记账 4 类设置页。后端、Web、接口、权限和写入逻辑未改。

- 底栏在普通文档布局中占位，使用白色背景、顶部分隔线和安全区；移除悬浮定位与大块占位 spacer。
- 家庭管理视图两个按钮同排，个人视图新增按钮占满；按钮最小高度 44px。
- 顶部范围及说明保留，内容区域独立滚动，列表底边和操作栏顶边相接；最后一项可完整滚动出来。
- 只读、加载状态没有管理底栏时，列表末尾额外保留设备安全区。
- 排序隐藏底栏、取消内容区独立滚动，继续使用页面滚动和原有拖动自动滚动；未改排序 JS。

## 验证

`npm run test:bookkeeping-settings`、`npm run test:wardrobe-dictionary-context`、`npm run check:routes`（79 页）及 `git diff --check` 通过。

微信开发者工具在本地真实后端 / 原有登录态检查 9 页、17 个个人/家庭场景；[原始输出](evidence/settings-footer-native.log)全部通过。没有创建或修改业务数据：排序只移动后取消，新增/复制只开关弹层，没有保存。

| 检查 | 观察 |
|---|---|
| 17 个视图的边界 | 内容区底边 = 625px，操作栏顶边 = 625px，无交叠；375px 宽设备，安全区 34px |
| 家庭双按钮 | 上缘一致、左右分开、未换行 |
| 个人 / 会员类型 | 只有全宽新增按钮；会员类型仍仅个人 |
| 长列表末项 | 滚动到底后，最后行全部位于内容区内及底栏上方 |
| 排序 | 7 个含多项的家庭页面检查隐藏底栏、scrollY=false、上下移动及取消；未提交排序 |
| 操作弹层 | 9 页新增、8 页家庭复制均可打开/关闭 |
| 只读 | 正常登录成员账号验证衣柜与记账家庭视图，均无管理底栏，末行避开安全区；之后正常登录恢复原家长账号 |

一次早期检查将布尔 `scroll-y=false` 当作 HTML attribute 读取，SDK 返回 null，导致测试断言错误；改为读取控件公开 property `scrollY` 后确认 false，最终 17 场景完整重跑通过。当前证据保存完整成功日志。

截图：

- [衣柜家庭列表末尾](assets/settings-footer-wardrobe-category-FAMILY.png)
- [记账家庭列表末尾](assets/settings-footer-bookkeeping-category-FAMILY.png)
- [会员类型个人单按钮](assets/settings-footer-bookkeeping-membership-type-PERSONAL.png)
- [衣柜只读](assets/settings-footer-wardrobe-category-READONLY.png)
- [记账只读](assets/settings-footer-bookkeeping-category-READONLY.png)

本轮是原生模拟器验证，不以 HTML 原型作为运行证明。真实手机和不同屏宽的完整设备矩阵未执行；既有业务矩阵中的真机键盘、身份并发、外部 AI、生产迁移等缺口仍保留。未提交、推送或发布。
