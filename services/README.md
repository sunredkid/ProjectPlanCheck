# Services Layer

The mini-program pages should call service modules instead of reading mock data directly.

Default local route:

```text
pages -> services/* -> utils/mock-data.js / utils/mock-user.js
```

Cloud route:

```text
pages -> services/* -> services/cloud-data.js -> WeChat cloud database
```

## Modules (11 services)

| Module | Description |
|--------|-------------|
| `data-service.js` | Project/device/task/QB/parameter/dispatch/user/department CRUD + dashboard stats + P2 dataScope filters |
| `cloud-config.js` | Cloud runtime switch, envId, transport mode, collection settings |
| `cloud-data.js` | WeChat cloud database adapter: snapshot load/sync, detail collection read/write, version optimistic lock, health check |
| `auth-service.js` | Current user, mock preview switching, WeChat login (performCloudLogin/matchCloudUserByOpenid) |
| `permission-service.js` | Role/action permission checks + P2 dataScope (all/department/project/self) |
| `audit-service.js` | Operation log writer/reader with field-level diff |
| `import-service.js` | Standard Excel import: validation, semantic checks, multi-sample acceptance, mock write-back |
| `import-parser.js` | Header-name based template row mapping, grouped stage columns |
| `xlsx-reader.js` | OpenXML `.xlsx` reader with vendored `fflate.js` for zip decompression |
| `attachment-service.js` | Local file selection/preview + P2 cloud upload (retry ×3) / download / delete |
| `notification-service.js` | P2 notification service: task assign, overdue remind, QB transfer/close/progress + read/unread tracking |

## Pages (30)

dashboard, notifications, projects, project-edit, project-detail, device-edit, device-detail,
progress-submit, qb-create, qb-detail, qb-transfer, qb-list,
param-detail, param-edit, params, param-compare,
user-manage, user-edit, department-manage, department-edit,
project-dispatch, department-dispatch, excel-import, import-logs,
operation-logs, tasks, mine, my-permissions, permission-manage, dictionary-manage

## Rules

- Pages must not `require("../utils/mock-data")` or `require("../utils/mock-user")` directly.
- Do not re-enable native `tabBar`; keep using `components/bottom-nav`.
- Do not restore the old home/house button flow.
- Mock role preview is allowed only outside `release`.
- Write operations should record audit entries through `audit-service.js`.
- Excel import uses one standard template, exact header-name recognition and configurable field mapping.
- Excel import must not guess arbitrary headers.
- Device model and area are device basic fields, not electrical parameters.
- All getProject/getDevice/getUser entry points must enforce strict equality checks.

## Cloud Collections (10 recommended)

- `appStores` — snapshot document + health document
- `users` — openid, name, phone, department, role, status
- `departments` — name, managers, status
- `projects` — projectNo, name, customer, admin, shipDate, status
- `devices` — projectNo, deviceNo, model, area, shipDate, status
- `processTasks` — deviceId, name, status, owner, due, actualStart, actualFinish
- `qbRecords` — qbNo, projectNo, title, currentOwner, assignees[], status
- `importLogs` — id, createdAt, projectCount, deviceCount, taskCount, status
- `operationLogs` — id, createdAt, module, action, targetType, detail (含 diff)
- `permissions` — role, label, permissions: string[]

## Cloud Migration

### Transport modes

`services/cloud-config.js` uses `transport: "auto"`:
- Cloud function `appStore` deployed → calls go through `wx.cloud.callFunction`
- Not deployed → falls back to direct cloud database access

### Data persistence strategy

```
persistStore:
  1. writeStoreSnapshot (appStores/production-progress-store)
  2. writeDetailCollections (users/departments/projects/devices/qbRecords/processTasks/importLogs/operationLogs)
  Both succeed → syncState = "synced"

loadStoreFromCloud:
  1. readDetailCollections (parallel read from all detail collections → reassemble snapshot)
  2. If detail collections empty → readStoreSnapshot (snapshot fallback)
  3. If all empty and seedFromMockWhenEmpty → persistStore("seed")
```

### Version optimistic lock

`storeVersion` tracks the local store version. Incremented on each persistStore. Written alongside the snapshot. On load, restored from local cache then overwritten by cloud data.

### Cloud function: appStore

4 actions: `getStore`, `saveStore`, `health`, `login`
- `login`: matches openid against `users` collection → store snapshot fallback → auto-link by name/phone

### P0 cloud launch checklist

1. Enable cloud dev in WeChat DevTools → get envId → set in `cloud-config.js`
2. Create 10 collections in cloud console
3. Deploy `cloudfunctions/appStore`
4. "我的" page → Diagnose → all green + transport: function
5. Sync → close/reopen → Pull verify
6. Configure DB security rules