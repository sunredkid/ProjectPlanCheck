const mockData = require("../utils/mock-data");
const cloudConfig = require("./cloud-config");

const COLLECTIONS = {
  users: "users",
  departments: "departments",
  projects: "projects",
  devices: "devices",
  processTasks: "processTasks",
  qbRecords: "qbRecords",
  importLogs: "importLogs",
  operationLogs: "operationLogs",
  permissions: "permissions",
  // Reserved for future use:
  qbTransfers: "qbTransfers",
  paramSchemas: "paramSchemas",
  deviceParams: "deviceParams"
};

// Map each snapshot array key to a detail collection name.
// Null means the key stays in the root snapshot only (no separate detail collection).
const STORE_KEY_TO_COLLECTION = {
  users: COLLECTIONS.users,
  departments: COLLECTIONS.departments,
  projects: COLLECTIONS.projects,
  devices: COLLECTIONS.devices,
  qbList: COLLECTIONS.qbRecords,
  tasks: COLLECTIONS.processTasks,
  dispatchTasks: null,        // remain snapshot-only
  importLogs: COLLECTIONS.importLogs,
  operationLogs: COLLECTIONS.operationLogs
  ,
  permissions: COLLECTIONS.permissions
};

const STORE_KEYS = [
  "users",
  "departments",
  "projects",
  "devices",
  "processMap",
  "qbList",
  "tasks",
  "dictionaries",
  "electricalParamValues",
  "dispatchTasks",
  "qbDetails",
  "importPreview",
  "importLogs",
  "operationLogs",
  "permissions"
];

const STORE_ARRAY_KEYS = [
  "users",
  "departments",
  "projects",
  "devices",
  "qbList",
  "tasks",
  "dispatchTasks",
  "importLogs",
  "operationLogs",
  "permissions"
];

const STORE_OBJECT_KEYS = [
  "processMap",
  "dictionaries",
  "electricalParamValues",
  "qbDetails",
  "importPreview"
];

const STORE_SCHEMA_VERSION = 1;

let cloudDb = null;
let initialized = false;
let ready = false;
let syncEnabled = false;
let loadState = "idle";
let lastError = "";
let lastLoadAt = "";
let lastSyncAt = "";
let syncState = "idle";
let healthState = "idle";
let lastHealthAt = "";
let lastHealthResult = null;
let lastSchemaReport = null;
let pendingTimer = null;
let pendingReason = "";
let revision = 0;
let storeVersion = 0;
let detailCollectionsEnabled = cloudConfig.detailCollectionsEnabled !== false;
const listeners = [];

function clone(value) {
  if (value === undefined || value === null) return value;
  const text = JSON.stringify(value);
  if (text === undefined) return undefined;
  return JSON.parse(text);
}

function emitChange(reason = "cloud-change", detail = {}) {
  revision += 1;
  const payload = {
    reason,
    revision,
    detail,
    backend: getBackendInfo()
  };
  listeners.slice().forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      // Page refresh listeners should not break cloud persistence.
    }
  });
  return payload;
}

