# QB 钉钉开放接口可行性研究

更新时间：2026-06-27

## 结论

可行，但建议把钉钉作为未来 QB 的数据源和操作入口：员工仍在钉钉内建单、流转、关单；小程序只做只读查看、时间轴、统计、关联项目/设备/工序。

不建议小程序前端直接调用钉钉接口。钉钉企业内部应用需要 `AppKey/AppSecret` 换取 `access_token`，密钥必须放在云函数或后端服务中。小程序侧只调用本项目的云函数。

官方参考：
- 钉钉开放平台：获取企业内部应用 accessToken  
  https://open.dingtalk.com/document/orgapp-server/obtain-the-access_token-of-an-internal-app
- 钉钉开放平台：事件订阅概述  
  https://open.dingtalk.com/document/development/overview-of-event-subscription

## 推荐架构

```
钉钉 QB 表单/审批/宜搭
  -> 钉钉 OpenAPI / 事件订阅
  -> 微信云函数 appStore 或独立 dingTalkSync 云函数
  -> qbRecords 集合 / appStores 快照
  -> 小程序 QB 列表、详情、看板只读展示
```

## 数据同步方式

1. 事件订阅优先  
   钉钉侧建单、更新、关单时回调云函数，云函数按钉钉实例 ID upsert 到 `qbRecords`。

2. 定时兜底拉取  
   每 5-15 分钟按更新时间拉取一次，补偿回调失败、权限变更、网络异常。

3. 手动同步  
   后台管理员保留“同步钉钉 QB”按钮，方便试运行阶段人工校验。

## 字段映射建议

`qbRecords` 建议保留当前小程序字段，同时新增钉钉来源字段：

- `source`: `dingtalk`
- `dingTalkInstanceId`: 钉钉审批/表单实例 ID
- `dingTalkProcessCode`: 钉钉流程/表单编码
- `projectNo`: 项目号
- `deviceNo`: 台号
- `process`: 工序
- `title`: QB 标题
- `description`: 问题描述
- `owner`: 当前负责人
- `status`: 小程序展示状态
- `dingTalkStatus`: 钉钉原始状态
- `occurredAt`: 建单时间
- `closedAt`: 关单时间
- `attachments`: 附件映射
- `rawPayload`: 原始数据快照，便于追溯

## 小程序改造范围

- `qb-create`：已改为只读占位提示，后续不在小程序内建单。
- `qb-detail`：只读展示基础信息、协作者、关联设备和处理记录，隐藏进展提交、转交、关单。
- `qb-transfer`：当前不在 `app.json` 注册；文件夹仅为未注册残留，不作为小程序页面入口。
- `qb-list`：已改为按项目下单时间分组的 QB 时间轴，后续读取钉钉同步后的 `qbRecords`。
- 数据看板：继续按同步后的 `qbRecords` 统计。
- `notification-service`：小程序内通知只提示查看；实际流程通知以钉钉为主。

## 关键风险

- 需要企业钉钉管理员创建内部应用并授予接口权限。
- 需要明确 QB 在钉钉中使用“审批流程”“宜搭表单”还是自建应用，不同载体接口不同。
- 附件下载通常需要临时地址或权限校验，必须由云函数中转。
- 用户身份需要映射：小程序用户、手机号、钉钉 userid/unionid 需要建立对应关系。
- 钉钉接口频率限制、回调重试和 token 缓存需要单独处理。

## 分阶段方案

1. POC：创建钉钉测试应用，读取 1 条 QB 实例，写入本地 mock/cloud qbRecords。
2. 只读同步：实现定时拉取 + 手动同步，QB 列表和详情展示钉钉数据。
3. 事件订阅：接入钉钉回调，补充失败重试和同步日志。
4. 关闭小程序 QB 写操作：小程序只读，钉钉作为唯一建单/关单入口。
5. 正式迁移：历史 QB 编号、项目号、设备号、工序映射校验后上线。

## 2026-06-29 当前代码接口状态

- 小程序 QB 当前只读：`app.json` 已移除 `pages/qb-transfer/index`，残留文件夹不作为页面入口；`qb-detail` 不再提供转交、提交进展、关单等方法。
- `data-service.js` 保留旧写函数名用于兼容历史调用，但 `createQb/transferQb/appendQbProgress/addQbAssignee/updateQbAssigneeStatus/removeQbAssignee/closeQb` 均返回只读提示，不写本地数据。
- 当前预留同步入口：
  - `upsertQbFromDingTalk(record)`：按 `qbNo/serialNo/instanceId` upsert 单条 QB。
  - `syncQbFromDingTalk(records)`：批量同步数组，返回 total/success/failed/results。
- 当前字段容器：
  - 小程序展示字段：`qbNo/projectNo/title/description/process/currentOwner/status/occurredAt/category/productLine/raisedProcess/quantity/department/responsibleDepartment/initiator/reason/temporaryAction/longTermAction/linkedDevices/logs`
  - 钉钉来源字段：`dingTalk.instanceId/processCode/businessId/url/updatedAt/raw`
- 后续云函数只需要把钉钉 OpenAPI 或事件订阅 payload 映射成上述 record，再调用同等逻辑写入 `qbRecords` / `appStores` 快照即可。
