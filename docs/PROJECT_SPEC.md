# 除湿机生产进度小程序 PROJECT_SPEC

更新时间：2026-06-30（第21轮 进度提交权限分流与实际开始口径）
项目路径：`D:\WeChatProjects\miniprogram-1`
当前阶段：云存储可在本地完整验证 — 无需真实微信云环境即可测试全链路持久化

---

## 1. 项目目标
公司内部除湿机项目生产进度试点管理工具。

## 2. 页面清单（30 个）
dashboard, notifications, projects, project-edit, project-detail, device-edit, device-detail,
progress-submit, qb-create, qb-detail, qb-list,
param-detail, param-edit, params, param-compare,
user-manage, user-edit, department-manage, department-edit,
project-dispatch, department-dispatch, excel-import, import-logs,
operation-logs, tasks, mine, my-permissions, permission-manage, dictionary-manage, login

> 当前 `app.json` 注册 30 页，包含 `pages/login/index`，不包含 `pages/qb-transfer/index`。`pages/qb-transfer` 文件夹仍残留，但不是当前页面清单的一部分。

## 3. 架构
```
pages -> services/* (11 services) -> utils/mock-data.js (mock 数据源)
pages -> services/* -> cloud-data.js -> 微信云数据库 (真实云)
pages -> services/* -> cloud-data.js -> wx.storage (本地模拟云存储)
```

## 4. 云服务三种运行模式

| 模式 | 条件 | transport | 说明 |
|------|------|-----------|------|
| `local-mock` | wx.cloud 不可用 + localMockEnabled=true | local-mock | 基于 wx.storage 模拟全链路持久化 |
| `function` | 云函数 appStore 已部署 | function | 通过 wx.cloud.callFunction |
| `direct` | fallback / transport="direct" | direct | 直接访问 wx.cloud.database |

### 本地模拟云存储（第8轮新增）
- 当真实 `wx.cloud` 不可用时，`cloud-data.js` 自动切换到 `_initLocalMockCloud()`
- 完整模拟：persistStore → writeStoreSnapshot → writeDetailCollections → loadStoreFromCloud → readDetailCollections
- 存储介质：`wx.setStorageSync` / `wx.getStorageSync`（键前缀 `_cloud_mock_`）
- 可通过 `cloud-config.js` 的 `localMockEnabled: false` 关闭
- mine 页面 UI 自适应显示"本地模拟云存储"

## 5. 云服务代码清单

### services
- `cloud-config.js` — 配置中心（envId / transport / localMockEnabled / 集合名）
- `cloud-data.js` — 云数据库适配器（快照 + 细集合 + 乐观锁 + 本地模拟）
- `auth-service.js` — 用户认证（mock 切换 + WeChat 登录 + autoLink）
- `permission-service.js` — 权限检查（功能权限 + P2 dataScope）
- `attachment-service.js` — 附件管理（本地上传 + 云上传/下载/删除）
- `notification-service.js` — 消息通知（5 种类型）

### cloudfunctions
- `appStore/index.js` — 云函数 appStore（5 action：getStore / saveStore / health / login / downloadTemplateFile）

### 集合（10 个）
appStores / users / departments / projects / devices / processTasks / qbRecords / importLogs / operationLogs / permissions

## 6. 关键约定
- 页面只调 services，不直读 mock
- Excel：统一模板 + 表头识别 + 字段映射
- 自定义 bottom-nav
- getProject/getDevice 等值校验全覆盖

## 7. 2026-06-26 参数对比约定补充
- 参数库列表和参数对比均以参数自身 `unit` 为准，不在页面或列表服务中硬编码 `CMH`。
- 参数对比差异判断同时比较 `value + unit`；WXML 只读取 service 生成的 `val.isDiff`。
- 当前 `utils/mock-data.js` 只作为样例数据；设备型号和真实参数不得凭空修改，后续以标准 Excel 或正式云数据为准。

## 8. 2026-06-27 项目列表与 QB 钉钉约定补充