function subscribeChange(listener) {
  if (typeof listener !== "function") return function noop() {};
  listeners.push(listener);
  return function unsubscribe() {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

function hasCloudRuntime() {
  return typeof wx !== "undefined" &&
    wx.cloud &&
    typeof wx.cloud.init === "function" &&
    typeof wx.cloud.database === "function";
}

function getEnvId() {
  if (cloudConfig.envId) return cloudConfig.envId;
  if (hasCloudRuntime() && wx.cloud.DYNAMIC_CURRENT_ENV) {
    return wx.cloud.DYNAMIC_CURRENT_ENV;
  }
  return "";
}

function getStoreCollection() {
  return cloudConfig.storeCollection || "appStores";
}

function getStoreDocId() {
  return cloudConfig.storeDocId || "production-progress-store";
}

function getHealthDocId() {
  return cloudConfig.healthDocId || "production-progress-health";
}

function getCloudFunctionName() {
  return cloudConfig.cloudFunctionName || "appStore";
}

function getTransportMode() {
  return cloudConfig.transport || "auto";
}

function getStorageKey() {
  return cloudConfig.storageKey || "production_progress_cloud_store";
}

function getErrorMessage(error) {
  return error && error.errMsg ? error.errMsg : (error && error.message ? error.message : String(error));
}

function getSerializableStore() {
  const normalized = normalizeStoreSnapshot(mockData).store;
  return STORE_KEYS.reduce((result, key) => {
    result[key] = clone(normalized[key]);
    return result;
  }, {});
}

function normalizeStoreSnapshot(snapshot = {}) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const store = {};
  const report = {
    ok: true,
    version: STORE_SCHEMA_VERSION,
    missingKeys: [],
    repairedKeys: [],
    typeIssues: [],
    unknownKeys: []
  };

  STORE_ARRAY_KEYS.forEach((key) => {
    if (source[key] === undefined) {
      store[key] = [];
      report.missingKeys.push(key);
      report.repairedKeys.push(key);
    } else if (Array.isArray(source[key])) {
      store[key] = clone(source[key]);
    } else {
      store[key] = [];
      report.typeIssues.push({ key, expected: "array", actual: typeof source[key] });
      report.repairedKeys.push(key);
    }
  });

  STORE_OBJECT_KEYS.forEach((key) => {
    if (source[key] === undefined) {
      store[key] = {};
      report.missingKeys.push(key);
      report.repairedKeys.push(key);
    } else if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      store[key] = clone(source[key]);
    } else {
      store[key] = {};
      report.typeIssues.push({ key, expected: "object", actual: Array.isArray(source[key]) ? "array" : typeof source[key] });
      report.repairedKeys.push(key);
    }
  });

  Object.keys(source).forEach((key) => {
    if (!STORE_ARRAY_KEYS.includes(key) && !STORE_OBJECT_KEYS.includes(key)) {
      report.unknownKeys.push(key);
    }
  });

  report.ok = report.typeIssues.length === 0;
  return { store, report };
}

function applyStoreSnapshot(snapshot = {}) {
  const normalized = normalizeStoreSnapshot(snapshot);
  const store = normalized.store;
  lastSchemaReport = normalized.report;
  STORE_KEYS.forEach((key) => {
    mockData[key] = clone(store[key]);
  });
  return mockData;
}

function getStore() {
  return mockData;
}

function setSyncEnabled(enabled) {
  syncEnabled = !!enabled;
}

function getLocalCache() {
  if (typeof wx === "undefined" || !wx.getStorageSync) return null;
  try {
    return wx.getStorageSync(getStorageKey()) || null;
  } catch (error) {
    return null;
  }
}

function setLocalCache(snapshot) {
  if (typeof wx === "undefined" || !wx.setStorageSync) return;
  try {
    wx.setStorageSync(getStorageKey(), snapshot);
  } catch (error) {
    // Local cache is only a startup accelerator; cloud sync remains authoritative.
  }
}

function getStoreDoc() {
  if (!cloudDb) return null;
  return cloudDb.collection(getStoreCollection()).doc(getStoreDocId());
}

function getHealthDoc() {
  if (!cloudDb) return null;
  return cloudDb.collection(getStoreCollection()).doc(getHealthDocId());
}

function docGet(doc) {
  return new Promise((resolve, reject) => {
    doc.get({
      success: resolve,
      fail: reject
    });
  });
}

function docSet(doc, data) {
  return new Promise((resolve, reject) => {
    doc.set({
      data,
      success: resolve,
      fail: reject
    });
  });
}

function canCallCloudFunction() {
  return hasCloudRuntime() && typeof wx.cloud.callFunction === "function";
}

function callCloudFunction(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: getCloudFunctionName(),
      data: {
        action,
        collection: getStoreCollection(),
        storeDocId: getStoreDocId(),
        healthDocId: getHealthDocId(),
        ...data
      },
      success: (res) => {
        const result = (res && res.result) || {};
        if (result.ok === false) {
          reject(new Error(result.message || "Cloud function " + action + " failed."));
          return;
        }
        resolve(result);
      },
      fail: reject
    });
  });
}

