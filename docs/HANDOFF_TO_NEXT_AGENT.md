# HANDOFF_TO_NEXT_AGENT

更新时间：2026-06-26（第9轮云服务补全）
项目路径：`D:\WeChatProjects\miniprogram-1`

> 接班先读 PROJECT_SPEC.md 再读本文件。

## 当前状态
**代码层全部完成。云服务全链路可在本地验证。**

30 页面 + 11 services + 云函数 appStore（5 action）+ 细集合 + 乐观锁 + 本地模拟云存储。
45 JS 文件全量 node --check 零错误。30 页 × app.json 精确匹配。

## 第10轮修复（2026-06-26 界面与参数对比修复）

- 任务页首次进入空白已修复：`pages/tasks/index.js` 初始化 `viewMode: "list"`，看板模式下重新加载任务会同步重建 `kanbanColumns`。
- 参数库顶部按钮排版已修复：`pages/params/index.wxml/.wxss` 将 `模板 / 批量 / 对比` 统一为 `top-action-btn`。
- 参数对比设备选中态已增强：`pages/param-compare/index.js` 生成 `selected` 字段，WXML 用 `item.selected`，选中后有高亮和勾选。
- 参数对比模板表达式已简化：差异单元格由 `services/data-service.js` 输出 `val.isDiff`，WXML 不再写复杂 value/unit 比较表达式。
- 参数单位口径修复：`listParamDevices()` 不再硬编码 `CMH`，读取参数自身 `unit`；`getParamCompareData()` 差异判断同时比较 `value + unit`。
- mock 样例数据修正：`C26-0422-02` 表冷风量从 `38000 CMH` 改为与 `C26-0422-01` 一致的 `m3/h` 口径，并补齐中/后表冷参数。
- “我的”页云服务区域已改为最终版友好展示：普通用户只看到“数据同步”简洁状态；技术诊断、集合/文档/health 细节和重连/拉取/诊断/同步按钮仅 `mockPreviewEnabled` 或后台管理员可展开查看。
- 角色/部门/工序命名已统一：新增“部门管理员”角色；负责部门列表为 `项目部 / 电气设计部 / 结构设计部 / 电工房 / 结构班组 / 电气班组 / 采购部 / 仓库部 / 品质部 / 生产部`；张绍方为 `进度管理员｜制造部`；观察员归属为“总经办/销售/市场”；后台管理员样例用户显示为 `IT｜信息化`。
- 项目派单工序已统一：`机械采购/电气采购/采购部门` 规范为“采购物料”，`结构装配/电气装配` 规范为“结构总装/电气总装”，`品质跟进/工艺确认` 停用过滤。`data-service.js` 和 `import-service.js` 均保留旧名兼容映射。
- 已修复 `project-detail/index.wxml` 工序负责人坏模板，以及 `qb-create/index.wxml` 当前登录部门坏模板。
- 最新口径补充：张绍方显示为 `进度管理员｜制造部`；电气负责部门为“电气设计部”；工序“采购部门”已改为“采购物料”；“工艺确认”停用过滤；负责部门列表加入“品质部/生产部”。项目派单页面选择工序会自动带出默认负责部门，用户仍可手动修改。
- 参数库批量模式已修复按钮排版和设备选择框定位：批量按钮使用 `batch-action-btn`，设备卡片使用 `param-card/batch-card` 定位和左侧留白。

注意：`C26-0422-01 / C26-0422-02` 的 `SJD125-38000Z-H1` 仍是 mock 样例设备型号，未凭空修改。真实型号和真实参数后续必须从标准 Excel 或正式云数据导入确认。

## 第9轮新增（2026-06-26 云服务补全）

### 1. 消息通知全覆盖
之前只在 `assignDepartmentTask` / `transferQb` / `appendQbProgress` / `closeQb` 触发了通知。本轮新增：
- `createQb` → 通知 QB 负责人
- `createProjectDispatch` → 通知派单目标部门（每个工序一条通知）

现在 6 个写操作全部接入通知触发，覆盖了所有会产生"需要告知他人"的业务场景。

### 2. 微信订阅消息基础设施
- `notification-service.js`：新增 `requestSubscribeMessage()` / `sendTemplateMessage()` / `sendTaskAssignTemplate()`
- `cloudfunctions/appStore/index.js`：新增 `sendTemplateMsg` action（第 5 个 action）
- `pages/notifications`：新增"通知授权"按钮（调用 `wx.requestSubscribeMessage`）
- 模板 ID 配置位 `WX_TEMPLATE_IDS` 已预留，等 WeChat 后台申请后填入即可

### 3. 云存储接入验证
- 确认三页面（project-detail / progress-submit / qb-create）均已接入 `uploadFilesToCloud` + `getCloudFileTempUrl`
- attachment-service 三种模式（mock / cloud / cloud-error）均已覆盖
- 无需额外代码修改，TODO 中此项误标为未完成

## 三种运行模式

| 模式 | 条件 | transport | 说明 |
|------|------|-----------|------|
| local-mock | wx.cloud 不可用 | local-mock | wx.storage 模拟全链路 |
| function | 云函数已部署 | function | wx.cloud.callFunction |
| direct | fallback / transport="direct" | direct | 直接 wx.cloud.database |

## P0 操作清单（真实云上线）
1. 开通云开发 → envId → cloud-config.js
2. 创建 10 个集合
3. 部署云函数 appStore
4. 诊断 → 全绿
5. 在 WeChat 后台申请订阅消息模板 → 填入 WX_TEMPLATE_IDS
6. 同步 → 关闭重开 → 拉取 → 验证
7. 安全规则

## 不可破坏的约定
- 不重设计架构、不恢复原生 tabBar、页面不直读 mock
- Excel 不走机器猜表头
- getProject/getDevice 等值校验全覆盖
