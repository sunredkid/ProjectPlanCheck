const dataService = require("../../services/data-service");
const attachmentService = require("../../services/attachment-service");
const authService = require("../../services/auth-service");

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

Page({
  data: {
    task: {},
    taskRowKey: "",
    deviceId: "",
    projectNo: "",
    department: "",
    processName: "",
    submitMode: "device",
    loadError: "",
    statusOptions: ["未开始", "进行中", "已完成", "有风险", "暂停"],
    status: "已完成",
    statusLocked: true,
    actualStartDate: getTodayString(),
    actualFinishDate: getTodayString(),
    actualStartDateText: getTodayString(),
    actualFinishDateText: getTodayString(),
    quantity: "1",
    remark: "",
    attachments: [],
    isSubmitting: false,
    isUploadingAtt: false,
    uploadProgress: 0,
    uploadTotal: 0,
    unfinishedDialogVisible: false,
    unfinishedRows: []
  },

  updateDateText(update = {}) {
    const nextStartDate = Object.prototype.hasOwnProperty.call(update, "actualStartDate")
      ? update.actualStartDate
      : this.data.actualStartDate;
    const nextFinishDate = Object.prototype.hasOwnProperty.call(update, "actualFinishDate")
      ? update.actualFinishDate
      : this.data.actualFinishDate;
    return {
      ...update,
      actualStartDateText: nextStartDate || "请选择",
      actualFinishDateText: nextFinishDate || "未完成可不填"
    };
  },

  onLoad(options = {}) {
    const projectNo = decodeURIComponent(options.projectNo || "");
    const projectProcess = decodeURIComponent(options.process || "");
    const department = decodeURIComponent(options.department || "");
    if (projectNo && projectProcess && department) {
      const project = dataService.getProject(projectNo);
      if (!project || project.projectNo !== projectNo) {
        this.setData({ loadError: "项目不存在，请从项目详情重新进入。" });
        wx.showToast({ title: "项目不存在", icon: "none" });
        return;
      }
      const dispatchStartDate = dataService.getProjectDepartmentDispatchDate
        ? dataService.getProjectDepartmentDispatchDate({ projectNo, process: projectProcess, department })
        : "";
      this.setData(this.updateDateText({
        loadError: "",
        submitMode: "project",
        projectNo,
        department,
        processName: projectProcess,
        task: {
          project: `${project.projectNo} ${project.name || ""}`.trim(),
          device: "项目下全部对应设备",
          process: projectProcess,
          owner: department,
          plannedDueDate: ""
        },
        status: "已完成",
        statusLocked: true,
        actualStartDate: dispatchStartDate,
        actualFinishDate: getTodayString()
      }));
      return;
    }

    const rowKey = decodeURIComponent(options.rowKey || "");
    if (rowKey) {
      const task = dataService.getTaskByRowKey(rowKey);
      if (!task) {
        this.setData({ loadError: "未找到该任务，请从任务列表重新进入。" });
        wx.showToast({ title: "任务不存在", icon: "none" });
        return;
      }
      const assignmentStartDate = dataService.getDeviceProcessAssignmentDate
        ? dataService.getDeviceProcessAssignmentDate({
            taskRowKey: rowKey,
            deviceId: task.deviceId || "",
            process: task.process || "",
            task
          })
        : "";

      this.setData(this.updateDateText({
        loadError: "",
        task,
        taskRowKey: rowKey,
        deviceId: task.deviceId || "",
        processName: task.process || "",
        status: "已完成",
        statusLocked: true,
        actualStartDate: assignmentStartDate || task.actualStart || this.data.actualStartDate,
        actualFinishDate: task.actualFinish || this.data.actualFinishDate,
        quantity: task.quantity || this.data.quantity,
        remark: task.remark || ""
      }));
      return;
    }

    const deviceId = decodeURIComponent(options.deviceId || "");
    const processName = decodeURIComponent(options.process || "");
    const device = deviceId ? dataService.getDevice(deviceId) : null;
    const process = device && device.id === deviceId
      ? (device.processes || []).find((item) => item.name === processName)
      : null;
    if (!deviceId || !processName || !device || device.id !== deviceId || !process) {
      this.setData({ loadError: "缺少有效任务或工序信息，请从任务列表或设备详情重新进入。" });
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    const project = dataService.getProject(device.projectNo);
    const assignmentStartDate = dataService.getDeviceProcessAssignmentDate
      ? dataService.getDeviceProcessAssignmentDate({
          deviceId,
          process: process.name,
          owner: process.owner
        })
      : "";
    this.setData(this.updateDateText({
      loadError: "",
      task: {
        project: device.projectNo + " " + (project.name || ""),
        device: device.deviceNo,
        process: process.name,
        owner: process.owner,
        plannedDueDate: process.due,
        deviceId
      },
      deviceId,
      processName,
      status: process.status || this.data.status,
      statusLocked: true,
      actualStartDate: assignmentStartDate || process.actualStart || this.data.actualStartDate,
      actualFinishDate: process.actualFinish || this.data.actualFinishDate
    }));
  },

  chooseStatus(e) {
    if (this.data.statusLocked) return;
    const status = e.currentTarget.dataset.value;
    const update = { status };
    if (status === "已完成" && !this.data.actualFinishDate) {
      update.actualFinishDate = getTodayString();
    }
    if (status === "进行中" && !this.data.actualStartDate) {
      update.actualStartDate = getTodayString();
    }
    this.setData(this.updateDateText(update));
  },

  onStartDateChange(e) {
    this.setData(this.updateDateText({ actualStartDate: e.detail.value }));
  },

  onFinishDateChange(e) {
    this.setData(this.updateDateText({ actualFinishDate: e.detail.value }));
  },

  onQuantityInput(e) {
    this.setData({ quantity: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  chooseImage() {
    attachmentService.chooseAttachments({ count: 6 })
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
    const prefix = "progress/" + (this.data.deviceId || "device") + "/";

    attachmentService.uploadFilesToCloud(localFiles, prefix, (progress) => {
      this.setData({ uploadProgress: progress.index + 1 });
    }).then((result) => {
      const uploaded = result.files || [];
      const existing = this.data.attachments.filter(f => f.uploaded);
      this.setData({
        attachments: existing.concat(uploaded),
        isUploadingAtt: false
      });
      wx.showToast({ title: result.ok ? "上传完成" : "部分上传失败", icon: "none" });
    }).catch(() => {
      this.setData({ isUploadingAtt: false });
      wx.showToast({ title: "上传失败", icon: "none" });
    });
  },

  acknowledgeUnfinishedDialog() {
    this.setData({ unfinishedDialogVisible: false });
    wx.navigateBack();
  },

  submit() {
    if (this.data.isSubmitting) {
      return;
    }

    if (this.data.loadError || (this.data.submitMode === "project"
      ? (!this.data.projectNo || !this.data.processName || !this.data.department)
      : (!this.data.taskRowKey && (!this.data.deviceId || !this.data.processName)))) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    if (this.data.status === "已完成" && !this.data.actualFinishDate) {
      wx.showToast({
        title: "已完成需填写实际完成日期",
        icon: "none"
      });
      return;
    }

    if (this.data.submitMode === "project") {
      const preview = dataService.getProjectDepartmentProgressPreview({
        currentUser: authService.getCurrentUser(),
        projectNo: this.data.projectNo,
        department: this.data.department,
        process: this.data.processName
      });
      if (!preview.ok) {
        wx.showToast({ title: preview.message || "无法预览项目进度", icon: "none" });
        return;
      }
      if ((preview.unfinished || []).length) {
        this.setData({
          unfinishedRows: preview.unfinished,
          unfinishedDialogVisible: true
        });
        return;
      }
    }

    this.setData({ isSubmitting: true });
    try {
      const payload = {
        currentUser: authService.getCurrentUser(),
        process: this.data.processName,
        status: "已完成",
        actualStartDate: this.data.actualStartDate,
        actualFinishDate: this.data.actualFinishDate,
        quantity: this.data.quantity,
        remark: this.data.remark,
        attachments: this.data.attachments
      };
      const result = this.data.submitMode === "project"
        ? dataService.submitProjectDepartmentProgress({
            ...payload,
            projectNo: this.data.projectNo,
            department: this.data.department
          })
        : dataService.submitProgress({
            ...payload,
            taskRowKey: this.data.taskRowKey,
            deviceId: this.data.deviceId,
            task: this.data.task
          });

      wx.showToast({
        title: result.ok ? (this.data.submitMode === "project" ? "项目进度已提交" : "进度已完成") : result.message || "提交失败",
        icon: result.ok ? "success" : "none"
      });

      if (!result.ok) return;
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
