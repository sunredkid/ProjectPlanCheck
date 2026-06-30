const dataService = require("./services/data-service");
const authService = require("./services/auth-service");

App({
  onLaunch() {
    this.initBackend();

    if (typeof wx !== "undefined" && wx.login) {
      wx.login({
        success: (res) => {
          const code = res.code || "";
          this.globalData.loginCode = code;
          authService.performCloudLogin(code).then((loginResult) => {
            this.globalData.cloudLoginResult = loginResult;
            if (!loginResult.ok && authService.isReleaseEnv()) {
              console.warn("[auth] Cloud login failed:", loginResult.message);
            }
            this.ensureLoginBinding();
          }).catch(() => {
            // Silent fail, user stays on mock user.
            this.ensureLoginBinding();
          });
        }
      });
    }
  },

  ensureLoginBinding() {
    if (authService.isMockPreviewEnabled()) return;
    const user = authService.getCurrentUser() || {};
    if (user.phone && user.name && user.name !== "未登录") return;
    setTimeout(() => {
      if (typeof wx !== "undefined" && wx.reLaunch) {
        wx.reLaunch({ url: "/pages/login/index" });
      }
    }, 300);
  },

  initBackend() {
    const backendResult = dataService.initCloudBackend();
    this.refreshBackendInfo(backendResult.message || "");
    return backendResult;
  },

  refreshBackendInfo(message = "") {
    const backend = dataService.getBackendInfo();
    this.globalData.backend = backend;
    this.globalData.cloudReady = backend.active === "cloud" && backend.cloud && backend.cloud.ready;
    this.globalData.cloudMessage = message || (backend.cloud && backend.cloud.lastError) || "";
    return backend;
  },

  globalData: {
    backend: null,
    cloudReady: false,
    cloudMessage: "",
    userInfo: null,
    loginCode: "",
    cloudLoginResult: null
  }
});
