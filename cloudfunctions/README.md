# Cloud Functions

当前云服务第一阶段使用 `appStore` 云函数承载快照读写。

## appStore

路径：
```text
cloudfunctions/appStore/
  index.js      # 云函数主入口
  config.json   # 权限配置
  package.json  # 依赖声明（wx-server-sdk）
```

功能：
- `getStore`：读取 `appStores/production-progress-store`
- `saveStore`：写入 `appStores/production-progress-store`
- `health`：写入 `appStores/production-progress-health`，并读取业务快照状态 + schema 报告。
- `login`：通过云函数上下文 openid 匹配 `users` 集合或业务快照用户，并支持按姓名/手机号自动绑定。
- `downloadTemplateFile`：校验并下载标准进度导入模板 `templates/progress-import-v4.xlsx`。

当前真实 action 固定为：`getStore / saveStore / health / login / downloadTemplateFile`。

## 部署步骤

部署前在微信开发者工具中执行：

1. 确认已开通云开发环境：
   - 点击 IDE 顶部"云开发"按钮，进入云开发控制台。
   - 确认"数据库"选项卡可用，环境状态正常。

2. 确定云环境 ID：
   - 在"云开发控制台 -> 设置 -> 环境设置"中查看环境 ID。
   - 如果希望使用动态当前环境（推荐），保持 `services/cloud-config.js` 中 `envId: ""`。
   - 如果需要指定固定环境，将环境 ID 填入 `services/cloud-config.js` 的 `envId` 字段。

3. 创建数据库集合：
   - 在"云开发控制台 -> 数据库"中创建集合 `appStores`。
   - 此集合将存放两份文档：
     - `production-progress-store`：业务快照
     - `production-progress-health`：健康诊断

4. 配置数据库权限（初始阶段）：
   - 开发阶段可将 `appStores` 集合权限设为"所有用户可读写，仅创建者及管理员可读写"或更宽松。
   - 正式上线前，收紧为仅云函数读写（见下方安全规则建议）。

5. 部署云函数：
   - 在 IDE 左侧文件树中，右键 `cloudfunctions/appStore` 文件夹。
   - 选择"上传并部署：云端安装依赖"。
   - 等待部署完成（控制台输出绿色成功提示）。

6. 验证部署：
   - 回到小程序，切换到"我的"页面。
   - 点击"诊断"按钮。
   - 确认显示：
     - `init`：通过
     - `health-write`：通过（Cloud function.）
     - `health-read`：通过（Cloud function.）
     - `store-read`：通过
     - `schema`：通过（或显示修复数量）
     - `transport`：显示为 `function`
   - 如果 transport 显示 `function`，说明云函数路径优先生效。

7. 验证设备数据同步：
   - 在"我的"页点击"同步"按钮，将当前 mock 数据上传到云端。
   - 关闭开发者工具 → 重新打开 → 进入小程序。
   - 在"我的"页点击"拉取"，确认项目列表数据恢复。

## 数据库安全规则建议

### 开发阶段（可以宽松）
```json
{
  "read": true,
  "write": true
}
```

### 体验版 / 正式版（推荐收紧为云函数专用）
```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```
> 注意：此规则要求文档的 `_openid` 与当前用户匹配。如果使用云函数写入，云函数会自动附带服务端 openid。
> 另一种方案是将集合的读权限设为 `true`（允许客户端读），写权限仅限云函数：
```json
{
  "read": true,
  "write": false
}
```
> 然后在云函数中使用服务端 SDK 不受此规则限制。

### 最终的正式环境建议
将读写全部收敛到云函数，客户端不直连数据库：
```json
{
  "read": false,
  "write": false
}
```
前端 `transport` 设为 `"auto"` 时，云函数不可用会回退直连；部署云函数后，所有读写走云函数，不受客户端安全规则约束。

## 数据库索引建议

在 `appStores` 集合上建议创建以下索引（云开发控制台 -> 数据库 -> appStores -> 索引管理）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | 默认 | 文档主键，已自动索引 |
| `updatedAt` | 降序 | 按更新时间排序 |

当前只有两份文档（store + health），数据量极小，索引优先级不高。后续拆分为细集合后再按业务查询模式补充索引。

## 云函数依赖

```json
{
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

部署时选择"云端安装依赖"，不需要本地 `npm install`。

## 传输策略

前端 `services/cloud-config.js` 当前配置：
```js
transport: "auto"
cloudFunctionName: "appStore"
```

`auto` 表示优先调用云函数；如果云函数尚未部署，会回退到客户端直连云数据库，便于分阶段试运行。
正式环境建议部署云函数后，将 `transport` 改为 `"function"` 彻底关闭直连回退。
