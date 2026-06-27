const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    currentUser: {},
    qb: {},
    loadError: "",
    canCloseQb: false,
    canTransferQb: true,
    canSubmitProgress: true,
    showActions: true,
    actionLayout: "one",
    linkedDevices: [],
    logs: [],
    progressText: "",
    isSubmittingProgress: false,
    isClosing: false
  },

  onLoad(options) {
    if (!options.qbNo) {
      this.setData({ loadError: "缺少 QB 编号，请从项目详情或任务列表重新进入。" });
      wx.showToast({ title: "缺少QB编号", icon: "none" });
      return;
    }
    const qbNo = decodeURIComponent(options.qbNo || "");
    const detail = dataService.getQbDetail(qbNo);
    if (!detail || !detail.qb || detail.qb.qbNo !== qbNo) {
      this.setData({ loadError: "未找到该 QB 记录，请返回后确认。" });
      wx.showToast({ title: "QB不存在", icon: "none" });
      return;
    }
    this.setData({
      loadError: "",
      qb: detail.qb,
      linkedDevices: detail.linkedDevices,
      logs: detail.logs
    });
  },

  onShow() {
    this.setData({
      currentUser: authService.getCurrentUser()
    });
    this.refreshPermission();
  },

  refreshPermission() {
    if (this.data.loadError || !this.data.qb.qbNo) return;
    const user = this.data.currentUser;
    const isQualityDept = permissionService.isQualityUser(user);
    const isInitiator = this.data.qb.initiator && this.data.qb.initiator.indexOf(user.name) !== -1;
    const isCurrentOwner = this.data.qb.currentOwner === user.name;
    const isObserver = permissionService.isObserver(user);

    const canCloseQb = isQualityDept && !isObserver;
    const canTransferQb = permissionService.canTransferQb(user, this.data.qb);

    this.setData({
      canCloseQb,
      canTransferQb,
      canSubmitProgress: !isObserver && (isCurrentOwner || isQualityDept || isInitiator),
      showActions: canTransferQb || canCloseQb,
      actionLayout: canTransferQb && canCloseQb ? "two" : "one"
    });
  },

  onProgressInput(e) {
    this.setData({ progressText: e.detail.value });
  },

  submitProgress() {
    if (this.data.isSubmittingProgress) {
      return;
    }

    if (!this.data.progressText) {
      wx.showToast({ title: "请先填写处理进展", icon: "none" });
      return;
    }

    this.setData({ isSubmittingProgress: true });
    try {
      const result = dataService.appendQbProgress(this.data.qb.qbNo, {
        user: this.data.currentUser.name,
        content: this.data.progressText
      });
      wx.showToast({ title: result.ok ? "处理进展已提交" : result.message || "提交失败", icon: result.ok ? "success" : "none" });
      if (result.ok) {
        this.setData({ progressText: "", logs: result.logs });
      }
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      this.setData({ isSubmittingProgress: false });
    }
  },

  transferQb() {
    if (!this.data.qb.qbNo) {
      wx.showToast({ title: "QB编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/qb-transfer/index?qbNo=${encodeURIComponent(this.data.qb.qbNo)}`
    });
  },

  closeQb() {
    if (this.data.isClosing) {
      return;
    }

    wx.showModal({
      title: "确认结案",
      content: "结案后表示采购部确认该异常已处理完成。",
      confirmText: "结案",
      success: (res) => {
        if (res.confirm) {
          this.setData({ isClosing: true });
          try {
            const result = dataService.closeQb(this.data.qb.qbNo, {
              user: this.data.currentUser.name
            });
            if (result.ok) {
              this.setData({ qb: result.qb, logs: result.logs });
              this.refreshPermission();
            }
            wx.showToast({ title: result.ok ? "已结案" : result.message || "结案失败", icon: result.ok ? "success" : "none" });
          } catch (error) {
            wx.showToast({ title: error.message || "结案失败", icon: "none" });
          } finally {
            this.setData({ isClosing: false });
          }
        }
      }
    });
  }
});