function shouldFallbackToDirect(error) {
  if (getTransportMode() !== "auto") return false;
  const message = getErrorMessage(error).toLowerCase();
  return message.indexOf("not found") >= 0 ||
    message.indexOf("function") >= 0 ||
    message.indexOf("cloud function") >= 0 ||
    message.indexOf("errcode: -501000") >= 0 ||
    message.indexOf("errcode: -504002") >= 0;
}

function withCloudFunctionFallback(action, data, directRunner) {
  const mode = getTransportMode();
  if ((mode === "function" || mode === "auto") && canCallCloudFunction()) {
    return callCloudFunction(action, data).catch((error) => {
      if (shouldFallbackToDirect(error)) {
        return directRunner({ fallbackFromFunction: getErrorMessage(error) });
      }
      throw error;
    });
  }
  if (mode === "function") {
    return Promise.reject(new Error("wx.cloud.callFunction is not available in the current runtime."));
  }
  return directRunner({});
}

function readStoreSnapshot() {
  return withCloudFunctionFallback("getStore", {}, () => (
    docGet(getStoreDoc()).then((res) => ({
      ok: true,
      exists: true,
      data: (res && res.data) || null
    }))
  ));
}

function writeStoreSnapshot(payload) {
  return withCloudFunctionFallback("saveStore", payload, () => (
    docSet(getStoreDoc(), {
      store: payload.store || {},
      updatedAt: getServerDate(),
      updatedAtText: payload.updatedAtText,
      reason: payload.reason,
      version: payload.version || 1
    }).then((res) => ({
      ok: true,
      updatedAtText: payload.updatedAtText,
      res
    }))
  ));
}

function runHealthCheck(payload) {
  return withCloudFunctionFallback("health", payload, () => (
    docSet(getHealthDoc(), payload.healthPayload)
      .then(() => docGet(getHealthDoc()))
      .then((healthRead) => docGet(getStoreDoc())
        .then((storeRead) => ({
          ok: true,
          healthRead,
          storeRead,
          storeError: null
        }))
        .catch((storeError) => ({
          ok: true,
          healthRead,
          storeRead: null,
          storeError
        }))
      )
  ));
}

function getServerDate() {
  if (cloudDb && cloudDb.serverDate) return cloudDb.serverDate();
  return new Date().toISOString();
}


// ---- Local mock implementations (when wx.cloud unavailable) ----


// Read all records from a local mock collection (storage keys matching prefix).
function _localMockReadCollection(key, collectionName) {
  return Promise.resolve().then(function() {
    var records = [];
    if (typeof wx === "undefined" || !wx.getStorageInfoSync) {
      return { key: key, collection: collectionName, ok: true, records: records };
    }
    try {
      var info = wx.getStorageInfoSync();
      var prefix = LOCAL_MOCK_PREFIX + collectionName + "/";
      (info.keys || []).forEach(function(storageKey) {
        if (storageKey.indexOf(prefix) === 0) {
          var raw = wx.getStorageSync(storageKey);
          if (raw) {
            try {
              var doc = JSON.parse(raw);
              delete doc._sourceKey;
              records.push(doc);
            } catch (e) { /* skip corrupt */ }
          }
        }
      });
    } catch (e) { /* storage info not available */ }
    return { key: key, collection: collectionName, ok: true, records: records };
  });
}


function _localMockReadStoreSnapshot() {
  return Promise.resolve().then(function() {
    var doc = localMockGet(getStoreCollection(), getStoreDocId());
    if (doc) {
      return { ok: true, exists: true, data: doc };
    }
    return { ok: true, exists: false, data: null };
  });
}

function _localMockWriteStoreSnapshot(payload) {
  return Promise.resolve().then(function() {
    var data = {
      store: payload.store || {},
      updatedAt: new Date().toISOString(),
      updatedAtText: payload.updatedAtText || new Date().toISOString(),
      reason: payload.reason || "local-mock-save",
      version: payload.version || 1
    };
    localMockSet(getStoreCollection(), getStoreDocId(), data);
    return { ok: true, updatedAtText: data.updatedAtText };
  });
}
// ---- Detail collections (parallel read/write) ----

