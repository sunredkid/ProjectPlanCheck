# TODO

更新时间：2026-06-26（第9轮 — 云服务补全：通知全覆盖 + 订阅消息基础设施）

---

## 第10轮修复记录（2026-06-26）

- [x] 修复任务页首次进入空白：`pages/tasks/index.js` 初始化 `viewMode: "list"`，并在看板模式下加载任务后同步重建看板列。
- [x] 修复参数库顶部按钮排版：`模板 / 批量 / 对比` 统一为同一按钮样式和稳定尺寸。
- [x] 强化参数对比设备选中态：页面 JS 生成 `selected` 字段，WXML 不再直接调用 `indexOf()`，选中设备增加勾选和高亮。
- [x] 修复参数对比样例数据口径混乱：`C26-0422-02` 表冷风量统一为 `m3/h` 口径，并补齐中/后表冷字段。
- [x] 修复参数库列表风量单位硬编码：`listParamDevices()` 改为读取参数自身单位，不再固定拼 `CMH`。
- [x] 修复参数对比差异判断：差异比较同时包含 `value + unit`，并由 service 输出 `val.isDiff`，WXML 只读字段，降低模板编译风险。
- [x] 调整“我的”页云服务区域：正式用户界面改为简洁“数据同步”状态卡；运维诊断字段和重连/拉取/诊断/同步按钮仅管理员或开发预览可展开查看。
- [x] 统一角色命名：新增“部门管理员”角色预览和权限识别；“最高级管理员/超级管理员”用户可见名统一为“后台管理员”；后台管理员样例用户显示为 `IT｜信息化`。
- [x] 统一组织/负责部门：负责部门列表改为 `项目部 / 电气设计部 / 结构设计部 / 电工房 / 结构班组 / 电气班组 / 采购部 / 仓库部 / 品质部 / 生产部`；张绍方为 `进度管理员｜制造部`；观察员归属为“总经办/销售/市场”。
- [x] 统一项目派单工序：`机械采购/电气采购/采购部门` 合并为“采购物料”，`结构装配/电气装配` 改为“结构总装/电气总装”，去掉“品质跟进/工艺确认”；service 和 Excel 导入入口均加旧名规范化。
- [x] 按最新口径二次校正：张绍方改为 `进度管理员｜制造部`；电气负责部门改为“电气设计部”；工序“采购部门”改为“采购物料”；删除“工艺确认”；负责部门补充“品质部/生产部”；项目派单按工序自动带默认负责部门。
- [x] 修复参数库批量模式排版：批量操作按钮改专用样式，设备卡片增加批量态左侧避让，选择框固定在卡片内。
- [x] 修复项目详情工序行和 QB 创建页中的坏模板乱码：`{p.owner}}` / `{currentUser.department}}` 已恢复为正常数据绑定。

### 待真实数据确认

- [ ] `C26-0422-01 / C26-0422-02` 当前仍是 mock 样例设备，设备型号 `SJD125-38000Z-H1` 仍来自 `utils/mock-data.js`，未凭空改成其他型号；后续应以标准 Excel 或正式云数据为准导入。
- [ ] 参数样例数据只做内部一致性修正，不代表真实项目最终参数。

---

## 当前阶段：云存储可在本地验证

> **代码层全部就绪。** 新增本地模拟云存储层，完整模拟 persistStore → writeDetailCollections → loadStoreFromCloud → checkCloudHealth 全链路。
> 现在可以在**任何环境**（包括无微信云的开发者工具）验证云存储的持久化和恢复。

### 本地云存储验证（无需真实云环境）

1. 小程序中切到"我的"页面
2. 云服务卡片应显示"本地模拟云存储" + "本地模拟" + 绿色状态
3. 点击"诊断" → 确认通过（transport: local-mock）
4. 修改一些业务数据 → 点击"同步" → 数据写入本地模拟存储
5. 关闭工具重新打开 → 点击"拉取" → 数据应从本地模拟存储恢复
6. 验证数据一致性