- 项目总列表不再支持归档项目，也不展示“已归档”筛选项。
- 项目总列表固定为 `全部 / 进行中 / 逾期 / QB` 4 个筛选项。
- 项目列表按 `adminOrderDate`（进度管理员下单时间）筛选和倒序展示；默认筛选当前年月，年份范围 2000-2099，月份使用滚轮选择，不手输。
- 项目完成状态可自动归集：项目下所有启用设备均存在“发货”工序，且全部设备“发货”工序均为“已完成”时，项目自动更新为“已完成”；完成项目总体进度显示 100%。
- 当前 mock/cloud 快照中项目记录保存 `adminOrderDate`，并派生 `adminOrderYear` / `adminOrderMonth` / `archivePath`。`archivePath` 形如 `projects/YYYY/MM`，作为后续云存储或导出归档的虚拟文件夹路径；正式云数据库仍以集合字段查询为主，建议对 `adminOrderDate/adminOrderYear/adminOrderMonth` 建索引。
- QB 当前只读查看：小程序内不再建单、提交处理进展、转交、维护协作人或关单；钉钉未来负责建单、流转、关单，小程序通过 OpenAPI 同步后展示。详见 `docs/QB_DINGTALK_FEASIBILITY.md`。
- QB 列表按项目 `adminOrderDate` 分组形成时间轴；项目总列表筛选项显示为“QB”。

## 9. 2026-06-28 Excel 导入与参数库权限补充

- 单台设备进度标准导入模板已更新为 v4：`outputs/templates/小程序标准导入模板_单台设备进度_v4.xlsx`。
- Excel 导入页“下载模板”按钮正式上线走云端文件：优先读取 `services/cloud-config.js` 的 `standardTemplates.progressImport.cloudFileID` 并通过 `wx.cloud.downloadFile` 下载后 `wx.openDocument` 打开；也支持 `httpsUrl` + `wx.downloadFile`。仅在未配置云端文件时回退本机开发模板路径。
- v4 模板正式发布方式：把 `outputs/templates/小程序标准导入模板_单台设备进度_v4.xlsx` 上传到微信云开发云存储，推荐云路径 `templates/小程序标准导入模板_单台设备进度_v4.xlsx`，再把返回的 `fileID` 填入 `cloud-config.js`。
- Excel 导入确认前必须按项目号确认 `adminOrderDate`：页面弹窗按项目分组展示，每个项目用日期 picker 选择下单时间，`confirmImport()` 以该项目输入值写入 `adminOrderDate` 并派生年月归档字段。
- v4 模板只保留当前代码工序：`项目设计 / 结构设计 / 电气设计 / 采购物料 / 电箱组装 / 电气盘安装 / 结构总装 / 电气总装 / 调试 / 发货`。
- v4 模板表头与 `import-service.js` 当前字段映射一致：`唯一台号 / 项目号 / 台号 / 项目名称 / 型号 / 机内位号/区域 / 要求交货期 / 计划交货期 / 实际发货日期 / 当前所在阶段/部门 / 当前负责人 / 进度% / 是否逾期 / 距交货(天) / 备注`。
- `xlsx-reader.js` 已兼容带 XML 命名空间前缀的 xlsx（如 `<x:sheet>` / `<x:row>` / `<x:c>`），并修复自闭合空单元格导致列错位的问题。
- 参数库新增标识符权限配置：默认 `electrical` / `电气参数` / `electricalParamValues` 仅 `电气设计部` 可见；后台管理员可在字典管理的“参数库权限”页签为每个参数库标识符勾选多个可见部门。
- 参数库权限不写死部门：后续结构、采购、品质等参数库只需新增标识符和可见部门配置，不同部门互不可见。

## 10. 2026-06-28 接手修复补充

