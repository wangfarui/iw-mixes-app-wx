# 从我的选项添加：勾选反馈修复

> 2026-10-20 归档说明：修复代码已包含在 `25a6cb2`。下文保留 10/19 的复现与验证记录；跨端验收后续进度见 [字典 v2 续验报告](../../../../iw-mixes-server/docs/acceptance/bookkeeping-dictionary-v2-20261019-r1019a/RESULTS-20261019-1715.md)，本次没有重新执行功能验收。

日期：2026-10-19。范围仅微信小程序记账设置共享管理页；未修改后端/Web、未提交 Git。

## 复现与原因

支出标签 → 家庭共用 → 从我的选项添加，选择“固定支出”。底部显示“添加所选（1）”，选项框仍未勾选。通过微信开发者工具的实际页面实例与渲染层查询得到：

```text
COPY_SELECTION_PROBE {"selected":1,"checked":0,"pass":false}
```

其中 selected 是页面 copySelectedIds 长度，checked 是 wx.createSelectorQuery().in(page).selectAll('.dm-checkbox.is-checked') 的实际渲染数量。复现探针调用真实 toggleCopyItem 事件处理器，再在 wx.nextTick 中查询，不提交业务写入。

原 WXML 在样式与勾号条件中调用 copySelectedIds.indexOf(item.id)，普通 WXML 表达式不能执行此数组方法。改为在 JS 中同步计算每项 selected 布尔值，与 copySelectedIds 同次 setData；模板只读取该布尔值。分类、支出标签、收入标签共用此修复。

## 验证

- 新增回归断言，修复前 `npm run test:bookkeeping-settings` 失败：`勾选后选项框展示必须与添加所选数量同步`。
- 修复后同一测试通过：单选、多选、取消一项、取消全部、数字/字符串 ID、已存在项不可选、关闭清空选择；并检查勾选 WXML 不再调用数组方法。
- `npm run check:routes`：72 页通过。
- 页面工厂、工具逻辑、测试脚本的 `node --check` 及 `git diff --check` 通过。
- 微信开发者工具自动热更新编译后，真实点击“固定支出”，显示绿色框及白色勾号，底部数量为 1；再次运行相同渲染查询：

```text
COPY_SELECTION_PROBE {"selected":1,"checked":1,"pass":true}
```

- 模拟器另检查多选到 2、取消一项回到 1、已存在项点击后数量不变、关闭后重开数量为 0。
- [修复截图](fixed-selection.png)：最后停留在“固定支出”已勾选状态，未点击“添加所选”，没有新增家庭选项。

本次只验收该 UI 缺陷；多角色接口及完整业务验收仍按用户安排在样式确认、提供账号后进行。开发工具中既有天气服务 502 等日志不属于本次验证范围。