> **真实云环境上线时**：只需在微信开发者工具开通云开发 → 填 envId → 创建集合 → 部署云函数，系统自动从 local-mock 切换到真实云存储。

### P0 云端试运行（待人工在微信开发者工具操作）

1. 开通云开发 → 获取环境 ID → 填入 `services/cloud-config.js`
2. 创建集合（10个）：`appStores`, `users`, `departments`, `projects`, `devices`, `processTasks`, `qbRecords`, `importLogs`, `operationLogs`, `permissions`
3. 部署 `cloudfunctions/appStore`
4. "我的"页 → 诊断 → 确认全绿（transport 应自动切换为 function 或 direct）
5. 同步 → 关闭重开 → 拉取
6. 配置安全规则

---

## 第8轮新增（2026-06-26 本地模拟云存储）

- [x] `cloud-data.js` 新增 `_initLocalMockCloud()`：当 wx.cloud 不可用时自动激活
- [x] 本地存储层：`localMockGet` / `localMockSet` / `localMockRemove`（基于 wx.storage）
- [x] `readStoreSnapshot` / `writeStoreSnapshot` 在 local mock 模式下走本地存储
- [x] `writeDetailCollections` / `readDetailCollections` 在 local mock 模式下走本地存储
- [x] `_localMockReadCollection`：遍历 storage keys 重组细集合数据
- [x] `checkCloudHealth` 在 local mock 模式下返回简化诊断结果
- [x] `cloud-config.js` 新增 `localMockEnabled` 开关（默认 true）
- [x] `pages/mine` UI 适配：识别"本地模拟云存储"状态
- [x] `isLocalMockMode()` 导出到 module.exports

---

## 已完成

### 全部功能模块
- [x] 项目/设备 CRUD + 派单 + 进度提交
- [x] QB 全流程 + 多人协同
- [x] 参数库 + 对比 + CSV导出 + 模板 + 批量操作
- [x] 附件（本地上传 + 云上传代码就位）
- [x] 用户/部门/权限/字典管理
- [x] Excel 标准模板导入 + 操作日志
- [x] P2 权限细化（dataScope 四级）
- [x] P2 消息通知（5 种类型 + 消息中心）
- [x] P2 数据看板（QB 时效 + 工作量 + 任务分布）
- [x] P3 看板拖拽（列表/看板双模式 + touch 拖拽）
- [x] P3 参数模板 + 批量操作

### 云服务（代码层全部就绪 + 本地可验证）
- [x] cloud-config + cloud-data（细集合 + 乐观锁 + **本地模拟存储**）
- [x] cloudfunctions/appStore（4 action）
- [x] auth-service（performCloudLogin + autoLink）
- [x] attachment-service（upload 重试3次 + 进度回调）
- [x] notification-service（5 种通知）

### 技术验证
- [x] 45 JS 文件全量 node --check 零错误
- [x] 30 页 × app.json 精确匹配
- [x] 页面不直读 mock，getProject/getDevice 等值校验全覆盖

---

## 后续推进

### P0 通过后
- [x] ~~云存储接入启用~~ 已确认三页面均已接入 uploadToCloud/getCloudFileTempUrl
- [x] ~~云存储接入验证~~ attachment-service 三种模式（mock/cloud/cloud-error）均已覆盖
- [ ] permissions 集合导入 → 自动切换 cloud 权限查询
- [ ] 在 WeChat 后台申请订阅消息模板 ID → 填入 `notification-service.js` 的 `WX_TEMPLATE_IDS`

### 未来增强
- [x] ~~微信服务通知基础设施~~ cloud function `sendTemplateMsg` + 前端 subscribe 按钮已完成
- [x] ~~createQb / createProjectDispatch 通知触发~~ 已补充
- [ ] 参数对比导出真实 Excel 文件（当前为 CSV 剪贴板方案）
- [ ] 看板拖拽动画优化 + 桌面端横屏适配### 未来增强
- [ ] 微信服务通知/订阅消息
- [ ] 参数对比导出真实 Excel