- 第三轮复查以当前代码为准：页面仍只调用 services，`pages` 目录不得直读 `utils/mock-data.js` / `utils/mock-user.js`。
- `getRawProject()` / `getRawDevice()` 不得回退第一条记录；`getProject()` / `getDevice()` 入口必须保持等值校验，缺失时返回空结果或错误态，由页面阻断。
- 参数库在当前 store 缺少 `electricalParamValues` 时，允许 service 层按设备 id / 设备号回退本地 mock 样例参数，以保证秦朗｜电气设计部能看到电气参数；该回退不得绕过参数库权限。
- 注意本地模拟云存储会原地覆盖共享 mock 对象；service 层需要保留深拷贝的干净种子数据作为样例回退源，不能用同一对象引用当 fallback。
- 参数模板保存/删除必须走 service 入口并记录 audit，不允许页面直接写 mock 字典。
- 任务页“我的”必须能按当前用户匹配个人任务；当任务记录未保存 owner 时，service 可从设备 `processMap` 的同名工序回填负责人。
- 任务列表可由 `tasks` 快照与设备 `processMap` 工序任务合并生成，按项目号 + 设备号 + 工序去重，以避免旧快照为空或缺 owner 时个人任务丢失。
- 项目详情、设备详情、任务列表和进度统计必须共用同一条工序读取路径；本地模拟云快照缺少 `processMap` 时，service 可按设备号回退种子工序，避免展开工序空白。
- 参数库顶部“模板 / 批量 / 对比”按钮保持在按钮框内垂直居中。
- 参数详情页不得只依赖字典分类顺序；如果本地模拟云快照缺少 `paramCategories`，必须回退种子字典，并把参数自身存在的分类追加展示。
- 进度管理员负责项目派单到部门；部门管理员不得进入或调用项目派单，只能把本部门待分配任务派给同部门普通员工。页面入口和 service 写入口都必须校验该规则。
- 杩涘害绠＄悊鍛樿礋璐ｉ」鐩淳鍗曞埌閮ㄩ棬锛涢儴闂ㄧ鐞嗗憳涓嶅緱杩涘叆鎴栬皟鐢ㄩ」鐩淳鍗曪紝鍙兘鎶婃湰閮ㄩ棬寰呭垎閰嶄换鍔℃淳缁欏悓閮ㄩ棬鏅€氬憳宸ャ€傞〉闈㈠叆鍙ｅ拰 service 鍐欏叆鍙ｉ兘蹇呴』鏍￠獙璇ヨ鍒欍€?

## 11. 2026-06-29 参数导出、QB只读和权限管理补充

- 参数对比页已新增真实 Excel 导出，不再只是 CSV 剪贴板。导出支持两种主筛选：按项目号、按进度管理员下单时间区间；同时支持勾选参数名并按展示文本精确匹配设定值。
- 参数导出项目-设备子菜单规则：选中项目默认导出“全部设备”；勾选具体设备会取消“全部设备”；如果取消到没有单台设备，则自动回到“全部设备”。
- 参数导出文件格式：`.xlsx`，每台设备一行，列为项目号、项目名称、下单日期、设备号、型号、位置/区域及电气参数名；参数值按 `value + unit` 展示文本写入，例如 `53 m3/h`。
- 新增 `services/xlsx-writer.js`，复用 vendored `fflate` 生成 OpenXML xlsx，不引入外部云端依赖。
- QB 模块在小程序内只读：`app.json` 已移除 `pages/qb-transfer/index`；`qb-detail` 只展示基础信息、关联设备和处理记录；service 旧写函数保留兼容函数名但只返回只读提示。
- QB 钉钉同步预留接口：`data-service.js` 新增 `upsertQbFromDingTalk()` / `syncQbFromDingTalk()`，字段保留 instanceId、processCode、businessId、url、raw，后续由云函数或后端写入。
- 权限管理已从静态说明改为可保存配置：`utils/mock-data.js` 增加 `permissions`，`cloud-data.js` 纳入 `permissions` 快照/细集合，`permission-manage` 可编辑保存权限矩阵。
- 看板拖拽已写回 service：拖动任务状态不再只修改页面克隆对象；普通任务写回 `tasks`，工序生成任务写回对应 `processMap` 工序。
- 数据看板当前页面为 `pages/dashboard/index`，入口在“我的”页后台管理菜单；统计来源为 `data-service.getDashboardStats()`。
- 站内通知当前为 `pages/notifications` + `notification-service` 的本地消息中心；微信订阅消息仅保留授权和云函数发送基础设施，未配置真实模板 ID 前不应视为上线功能。
- 本地模拟云存储用于无真实微信云环境时验证快照持久化、细集合读写和诊断链路；当前不直接连接真实微信云数据库。

## 12. 2026-06-29 项目列表和组织清单补充