// Returns the detail collection keys that are enabled for parallel write.
function getDetailKeys() {
  return STORE_ARRAY_KEYS.filter((key) => !!STORE_KEY_TO_COLLECTION[key]);
}

// Write each store array to its own detail collection.
// Each record must have an "id" field used as the document _id.
// Records missing "id" are skipped with a warning.
// Returns { ok, written: number, errors: string[], collections: string[] }
function writeDetailCollections(store = {}) {
  if (!cloudDb || !detailCollectionsEnabled) {
    return Promise.resolve({ ok: false, message: "Detail collections disabled or cloud DB not ready." });
  }

  const keys = getDetailKeys();
  const now = getServerDate();
  const promises = keys.map((key) => {
    const collectionName = STORE_KEY_TO_COLLECTION[key];
    const records = Array.isArray(store[key]) ? store[key] : [];
    if (!records.length) {
      return Promise.resolve({ collection: collectionName, ok: true, written: 0, skipped: 0 });
    }

    const valid = [];
    const skipped = [];
    records.forEach((rec) => {
      if (rec && rec.id) {
        valid.push(rec);
      } else {
        skipped.push(rec);
      }
    });

    if (!valid.length) {
      return Promise.resolve({ collection: collectionName, ok: true, written: 0, skipped: skipped.length });
    }

    // Use Promise.all to write each record individually.
    // We don't delete old records here — this is a best-effort upsert.
    const writes = valid.map((rec) => {
      const docId = String(rec.id);
      const data = { ...clone(rec), _updatedAt: now, _sourceKey: key };
      return new Promise((resolve) => {
        cloudDb.collection(collectionName).doc(docId).set({ data })
          .then(() => resolve({ ok: true }))
          .catch(() => {
            // If doc doesn't exist, try add; if duplicate, that's ok.
            cloudDb.collection(collectionName).add({ data: { ...data, _id: docId } })
              .then(() => resolve({ ok: true }))
              .catch((err) => resolve({ ok: false, message: getErrorMessage(err) }));
          });
      });
    });

    return Promise.all(writes).then((results) => {
      const failed = results.filter((r) => !r.ok);
      return {
        collection: collectionName,
        ok: failed.length === 0,
        written: results.length - failed.length,
        skipped: skipped.length,
        errors: failed.map((r) => r.message).filter(Boolean)
      };
    });
  });

  return Promise.all(promises).then((results) => ({
    ok: results.every((r) => r.ok),
    collections: results.map((r) => r.collection),
    written: results.reduce((sum, r) => sum + (r.written || 0), 0),
    errors: results.reduce((list, r) => list.concat(r.errors || []), [])
  }));
}

// Read all detail collections and assemble into a store snapshot.
// Returns { ok, store: { key: array }, detailLoaded: boolean, errors: string[] }
function readDetailCollections() {
  if (!cloudDb || !detailCollectionsEnabled) {
    return Promise.resolve({ ok: false, detailLoaded: false, store: {} });
  }

  const keys = getDetailKeys();
  const promises = keys.map((key) => {
    const collectionName = STORE_KEY_TO_COLLECTION[key];
    return new Promise((resolve) => {
      cloudDb.collection(collectionName).where({ _sourceKey: key }).get()
        .then((res) => {
          const records = (res && res.data) ? res.data.map((doc) => {
            const obj = clone(doc);
            delete obj._id;
            delete obj._updatedAt;
            delete obj._sourceKey;
            return obj;
          }) : [];
          resolve({ key, collection: collectionName, ok: true, records });
        })
        .catch((err) => {
          resolve({ key, collection: collectionName, ok: false, records: [], message: getErrorMessage(err) });
        });
    });
  });

  return Promise.all(promises).then((results) => {
    const store = {};
    const errors = [];
    let hasData = false;

    results.forEach((r) => {
      store[r.key] = r.records || [];
      if (r.records && r.records.length > 0) hasData = true;
      if (!r.ok) errors.push(r.message || "Failed to read " + r.collection);
    });

    // Fill object keys with empty defaults since they live in snapshot only.
    STORE_OBJECT_KEYS.forEach((k) => { store[k] = {}; });
    // Fill dispatchTasks since it is snapshot-only.
    store.dispatchTasks = [];

    return {
      ok: errors.length === 0,
      store,
      detailLoaded: hasData,
      errors
    };
  });
}

