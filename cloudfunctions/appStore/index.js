const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const DEFAULT_COLLECTION = "appStores";
const DEFAULT_STORE_DOC_ID = "production-progress-store";
const DEFAULT_HEALTH_DOC_ID = "production-progress-health";
const STORE_ARRAY_KEYS = [
  "users",
  "departments",
  "projects",
  "devices",
  "qbList",
  "tasks",
  "dispatchTasks",
  "importLogs",
  "operationLogs"
];
const STORE_OBJECT_KEYS = [
  "processMap",
  "dictionaries",
  "electricalParamValues",
  "qbDetails",
  "importPreview"
];
const STORE_SCHEMA_VERSION = 1;

function nowText() {
  return new Date().toISOString();
}

function getCollection(event = {}) {
  return event.collection || DEFAULT_COLLECTION;
}

function getStoreDocId(event = {}) {
  return event.storeDocId || DEFAULT_STORE_DOC_ID;
}

function getHealthDocId(event = {}) {
  return event.healthDocId || DEFAULT_HEALTH_DOC_ID;
}

function getDoc(event = {}, docId) {
  return db.collection(getCollection(event)).doc(docId);
}

function normalizeStoreSnapshot(snapshot = {}) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
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
      report.missingKeys.push(key);
      report.repairedKeys.push(key);
    } else if (!Array.isArray(source[key])) {
      report.typeIssues.push({ key, expected: "array", actual: typeof source[key] });
      report.repairedKeys.push(key);
    }
  });

  STORE_OBJECT_KEYS.forEach((key) => {
    if (source[key] === undefined) {
      report.missingKeys.push(key);
      report.repairedKeys.push(key);
    } else if (!source[key] || typeof source[key] !== "object" || Array.isArray(source[key])) {
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
  return report;
}

async function getStore(event = {}) {
  const docId = getStoreDocId(event);
  try {
    const res = await getDoc(event, docId).get();
    return {
      ok: true,
      exists: true,
      data: res.data || null
    };
  } catch (error) {
    return {
      ok: false,
      exists: false,
      code: error.errCode || error.code || "",
      message: error.errMsg || error.message || String(error)
    };
  }
}

async function saveStore(event = {}) {
  const docId = getStoreDocId(event);
  const updatedAtText = event.updatedAtText || nowText();
  await getDoc(event, docId).set({
    data: {
      store: event.store || {},
      updatedAt: db.serverDate(),
      updatedAtText,
      reason: event.reason || "cloud-function-save",
      version: event.version || 1
    }
  });
  return {
    ok: true,
    docId,
    updatedAtText
  };
}

async function health(event = {}, context = {}) {
  const checkedAt = nowText();
  const docId = getHealthDocId(event);
  const healthPayload = {
    checkedAt,
    openid: context.OPENID || "",
    appid: context.APPID || "",
    env: context.ENV || "",
    storeDocId: getStoreDocId(event),
    version: 1
  };

  await getDoc(event, docId).set({
    data: healthPayload
  });
  const healthRead = await getDoc(event, docId).get();
  const storeResult = await getStore(event);

  return {
    ok: true,
    checkedAt,
    healthDocId: docId,
    healthReadOk: !!(healthRead && healthRead.data && healthRead.data.checkedAt === checkedAt),
    storeExists: !!storeResult.exists,
    storeHasSnapshot: !!(storeResult.data && storeResult.data.store),
    schema: storeResult.data && storeResult.data.store ? normalizeStoreSnapshot(storeResult.data.store) : null,
    storeMessage: storeResult.message || ""
  };
}

async function login(event = {}, context = {}) {
  const checkedAt = nowText();
  const openid = (context && context.OPENID) || "";

  if (!openid) {
    return {
      ok: false,
      code: "NO_OPENID",
      message: "Unable to obtain openid from cloud context."
    };
  }

  // 1. Try users collection (future path, gracefully skip if not exists)
  let userFromCollection = null;
  try {
    const userRes = await db.collection("users")
      .where({ openid })
      .limit(1)
      .get();
    if (userRes.data && userRes.data.length > 0) {
      userFromCollection = userRes.data[0];
      userFromCollection._source = "users-collection";
    }
  } catch (_err) {
    // users collection may not exist yet; fall through to store snapshot.
  }

  // 2. Fall back to store snapshot users
  let userFromStore = null;
  try {
    const storeRes = await getStore(event);
    if (storeRes.exists && storeRes.data && storeRes.data.store) {
      const store = storeRes.data.store;
      const users = Array.isArray(store.users) ? store.users : [];
      userFromStore = users.find((u) => u.openid === openid) || null;
      if (userFromStore) {
        userFromStore._source = "store-snapshot";
      }
    }
  } catch (_err) {
    // Store read failed; skip.
  }

  const matchedUser = userFromCollection || userFromStore || null;

  // 3. Auto-link: if user exists in store without openid, patch it
  if (!matchedUser && !userFromCollection) {
    try {
      const storeRes = await getStore(event);
      if (storeRes.exists && storeRes.data && storeRes.data.store) {
        const store = storeRes.data.store;
        const users = Array.isArray(store.users) ? store.users.slice() : [];
        const matchByName = event.autoLinkName || "";
        const matchByPhone = event.autoLinkPhone || "";
        let index = -1;
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          if (
            (matchByName && u.name === matchByName) ||
            (matchByPhone && u.phone === matchByPhone)
          ) {
            index = i;
            break;
          }
        }
        if (index >= 0) {
          users[index] = { ...users[index], openid };
          await saveStore({
            ...event,
            store,
            reason: "login-auto-link-openid"
          });
          const linked = users[index];
          linked._source = "store-snapshot-auto-linked";
          return {
            ok: true,
            openid,
            checkedAt,
            user: linked,
            linked: true,
            message: "User auto-linked via name/phone."
          };
        }
      }
    } catch (_err) {
      // Auto-link failed; fall through.
    }
  }

  return {
    ok: !!matchedUser,
    openid,
    checkedAt,
    user: matchedUser || null,
    linked: false,
    message: matchedUser
      ? matchedUser._source === "users-collection"
        ? "User matched from users collection."
        : "User matched from store snapshot."
      : "No matching user found for this openid."
  };
}

async function downloadTemplateFile(event = {}) {
  const fileID = String(event.fileID || "").trim();
  if (!fileID || !/\/templates\/progress-import-v4\.xlsx$/.test(fileID)) {
    return {
      ok: false,
      message: "Invalid template fileID."
    };
  }

  const res = await cloud.downloadFile({ fileID });
  const fileContent = res && res.fileContent;
  if (!fileContent) {
    return {
      ok: false,
      message: "Template file is empty."
    };
  }

  return {
    ok: true,
    fileName: "progress-import-v4.xlsx",
    encoding: "base64",
    contentBase64: Buffer.from(fileContent).toString("base64")
  };
}

exports.main = async (event = {}, context = {}) => {
  const wxContext = cloud.getWXContext ? cloud.getWXContext() : context;
  const action = event.action || "";

  try {
    if (action === "getStore") {
      return await getStore(event);
    }
    if (action === "saveStore") {
      return await saveStore(event);
    }
    if (action === "health") {
      return await health(event, wxContext);
    }
    if (action === "login") {
      return await login(event, wxContext);
    }
    if (action === "downloadTemplateFile") {
      return await downloadTemplateFile(event);
    }
    return {
      ok: false,
      message: "Unsupported action: " + action
    };
  } catch (error) {
    return {
      ok: false,
      code: error.errCode || error.code || "",
      message: error.errMsg || error.message || String(error)
    };
  }
};