- 项目总列表的 service 入口 `listProjects()` 已恢复按 `adminOrderDate` 倒序排序，并按 `adminOrderYear/adminOrderMonth` 或 `adminOrderDate` 派生年月过滤；后下单项目靠上。
- 完成项目出现未关闭 QB 时，`decorateProjectSummary()` 输出 `completedWithOpenQb/statusTone`，项目列表“已完成”标签显示黄色；QB 结案或关闭后 `qbOpen` 归零，标签恢复浅灰。
- 项目详情和项目列表中的逾期统计只统计工序逾期：当前日期达到或超过工序计划完成日期，且该工序仍未完成。不同工序分别计数，不按设备合并。
- “延期”不再作为逾期统计标签；仅表示进度管理员人工后延项目计划发货日期。项目计划发货日期后延后，列表/详情中的计划发货日期变色并追加“延期”字样，同时记录原计划发货日期。
- 工序中的“计划截止日期”统一改名为“计划完成日期”；进度提交日期晚于计划完成日期时，工序展开行将实际完成/进度提交日期标红。
- 组织样例清单补齐：新增 `工艺部门` 和演示员工 `刘爽`；登录绑定部门清单同时补齐 `制造部 / 总经办/销售/市场 / 信息化`，与角色预览数据保持一致。
- 当前权限角色样例：普通员工、进度管理员、部门管理员、综管部管理员、观察员、后台管理员。`采购部 / 工艺部门 / 项目部 / 电工房 / 电气设计部 / 结构设计部` 等是业务部门，不是权限角色。
- 数据看板入口已挂到“我的”页的后台管理入口，菜单名为“数据看板”；任务页右上角的“看板视图”是任务状态拖拽看板，不是数据统计看板。

## 13. 2026-06-30 派单权限和测试负责人补充

- 项目总列表的项目卡片为进度管理员/后台管理员显示“编辑项目”，可直接维护项目主要信息：项目号、项目名称、客户、进度管理员、下单时间、计划发货、状态。
- 项目详情页的“编辑项目 / 删除项目 / 新增设备 / 项目派单”均收紧为进度管理员/后台管理员可见；普通员工（如秦朗）不得看到或调用项目派单。
- 派单概念统一为两类：进度管理员做“项目派单”，以项目为单位派到部门；部门管理员做“设备派单”，以设备/工序为单位派给本部门普通员工。
- 测试负责人调整：项目设计归 `蒋相波｜项目部`，结构设计 `陈七` 改为 `彭博｜结构设计部`，电箱组装归 `卢建平｜电工房`；张绍方不再承担项目设计生产任务，只负责进度管理、派单和读信息。
- service 层会对旧快照中的 `项目设计｜张绍方`、`结构设计｜陈七` 和空负责人电箱组装做展示级规范化，避免本地模拟云旧数据继续污染任务页。

## 14. 2026-06-30 权限角色与业务部门概念补充

- `普通员工 / 进度管理员 / 综管部管理员 / 部门管理员 / 观察员 / 后台管理员` 是小程序后台层面的权限界定标识，决定页面入口、派单、编辑、管理等权限。
- 员工姓名后 `｜` 后面的文字是公司业务流程部门标识，例如 `秦朗｜电气设计部`、`李洋｜采购部`、`刘爽｜工艺部门`、`蒋相波｜项目部`。
- `采购部员工 / 工艺部门员工 / 项目部员工 / 电工房员工` 不作为后台权限角色；这些人员的权限角色统一为 `普通员工`，所属业务部门通过 `department` 字段表达。
- 开发阶段角色预览的当前用户必须按用户唯一标识匹配，不能按权限角色名匹配；同为 `部门管理员` 的彭博和周八不能同时显示“当前”。

## 15. 2026-06-30 计划发货调整记录补充

- 计划发货日期默认直接显示；发生人工调整后，日期后显示调整方向标识和“调整记录”入口。
- 调整方向按最新一次调整判断：新计划发货日期晚于调整前日期为“延期”，新计划发货日期早于调整前日期为“提前”；“提前”标识使用红色。
- 首次调整计划发货日期时，系统自动把调整前计划发货日期写为第 1 条记录，再把新计划发货日期追加为第 2 条。
- 调整记录表字段固定为：序号、下单日期、计划发货日期。记录按发生顺序自上而下显示，最新调整记录在最下面。
- “延期/提前”只描述项目计划发货日期的人工调整，不是工序状态；工序逾期仍由计划完成日期和完成状态计算。

