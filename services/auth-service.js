const mockUser = require("../utils/mock-user");

// ---- Runtime detection ----

function getRuntimeEnv() {
  if (typeof wx === "undefined" || !wx.getAccountInfoSync) {
    return "develop";
  }

  try {
    const accountInfo = wx.getAccountInfoSync();
    return (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) || "develop";
  } catch (error) {
    return "develop";
  }
}

function isReleaseEnv() {
  return getRuntimeEnv() === "release";
}

function isMockPreviewEnabled() {
  return getRuntimeEnv() === "develop";
}

// ---- Current user (mock fallback) ----

function getCurrentUser() {
  if (typeof wx === "undefined") {
    return mockUser.users[0];
  }
  if (!isMockPreviewEnabled()) {
    const stored = wx.getStorageSync ? wx.getStorageSync("mock_current_user") : null;
    if (stored) return mockUser.normalizeUser(stored);
    return {
      id: "",
      userId: "",
      name: "未登录",
      department: "",
      role: "临时用户",
      roleLabel: "临时用户",
      phone: "",
      status: "未绑定",
      loginDisabled: false
    };
  }
  return mockUser.getCurrentUser();
}

function setCurrentUser(user) {
  if (typeof wx === "undefined") {
    return user;
  }
  mockUser.setCurrentUser(user);
  return user;
}

function switchMockUser(userId) {
  if (!isMockPreviewEnabled()) return getCurrentUser();
  const user = mockUser.users.find((item) => item.id === userId || item.phone === userId || item.name === userId);
  if (!user) return getCurrentUser();
  return setCurrentUser(user);
}

function listPreviewUsers() {
  if (!isMockPreviewEnabled()) return [];
  return mockUser.users.slice();
}

function getCurrentPhone() {
  const user = getCurrentUser();
  return user && user.phone;
}

// ---- Real WeChat login (P2 ready, not connected yet) ----

let loginState = {
  openid: "",
  sessionKey: "",
  unionid: "",
  loginTime: "",
  loginMode: "idle"  // idle | code-ready | cloud-matched | error
};

function getLoginState() {
  return Object.assign({}, loginState);
}

function setLoginCode(code = "") {
  loginState.loginCode = code;
  loginState.loginMode = "code-ready";
  loginState.loginTime = new Date().toISOString();
}

// Called from app.js onLaunch after wx.login returns code.
// In mock mode this is a no-op placeholder.
// In cloud mode this does NOT pass `code` to the cloud function;
// wx.cloud.callFunction already injects the caller openid into context.
// The cloud function matches openid against users collection / store snapshot.
function performCloudLogin(code = "") {
  if (!code) {
    loginState.loginMode = "error";
    loginState.error = "Missing login code.";
    return Promise.resolve({ ok: false, message: "Missing login code." });
  }

  setLoginCode(code);

  // Local development path: simulate cloud login
  if (isMockPreviewEnabled()) {
    loginState.openid = "mock-openid-" + Date.now();
    loginState.loginMode = "cloud-matched";
    return Promise.resolve({
      ok: true,
      openid: loginState.openid,
      matchedUser: getCurrentUser(),
      mode: "mock"
    });
  }

  // Build auto-link hints from the current mock user, so the cloud function
  // can link an existing store-snapshot user to this openid.
  const currentUser = getCurrentUser() || {};
  const autoLinkName = currentUser.name || "";
  const autoLinkPhone = currentUser.phone || "";

  // Cloud path: call cloud function for openid-based user matching.
  if (typeof wx !== "undefined" && wx.cloud && wx.cloud.callFunction) {
    return wx.cloud.callFunction({
      name: "appStore",
      data: {
        action: "login",
        code,
        autoLinkName,
        autoLinkPhone
      }
    }).then((res) => {
      const data = (res && res.result) || {};
      loginState.openid = data.openid || "";
      loginState.loginMode = data.ok ? "cloud-matched" : "error";
      loginState.error = data.ok ? "" : (data.message || "Cloud login failed.");

      // If auto-linked on the server, the returned user now has an openid.
      if (data.linked) {
        loginState.autoLinked = true;
      }

      // Match the returned cloud user record into our local mock state.
      if (data.ok && data.user) {
        const cloudUser = data.user;
        // Try to find the same person in mock data and sync openid down.
        const mockUsers = mockUser.users;
        let matched = null;
        if (cloudUser.openid) {
          matched = mockUsers.find((u) => u.openid === cloudUser.openid);
        }
        if (!matched && cloudUser.phone) {
          matched = mockUsers.find((u) => u.phone === cloudUser.phone);
        }
        if (!matched && cloudUser.name) {
          matched = mockUsers.find((u) => u.name === cloudUser.name);
        }
        if (matched) {
          if (!matched.openid) {
            matched.openid = cloudUser.openid || loginState.openid;
          }
          setCurrentUser(matched);
        }
      }

      return {
        ok: data.ok,
        openid: loginState.openid,
        matchedUser: getCurrentUser(),
        mode: "cloud",
        linked: !!data.linked
      };
    }).catch((error) => {
      loginState.loginMode = "error";
      loginState.error = error.errMsg || error.message || String(error);
      return { ok: false, message: loginState.error, mode: "cloud-error" };
    });
  }

  // No cloud runtime: fall back to mock
  loginState.openid = "fallback-openid-" + Date.now();
  loginState.loginMode = "cloud-matched";
  return Promise.resolve({
    ok: true,
    openid: loginState.openid,
    matchedUser: getCurrentUser(),
    mode: "fallback"
  });
}

// Match a cloud user record by openid.
// In mock mode returns the first mock user.
// In cloud mode would query wx.cloud.database().collection("users").where({ openid }).
function matchCloudUserByOpenid(openid = "") {
  if (!openid) return Promise.resolve(null);

  if (!isReleaseEnv()) {
    return Promise.resolve(getCurrentUser());
  }

  if (typeof wx !== "undefined" && wx.cloud && wx.cloud.database) {
    return wx.cloud.database().collection("users")
      .where({ openid })
      .get()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          return res.data[0];
        }
        return null;
      })
      .catch(() => null);
  }

  return Promise.resolve(getCurrentUser());
}

// ---- Auth state ----

function getAuthState() {
  const user = getCurrentUser();
  const envVersion = getRuntimeEnv();
  return {
    envVersion,
    isRelease: envVersion === "release",
    mockPreviewEnabled: isMockPreviewEnabled(),
    user,
    phone: user && user.phone,
    loginMode: envVersion === "release" ? "wechat-cloud-pending" : "mock-preview",
    cloudLogin: getLoginState()
  };
}

module.exports = {
  getRuntimeEnv,
  isReleaseEnv,
  isMockPreviewEnabled,
  getAuthState,
  getCurrentUser,
  setCurrentUser,
  switchMockUser,
  listPreviewUsers,
  getCurrentPhone,
  // P2 real login
  getLoginState,
  setLoginCode,
  performCloudLogin,
  matchCloudUserByOpenid
};
