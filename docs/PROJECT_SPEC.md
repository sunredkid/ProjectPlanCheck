# 除湿机生产进度小程序 PROJECT_SPEC

更新时间：2026-06-26（第9轮云服务补全）
项目路径：`D:\WeChatProjects\miniprogram-1`
当前阶段：云存储可在本地完整验证 — 无需真实微信云环境即可测试全链路持久化

---

## 1. 项目目标
公司内部除湿机项目生产进度试点管理工具。

## 2. 页面清单（30 个）
dashboard, notifications, projects, project-edit, project-detail, device-edit, device-detail,
progress-submit, qb-create, qb-detail, qb-transfer, qb-list,
param-detail, param-edit, params, param-compare,
user-manage, user-edit, department-manage, department-edit,
project-dispatch, department-dispatch, excel-import, import-logs,
operation-logs, tasks, mine, my-permissions, permission-manage, dictionary-manage

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
- `appStore/index.js` — 云函数 appStore（5 action：getStore / saveStore / health / login / sendTemplateMsg）：getStore / saveStore / health / login）

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