## 16. 2026-06-30 归档残留、权限角色与页面/action 清单补充

- `services/data-service.js` 已移除 `archiveProject()` 函数体和导出；项目归档不是当前业务功能，文档不得再声明代码仍保留归档入口。
- 权限角色和业务部门严格分离：`permission-service.js` 的后台角色匹配只看 `role/roleLabel`，业务部门匹配只看 `department`；`isManager` 不再授予部门管理员权限。
- 当前页面清单以 `app.json` 为准：有 `pages/login/index`，没有 `pages/qb-transfer/index`；`pages/qb-transfer` 文件夹只是未注册残留。
- `cloudfunctions/appStore` 当前真实 action 固定为 `getStore / saveStore / health / login / downloadTemplateFile`，不包含 `sendTemplateMsg`。

## 17. 2026-06-30 工序展开、个人任务、参数库与设备派单入口补充

- 项目详情展开状态由页面 JS 写入设备行 `expanded` 字段，WXML 不再用动态下标读取展开状态；工序数据必须通过 `getDevicesByProject()` / `getProcessesByDevice()` 的 service 路径读取。
- 项目详情展开工序必须显示工序名、计划完成日期、负责人、状态和进度提交日期；本地云快照缺少 `processMap` 时，service 使用种子工序回退，不允许页面直读 mock。
- 任务页“我的”以当前用户姓名匹配 owner；秦朗测试账号应能读到现有电气设计任务/工序，不允许为测试生造任务。
- 参数库列表和按参数查都必须通过 `getDeviceParams()` 读取参数，确保当前快照缺 `electricalParamValues` 时仍可使用种子参数回退，且不绕过参数库权限。
- 部门管理员的“设备派单”入口显示在项目详情的待分配工序行上，跳转时使用已有待分配任务 `rowKey`；部门管理员不能进入项目派单。
- 设备派单候选人只包含同业务部门普通员工，不包含部门管理员、进度管理员或后台管理员。
- 角色预览主标题显示员工姓名，副标题显示业务部门和权限角色，当前态仍按用户唯一标识匹配。

## 18. 2026-06-30 进度提交权限分流与实际开始口径补充

- 设备级进度提交属于普通员工路径：普通员工提交设备工序后，系统自动把该工序状态记为“已完成”，不再让普通员工选择“进行中/有风险/暂停”等状态。
- 部门管理员不按单台设备提交进度；部门管理员在项目详情对本部门工序执行“提交项目进度”，service 按 `projectNo + department + process` 一次写回项目下所有对应设备工序。
- 部门管理员只能看到和操作本部门工序的“提交项目进度”；非本部门工序不显示提交入口。项目派单仍只归进度管理员/后台管理员。
- 任务页中，部门管理员点击工序提交时也必须跳转项目级提交；普通员工仍跳转设备级提交。
- 设备详情中，部门管理员不显示单台设备“提交进度”按钮；普通员工只在自己负责的工序上按设备提交。
- `actualStart`（实际开始）字段不由系统自动推算；最终写入仍来自初始样例数据、Excel 导入字段或进度提交页提交值。进度提交页的默认值按第 22 节从派单日期带出，用户仍可在表单中调整。

## 19. 2026-06-30 项目级部门进度未完成确认补充

- 部门管理员执行“提交项目进度”前，页面必须先通过 `data-service.getProjectDepartmentProgressPreview()` 预览本项目、本部门、本工序下的设备工序状态；页面不得自行遍历 mock 或绕过 service 判断。
- 若预览中存在未完成设备，进度提交页必须弹出阻断表，表头固定为“未完成设备 / 负责人 / 预计完成时间”；下方按钮为“已知晓”，点击后返回前置界面，本次项目进度提交失败且不得写任何工序。只有每台设备的该部门工序都已提交完成后，才允许调用 `submitProjectDepartmentProgress()`。
- 预览和提交都必须校验当前用户是部门管理员，且 `department` 等于当前用户业务部门；非本部门工序不显示入口，也不能通过直达 URL 提交。
- 人员、角色、部门、负责工序关系核对以导出的 Excel 表为人工确认入口，当前代码不根据猜测新增人员或负责人。用户改回表格后，再按表修改 service/mock 初始数据。
- 项目详情工序展开、任务页个人任务、参数库列表/详情/导出共享设备、工序、参数底层读取与回退链路。任何触及设备、工序任务、参数、cloud 快照、导入或权限的修改，都必须一起复测这三类页面/service，避免同步出现空白。