// ---- Core persistence ----

function loadStoreFromCloud() {
  if (!isReady()) {
    return Promise.resolve({ ok: false, message: "Cloud data backend is not ready." });
  }

  loadState = "loading";
  lastError = "";

  // Strategy: try detail collections first. If they have data, use them.
  // Otherwise fall back to snapshot document.
  function loadFromDetailFallback() {
    return readDetailCollections().then((detailResult) => {
      if (detailResult.ok && detailResult.detailLoaded) {
        const store = detailResult.store;
        applyStoreSnapshot(store);
        storeVersion = STORE_SCHEMA_VERSION;
        lastSyncAt = new Date().toISOString();
        lastLoadAt = lastSyncAt;
        setLocalCache({ store: getSerializableStore(), updatedAt: lastSyncAt });
        loadState = "loaded";
        const result = { ok: true, source: "detail-collections", store: mockData };
        emitChange("cloud-load", result);
        return result;
      }

      // Detail collections empty or failed → fall back to snapshot
      return readStoreSnapshot()
        .then((res) => {
          const data = (res && res.data) || {};
          if (data.store) {
            const normalized = normalizeStoreSnapshot(data.store);
            applyStoreSnapshot(data.store);
            storeVersion = data.version || STORE_SCHEMA_VERSION;
            lastSchemaReport = normalized.report;
            lastSyncAt = data.updatedAtText || data.updatedAt || new Date().toISOString();
            lastLoadAt = new Date().toISOString();
            setLocalCache({ store: getSerializableStore(), updatedAt: lastSyncAt });
            loadState = "loaded";
            const result = { ok: true, source: "snapshot", store: mockData, schema: normalized.report };
            emitChange("cloud-load", result);
            return result;
          }

          loadState = "empty";
          if (cloudConfig.seedFromMockWhenEmpty) {
            return persistStore("seed").then((syncResult) => {
              lastLoadAt = new Date().toISOString();
              const result = { ok: syncResult.ok, source: "seed", store: mockData, syncResult };
              emitChange("cloud-seed", result);
              return result;
            });
          }
          lastLoadAt = new Date().toISOString();
          const result = { ok: true, source: "empty", store: mockData };
          emitChange("cloud-empty", result);
          return result;
        })
        .catch((error) => {
          const message = getErrorMessage(error);
          if (/not exist|does not exist|document not found/i.test(message) && cloudConfig.seedFromMockWhenEmpty) {
            loadState = "empty";
            return persistStore("seed").then((syncResult) => {
              lastLoadAt = new Date().toISOString();
              const result = { ok: syncResult.ok, source: "seed", store: mockData, syncResult };
              emitChange("cloud-seed", result);
              return result;
            });
          }
          loadState = "error";
          lastError = message;
          const result = { ok: false, message };
          emitChange("cloud-load-error", result);
          return result;
        });
    });
  }

  return loadFromDetailFallback();
}

function persistStore(reason = "manual") {
  if (!isReady()) {
    return Promise.resolve({ ok: false, message: "Cloud data backend is not ready." });
  }

  syncState = "syncing";
  lastError = "";
  const snapshot = getSerializableStore();
  const updatedAt = new Date().toISOString();
  storeVersion += 1;
  setLocalCache({ store: snapshot, updatedAt, version: storeVersion });

  return writeStoreSnapshot({
    store: snapshot,
    updatedAtText: updatedAt,
    reason,
    version: storeVersion
  }).then((res) => {
    lastSyncAt = updatedAt;
    syncState = "synced";
    lastError = "";

    // Best-effort: also write to detail collections in parallel.
    // Detail write failures do not block the overall sync result.
    const detailPromise = writeDetailCollections(snapshot).then((detailResult) => {
      if (!detailResult.ok) {
        // Log but don't fail the overall sync.
      }
      return detailResult;
    }).catch(() => ({ ok: false }));

    const result = { ok: true, updatedAt, version: storeVersion, res };
    emitChange(reason || "cloud-sync", result);

    return detailPromise.then(() => result);
  }).catch((error) => {
    lastError = getErrorMessage(error);
    syncState = "error";
    const result = { ok: false, message: lastError };
    emitChange("cloud-sync-error", result);
    return result;
  });
}

