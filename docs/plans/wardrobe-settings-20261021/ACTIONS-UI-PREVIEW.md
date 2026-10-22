# 操作区布局预览与方案 B 实施

2026-10-22。用户已明确选择“采用方案 B，顺带把记账设置的也优化一下”。已对衣柜与记账的独立共享模板落实该布局；下方保留最初的样式对比，原型本身不连接业务接口。实际界面和自验见 [方案 B 自验补充](../../acceptance/wardrobe-settings-20261022-dev/SETTINGS-FOOTER.md)。

- A（原预览推荐，未采用）：两个操作并排放到范围说明下面，位于列表上方。保留启用数量和排序；列表独立滚动，底部没有悬浮按钮。
- B（用户已选并实施）：两个操作并排放到白色底栏，底栏与列表在布局中各自占位；列表只滚动到操作栏上缘，底栏包含安全区。
- 当前示例为家庭管理者、11 个启用项和 2 个停用项。实际落地时，“我的”只显示新增；成员/儿童的家庭视图不显示管理操作；排序模式继续使用取消/完成，不并列新增按钮。

[对比图](assets/actions-layout-compare.png) · [滚动到底部](assets/actions-layout-bottom.png) · [预览 HTML](actions-ui-prototype.html)

运行（联合工作区根目录）：

```bash
python3 -m http.server 18766 --bind 127.0.0.1 --directory iw-mixes-app-wx/docs/plans/wardrobe-settings-20261021
```

访问 http://127.0.0.1:18766/actions-ui-prototype.html?variant=compare 。支持 A / B / compare，以及左右键切换。所有按钮只演示，不执行真实写入。

已通过浏览器检查两栏末尾滚动：A scrollTop=157、可视区412、内容569；B scrollTop=164、可视区405、内容569，均达到最大滚动位置。截图为 HTML 渲染效果，未作为原生小程序运行验证；实施后还需检查实际设备的滚动和安全区。