## 20. 2026-06-30 人员角色部门工序核对表落地补充

- 当前测试用户和工序负责人以用户回传的 `人员角色部门工序核对表.xlsx` 为准。17 名用户为：蒋相波、彭博、秦朗、刘爽、郑雪莲、卢建平、孙志勇、朱建闯、王国峰、李洋、陈尚杰、郭敬锋、苏高森、张绍方、IT、吴洁、总经理。
- 彭博为 `结构设计部｜普通员工`；陈尚杰为 `电气设计部｜部门管理员`，用于测试 C26-0422 项目电气设计项目级提交的未完成阻断。
- 当前工序清单为：`项目设计 / 结构设计 / 电气设计 / ERP录入 / 物料采购 / 电气盘安装 / 结构总装 / 电气总装 / 电箱组装 / 调试 / 发货`。
- 旧名兼容：`采购物料/机械采购/电气采购/采购部门` 规范为 `物料采购`；`电工房` 规范为 `电气电控车间`；`结构班组/电气班组` 规范为 `生产装配`；`生产部` 规范为 `工艺部门`。
- “写回”指把页面或 service 提交的结果写入底层数据对象，例如设备工序的 `status / actualStart / actualFinish / quantity / remark / attachments`。未完成阻断时不得写回任何这些字段。
- `actualStart` 仍然不是系统自动推算字段，只来自样例数据、Excel 导入或员工在进度提交页手动填写。
## 21. 2026-06-30 项目级提交入口与标题文案补充
- `C26-0501 / 除湿机试点项目` 是项目记录，可以存在于项目总列表；不得因为项目总列表标题区的小字问题删除或过滤该项目。
- 项目总列表标题下方不得使用“除湿机项目试点”等静态副标题；当前顶部只显示主标题“项目总列表”。
- 部门管理员“提交项目进度”入口统一由 `data-service.getDepartmentProjectSubmitOptions(projectNo, user)` 生成；只有项目下存在当前部门管理员所属业务部门的启用设备工序时才显示入口。
- 项目总列表项目卡片和项目详情顶部都可以显示“提交项目进度”，但入口必须带 `projectNo + process + department` 跳转到 `pages/progress-submit`，页面不得直接读 mock 或用 `isManager` 推断部门管理员权限。
- 项目详情展开后的每台设备工序行不得显示“提交项目进度”；设备工序进度由普通员工按单台设备提交，部门管理员只按项目统一提交本部门工序进度。
- 陈尚杰用于测试 `C26-0422 / 电气设计部 / 电气设计` 项目级提交流程；若该项目两台设备的电气设计工序尚未完成，提交必须弹出未完成设备表并失败，不得写回任何工序。

## 22. 2026-06-30 实际开始默认派单日期补充
- 进度提交页的“实际开始日期”默认读取派单日期，不默认读当天日期：部门管理员按项目提交时优先读取项目 `adminOrderDate`（项目卡片展示为“下单时间”，即进度管理员派单/下单时间），再兜底显式 `dispatchedAt`；普通员工按单台设备提交时读取部门管理员派给员工的 `assignedAt`。
- `dispatchedAt` 由 `createProjectDispatch()` 写入，代表进度管理员派单到部门的日期；`assignedAt` 由 `assignDepartmentTask()` 写入，代表部门管理员派单给普通员工的日期。
- 页面不得直接遍历 mock 派单数据；项目级默认日期通过 `data-service.getProjectDepartmentDispatchDate()` 获取，设备级默认日期通过 `data-service.getDeviceProcessAssignmentDate()` 获取。C26-0422 项目级电气设计默认日期应为 `2026-06-18`，秦朗设备级电气设计默认日期应为 `2026-06-21`。
- 旧数据缺少派单日期时，设备级提交可回退已有工序 `actualStart`，但新派单链路必须写入派单日期，避免“实际开始日期”默认空白。