function initCloud(options = {}) {
  if (!cloudConfig.enabled) {
    ready = false;
    lastError = "Cloud backend is disabled in services/cloud-config.js.";
    return { ok: false, ready, message: lastError };
  }

  // Real cloud runtime available.
  if (hasCloudRuntime()) {
    return _initRealCloud(options);
  }

  // No real cloud runtime — activate local mock cloud storage.
  return _initLocalMockCloud(options);
}

function _initRealCloud(options = {}) {

  initialized = true;
  const envId = getEnvId();
  try {
    if (typeof wx.cloud.init === "function") {
      wx.cloud.init({
        env: envId || undefined,
        traceUser: false
      });
    }
    if (typeof wx.cloud.database === "function") {
      cloudDb = wx.cloud.database();
    }
    ready = !!cloudDb;

    if (ready) {
      // Restore version from local cache.
      const cached = getLocalCache();
      storeVersion = (cached && cached.version) || 0;

      if (cached && cached.store) {
        applyStoreSnapshot(cached.store);
        lastSyncAt = cached.updatedAt || lastSyncAt;
      }

      loadStoreFromCloud();
      return { ok: true, ready, envId, loadState };
    } else {
      lastError = "wx.cloud.database() returned null.";
      return { ok: false, ready, message: lastError };
    }
  } catch (error) {
    ready = false;
    lastError = error && error.message ? error.message : String(error);
    return { ok: false, ready, message: lastError };
  }
}

function isReady() {
  return ready && !!cloudDb;
}

