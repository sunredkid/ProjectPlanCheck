module.exports = {
  // ---- Cloud runtime ----
  enabled: true,
  // envId: 在微信开发者工具开通云开发后填入，例如 "production-xxxxx"
  envId: "",

  // ---- Transport ----
  // "auto" — cloud function 优先，不可用时回退到 direct DB
  // "function" — 仅使用云函数（需要先部署 cloudfunctions/appStore）
  // "direct" — 仅使用 direct DB
  transport: "auto",
  cloudFunctionName: "appStore",
  storeCollection: "appStores",
  storeDocId: "production-progress-store",
  healthDocId: "production-progress-health",

  // ---- Local mock cloud storage ----
  // 当 wx.cloud 不可用时（例如在开发者工具未开通云开发、或 PC 端模拟器），
  // cloud-data.js 自动激活本地模拟云存储（基于 wx.setStorageSync），
  // 完整模拟 persistStore → writeStoreSnapshot → writeDetailCollections →
  // loadStoreFromCloud → readDetailCollections → applyStoreSnapshot 全链路。
  // 设为 false 可禁用本地模拟，让云服务在无 wx.cloud 时保持未就绪状态。
  localMockEnabled: true,

  // ---- Persistence ----
  storageKey: "production_progress_cloud_store",
  syncDebounceMs: 800,
  seedFromMockWhenEmpty: true,
  detailCollectionsEnabled: true
};