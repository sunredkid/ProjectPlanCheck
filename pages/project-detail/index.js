const authService = require("../../services/auth-service");
const attachmentService = require("../../services/attachment-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

function canEditProjectInfo(user = {}) {
  const roleText = `${user.role || ""} ${user.roleLabel || ""}`;
  return roleText.indexOf("进度管理员") >= 0 || roleText.indexOf("后台管理员") >= 0;
}

Page({
  data: {
    currentUser: {},
    canCreateQb: false,
    canEditProject: false,
    canDispatchProject: false,
    canDispatchDepartment: false,
    departmentSubmitOptions: [],
    canDepartmentSubmitProject: false,
    departmentSubmitProcess: "",
    departmentSubmitDepartment: "",
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
    shipDateHistoryVisible: false,
    shipDateHistoryRecords: [],
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
    const currentUser = authService.getCurrentUser() || {};
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
    const expandedDevices = this.data.expandedDevices || {};
    const departmentSubmitOptions = dataService.getDepartmentProjectSubmitOptions(projectNo, currentUser);
    const assignTasks = dataService.filterTasksByView("assign", currentUser) || [];
    const devices = dataService.getDevicesByProject(projectNo).map((device) => {
      const processes = (device.processes && device.processes.length ? device.processes : dataService.getProcessesByDevice(device.id))
        .map((process) => {
          const rowTask = assignTasks.find((task) => {
            const taskDevice = String(task.device || "");
            return (task.projectNo === projectNo || String(task.project || "").indexOf(projectNo) >= 0) &&
              (task.deviceId === device.id || taskDevice.indexOf(device.deviceNo || "") >= 0 || taskDevice === device.deviceNo) &&
              task.process === process.name &&
              task.department === process.department;
          });
          return {
            ...process,
            dispatchRowKey: rowTask ? rowTask.rowKey : "",
            canDepartmentDispatch: !!rowTask && process.department === currentUser.department
          };
        });
      return {
        ...device,
        processes,
        expanded: !!expandedDevices[device.id]
      };
    });
    this.setData({
      loadError: "",
      project: {
        ...project,
        productLine: "除湿机",
        deviceCount: devices.length,
        delayedCount: project.delayed,
      },
      devices,
      departmentSubmitOptions,
      canDepartmentSubmitProject: departmentSubmitOptions.length > 0,
      departmentSubmitProcess: departmentSubmitOptions[0] ? departmentSubmitOptions[0].process : "",
      departmentSubmitDepartment: departmentSubmitOptions[0] ? departmentSubmitOptions[0].department : "",
      qbList: dataService.listQb({ projectNo })
    });
  },

  onShow() {
    const user = authService.getCurrentUser();
    const canProjectLevelManage = permissionService.canDispatchProject(user) && canEditProjectInfo(user);
    this.setData({
      currentUser: user,
      canCreateQb: false,
      canEditProject: canProjectLevelManage,
      canDispatchProject: canProjectLevelManage,
      canDispatchDepartment: permissionService.canDispatchDepartment(user)
    });
    if (this.data.projectNo) {
      this.loadProject(this.data.projectNo);
    }
    this.checkCloudReady();
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.value });
  },

  showShipDateHistory() {
    const records = (this.data.project && this.data.project.shipDateHistory) || [];
    if (!records.length) return;
    this.setData({
      shipDateHistoryVisible: true,
      shipDateHistoryRecords: records.map((item, index) => ({
        ...item,
        index: index + 1
      }))
    });
  },

  hideShipDateHistory() {
    this.setData({
      shipDateHistoryVisible: false,
      shipDateHistoryRecords: []
    });
  },

  noop() {},

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
    const expanded = !this.data.expandedDevices[id];
    this.setData({
      ["expandedDevices." + id]: expanded,
      devices: (this.data.devices || []).map((device) => (
        device.id === id ? { ...device, expanded } : device
      ))
    });
  },

  openDepartmentDispatch(e) {
    const rowKey = e.currentTarget.dataset.rowKey || "";
    if (!this.data.canDispatchDepartment) {
      wx.showToast({ title: "只有部门管理员可以设备派单", icon: "none" });
      return;
    }
    if (!rowKey) {
      wx.showToast({ title: "未找到待分配任务", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/department-dispatch/index?rowKey=${encodeURIComponent(rowKey)}`
    });
  },

  openProjectDepartmentProgress(e) {
    const process = e.currentTarget.dataset.process || "";
    const department = e.currentTarget.dataset.department || "";
    if (!this.data.canDispatchDepartment) {
      wx.showToast({ title: "只有部门管理员可以提交项目进度", icon: "none" });
      return;
    }
    if (!this.data.project.projectNo || !process || !department) {
      wx.showToast({ title: "项目信息缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/progress-submit/index?projectNo=${encodeURIComponent(this.data.project.projectNo)}&process=${encodeURIComponent(process)}&department=${encodeURIComponent(department)}`
    });
  },

  addDevice() {
    if (!this.data.canEditProject) {
      wx.showToast({ title: "无设备新增权限", icon: "none" });
      return;
    }
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/device-edit/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  editProject() {
    if (!this.data.canEditProject) {
      wx.showToast({ title: "无项目编辑权限", icon: "none" });
      return;
    }
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/project-edit/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  openDispatch() {
    if (!this.data.canDispatchProject) {
      wx.showToast({ title: "只有进度管理员可以派单到部门", icon: "none" });
      return;
    }
    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/project-dispatch/index?projectNo=" + encodeURIComponent(this.data.project.projectNo)
    });
  },

  deleteProject() {
    if (!this.data.canEditProject) {
      wx.showToast({ title: "无项目删除权限", icon: "none" });
      return;
    }
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
    wx.showToast({ title: dataService.getQbIntegrationInfo().message, icon: "none" });
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