function checkCloudHealth() {
  const checkedAt = new Date().toISOString();
  const result = {
    ok: false,
    checkedAt,
    envId: getEnvId(),
    collection: getStoreCollection(),
    storeDocId: getStoreDocId(),
    healthDocId: getHealthDocId(),
    schema: clone(lastSchemaReport),
    steps: []
  };

  const pushStep = (key, ok, message = "") => {
    result.steps.push({ key, ok: !!ok, message });
    return ok;
  };

  if (!cloudConfig.enabled) {
    pushStep("config", false, "Cloud backend is disabled in services/cloud-config.js.");
    healthState = "error";
    lastHealthAt = checkedAt;
    lastHealthResult = result;
    lastError = result.steps[0].message;
    emitChange("cloud-health-error", result);
    return Promise.resolve(result);
  }

  if (!isReady()) {
    const initResult = initCloud();
    pushStep("init", initResult.ok, initResult.message || "");
    if (!initResult.ok) {
      healthState = "error";
      lastHealthAt = checkedAt;
      lastHealthResult = result;
      lastError = initResult.message || "Cloud init failed.";
      emitChange("cloud-health-error", result);
      return Promise.resolve(result);
    }
  } else {
    pushStep("init", true, "");
  }

  healthState = "checking";
  const healthPayload = {
    checkedAt,
    envId: getEnvId(),
    storeDocId: getStoreDocId(),
    version: 1
  };

  return runHealthCheck({ healthPayload })
    .then((res) => {
      if (res && res.healthReadOk !== undefined) {
        pushStep("health-write", true, "Cloud function.");
        pushStep("health-read", !!res.healthReadOk, res.healthReadOk ? "Cloud function." : "Health document content mismatch.");
        pushStep("store-read", !!res.storeExists, res.storeExists ? (res.storeHasSnapshot ? "Store snapshot exists." : "Store document exists but snapshot is empty.") : (res.storeMessage || "Store document not found."));
        if (res.storeHasSnapshot && res.schema) {
          const schema = res.schema;
          result.schema = schema;
          pushStep("schema", schema.ok, schema.ok ? "Store schema ok." : "Store schema repaired " + schema.repairedKeys.length + " field(s).");
        }
        result.storeExists = !!res.storeExists;
        result.storeHasSnapshot = !!res.storeHasSnapshot;
        result.transport = "function";
        return result;
      }

      pushStep("health-write", true, "");
      const data = (res.healthRead && res.healthRead.data) || {};
      pushStep("health-read", data.checkedAt === checkedAt, data.checkedAt === checkedAt ? "" : "Health document content mismatch.");
      if (res.storeError) {
        pushStep("store-read", false, getErrorMessage(res.storeError));
        result.storeExists = false;
        result.storeHasSnapshot = false;
      } else {
        const store = (res.storeRead && res.storeRead.data) || {};
        pushStep("store-read", true, store.store ? "Store snapshot exists." : "Store document exists but snapshot is empty.");
        if (store.store) {
          const schema = normalizeStoreSnapshot(store.store).report;
          result.schema = schema;
          pushStep("schema", schema.ok, schema.ok ? "Store schema ok." : "Store schema repaired " + schema.repairedKeys.length + " field(s).");
        }
        result.storeExists = true;
        result.storeHasSnapshot = !!store.store;
      }
      result.transport = "direct";
      return result;
    })
    .catch((error) => {
      pushStep("health-check", false, getErrorMessage(error));
      return result;
    })
    .then((finalResult) => {
      const requiredStepsOk = finalResult.steps
        .filter((step) => step.key !== "store-read")
        .every((step) => step.ok);
      finalResult.ok = requiredStepsOk;
      healthState = finalResult.ok ? "ok" : "error";
      lastHealthAt = checkedAt;
      lastHealthResult = clone(finalResult);
      lastError = finalResult.ok ? "" : ((finalResult.steps.find((step) => !step.ok) || {}).message || "Cloud health check failed.");
      emitChange(finalResult.ok ? "cloud-health-ok" : "cloud-health-error", finalResult);
      return finalResult;
    });
}

function schedulePersist(reason = "write") {
  if (!syncEnabled || !isReady()) return { ok: false, scheduled: false };
  pendingReason = reason || pendingReason || "write";
  syncState = "pending";
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    const reasonText = pendingReason;
    pendingTimer = null;
    pendingReason = "";
    persistStore(reasonText);
  }, Math.max(Number(cloudConfig.syncDebounceMs || 800), 0));
  return { ok: true, scheduled: true };
}

function getBackendInfo() {
  return {
    name: "cloud",
    ready: isReady(),
    initialized,
    syncEnabled,
    loadState,
    lastError,
    lastLoadAt,
    lastSyncAt,
    syncState,
    healthState,
    lastHealthAt,
    lastHealthResult: clone(lastHealthResult),
    lastSchemaReport: clone(lastSchemaReport),
    schemaVersion: STORE_SCHEMA_VERSION,
    revision,
    storeVersion,
    hasPendingSync: !!pendingTimer,
    pendingReason,
    detailCollectionsEnabled,
    envId: getEnvId(),
    transport: getTransportMode(),
    cloudFunctionName: getCloudFunctionName(),
    storeCollection: getStoreCollection(),
    storeDocId: getStoreDocId(),
    healthDocId: getHealthDocId(),
    collections: { ...COLLECTIONS }
  };
}

module.exports = {
  COLLECTIONS,
  STORE_KEYS,
  STORE_SCHEMA_VERSION,
  initCloud,
  isReady,
  getStore,
  getSerializableStore,
  normalizeStoreSnapshot,
  applyStoreSnapshot,
  loadStoreFromCloud,
  persistStore,
  schedulePersist,
  checkCloudHealth,
  setSyncEnabled,
  subscribeChange,
  getBackendInfo,
  // Detail collections
  writeDetailCollections,
  readDetailCollections
};
