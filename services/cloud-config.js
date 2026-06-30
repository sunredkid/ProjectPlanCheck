module.exports = {
  // ---- Cloud runtime ----
  enabled: true,
  // envId: 在微信开发者工具开通云开发后填入，例如 "production-xxxxx"
  envId: "cloud1-d6ge391kqfbbd2251",

  // ---- Transport ----
  // "auto" — cloud function 优先，不可用时回退到 direct DB
  // "function" — 仅使用云函数（需要先部署 cloudfunctions/appStore）
  // "direct" — 仅使用 direct DB
  transport: "auto",
  cloudFunctionName: "appStore",
  storeCollection: "appStores",
  storeDocId: "production-progress-store",
  healthDocId: "production-progress-health",

  // ---- Standard Excel templates ----
  // 正式上线时，把 outputs/templates/小程序标准导入模板_单台设备进度_v4.xlsx
  // 上传到微信云开发云存储，然后把返回的 fileID 填到 cloudFileID。
  // 如改用公司 HTTPS/CDN 文件服务器，可填 httpsUrl；需在小程序后台配置 downloadFile 合法域名。
  standardTemplates: {
    progressImport: {
      fileName: "小程序标准导入模板_单台设备进度_v4.xlsx",
      cloudPath: "templates/小程序标准导入模板_单台设备进度_v4.xlsx",
      cloudFileID: "cloud://cloud1-d6ge391kqfbbd2251.636c-cloud1-d6ge391kqfbbd2251-1448171580/templates/progress-import-v4.xlsx",
      httpsUrl: ""
    }
  },

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
