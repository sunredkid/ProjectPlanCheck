# Mock Data Center

Current prototype data is still stored in `utils/mock-data.js` and `utils/mock-user.js`, but pages must not read these files directly.

Current route:

```text
pages -> services/* -> utils/mock-data.js / utils/mock-user.js
```

Future cloud route:

```text
pages -> services/* -> services/cloud-data.js -> WeChat cloud database
```

Rules:

- Only service modules should import mock data.
- Pages should call `services/data-service.js`, `services/auth-service.js`, `services/permission-service.js`, or `services/import-service.js`.
- Mock writes are runtime in-memory changes only; they are not persisted back into this file.
- Do not add new page-local fake data.
- Do not bypass services when preparing for cloud migration.

Recommended future cloud collections are documented in `docs/PROJECT_SPEC.md` and `services/README.md`.
