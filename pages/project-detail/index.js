const authService = require("../../services/auth-service");
const attachmentService = require("../../services/attachment-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    currentUser: {},
    canCreateQb: false,
    activeTab: "设备进度",
    tabs: ["设备进度", "QB异常", "附件"],
    project: {},
    projectNo: "",
    loadError: "",
    devices: [],
    expandedDevices: {},
    qbList: [],
    attachments: [],
    isUploadingAtt: false,
    uploadProgress: 0,
    uploadTotal: 0,
    cloudUploadEnabled: false
  },

  onLoad(options) {
    const projectNo = decodeURIComponent(options.projectNo || "");
    if (!projectNo) {
      this.setData({ loadError: "缺少项目编号，请从项目列表重新进入。" });
      wx.showToast({ title: "缺少项目编号", icon: "none" });
      return;
    }
    this.setData({ projectNo });
    this.loadProject(projectNo);
    this.checkCloudReady();
  },

  checkCloudReady() {
    const backend = dataService.getBackendInfo();
    const cloudReady = backend.active === "cloud" && backend.cloud && backend.cloud.ready;
    this.setData({ cloudUploadEnabled: cloudReady });
  },

  loadProject(projectNo) {
    const project = dataService.getProject(projectNo);
    if (!project || project.projectNo !== projectNo) {
      this.setData({
        project: {},
        devices: [],
        qbList: [],
        loadError: "未找到该项目，请返回项目列表确认。"
      });
      return;
    }
    const devices = dataService.getDevicesByProject(projectNo);
    this.setData({
      loadError: "",
      project: {
        ...project,
        productLine: "除湿机",
        deviceCount: devices.length,
        delayedCount: project.delayed,
      },
      devices,
      qbList: dataService.listQb({ projectNo })
    });
  },

  onShow() {
    const user = authService.getCurrentUser();
    this.setData({
      currentUser: user,
      canCreateQb: permissionService.canCreateQb(user)
    });
    if (this.data.projectNo) {
      this.loadProject(this.data.projectNo);
    }
    this.checkCloudReady();
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.value });
  },

  openDevice(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: "设备标识缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/device-detail/index?id=" + encodeURIComponent(id)
    });
  },

  toggleDeviceProcesses(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({
      ["expandedDevices." + id]: !this.data.expandedDevices[id]
    });
  },

  addDevice() {
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/device-edit/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  editProject() {
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/project-edit/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  openDispatch() {
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/project-dispatch/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  archiveProject() {
    wx.showModal({
      title: "归档项目",
      content: "归档后项目将从默认列表隐藏，可在已归档筛选中查看。",
      confirmText: "归档",
      success: (res) => {
        if (!res.confirm) return;
        if (!this.data.project.projectNo) {
          wx.showToast({ title: "项目编号缺失", icon: "none" });
          return;
        }
        const result = dataService.archiveProject(this.data.project.projectNo);
        wx.showToast({
          title: result.ok ? "已归档" : result.message,
          icon: result.ok ? "success" : "none"
        });
        if (result.ok) {
          setTimeout(() => wx.navigateBack(), 700);
        }
      }
    });
  },

  deleteProject() {
    wx.showModal({
      title: "删除项目",
      content: "删除会移除项目、设备、工序、参数、派单、任务和QB记录。此操作仅影响当前运行时 mock 数据。",
      confirmText: "删除",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        if (!this.data.project.projectNo) {
          wx.showToast({ title: "项目编号缺失", icon: "none" });
          return;
        }
        const result = dataService.deleteProject(this.data.project.projectNo);
        wx.showToast({
          title: result.ok ? "已删除" : result.message,
          icon: result.ok ? "success" : "none"
        });
        if (result.ok) {
          setTimeout(() => wx.navigateBack(), 700);
        }
      }
    });
  },

  addQb() {
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/qb-create/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  openQb(e) {
    const qbNo = e.currentTarget.dataset.no;
    if (!qbNo) {
      wx.showToast({ title: "QB编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/qb-detail/index?qbNo=" + encodeURIComponent(qbNo)
    });
  },

  chooseAttachment() {
    attachmentService.chooseAttachments({ count: 9 })
      .then((files) => {
        if (!files.length) return;
        this.setData({ attachments: this.data.attachments.concat(files) });
      })
      .catch(() => wx.showToast({ title: "未选择附件", icon: "none" }));
  },

  previewAttachment(e) {
    const index = e.currentTarget.dataset.index;
    attachmentService.previewAttachment(this.data.attachments[index], this.data.attachments);
  },

  removeAttachment(e) {
    const index = e.currentTarget.dataset.index;
    const attachments = this.data.attachments.slice();
    attachments.splice(index, 1);
    this.setData({ attachments });
  },

  uploadAttachments() {
    const localFiles = this.data.attachments.filter(f => !f.uploaded);
    if (!localFiles.length) {
      wx.showToast({ title: "所有附件已在云端", icon: "none" });
      return;
    }
    if (this.data.isUploadingAtt) return;

    this.setData({ isUploadingAtt: true, uploadProgress: 0, uploadTotal: localFiles.length });
    const prefix = "projects/" + (this.data.projectNo || "unknown") + "/";

    attachmentService.uploadFilesToCloud(localFiles, prefix, (progress) => {
      this.setData({ uploadProgress: progress.index + 1 });
    }).then((result) => {
      const uploaded = result.files || [];
      const existing = this.data.attachments.filter(f => f.uploaded);
      this.setData({
        attachments: existing.concat(uploaded),
        isUploadingAtt: false
      });
      if (result.ok) {
        wx.showToast({ title: result.allRetried ? "上传完成（部分重试）" : "上传完成", icon: "success" });
      } else {
        wx.showToast({ title: "部分上传失败，请重试", icon: "none" });
      }
    }).catch(() => {
      this.setData({ isUploadingAtt: false });
      wx.showToast({ title: "上传失败", icon: "none" });
    });
  },

  previewCloudFile(e) {
    const index = e.currentTarget.dataset.index;
    const file = this.data.attachments[index];
    if (!file || !file.cloudFileID) {
      attachmentService.previewAttachment(file, this.data.attachments);
      return;
    }
    wx.showLoading({ title: "获取预览链接" });
    attachmentService.getCloudFileTempUrl(file.cloudFileID)
      .then((result) => {
        wx.hideLoading();
        if (result.ok && result.tempFileURL) {
          if (file.type === "image") {
            wx.previewImage({ current: result.tempFileURL, urls: [result.tempFileURL] });
          } else {
            wx.setClipboardData({
              data: result.tempFileURL,
              success: () => wx.showToast({ title: "链接已复制", icon: "none" })
            });
          }
        } else {
          wx.showToast({ title: "获取失败", icon: "none" });
        }
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: "获取失败", icon: "none" });
      });
  }
});
