const dataService = require("../../services/data-service");
const attachmentService = require("../../services/attachment-service");

Page({
  data: {
    task: {},
    taskRowKey: "",
    deviceId: "",
    processName: "",
    loadError: "",
    statusOptions: ["未开始", "进行中", "已完成", "有风险", "暂停"],
    status: "已完成",
    actualStartDate: "2026-06-25",
    actualFinishDate: "2026-06-25",
    actualStartDateText: "2026-06-25",
    actualFinishDateText: "2026-06-25",
    quantity: "1",
    remark: "",
    attachments: [],
    isSubmitting: false,
    isUploadingAtt: false,
    uploadProgress: 0,
    uploadTotal: 0
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
    const rowKey = decodeURIComponent(options.rowKey || "");
    if (rowKey) {
      const task = dataService.getTaskByRowKey(rowKey);
      if (!task) {
        this.setData({ loadError: "未找到该任务，请从任务列表重新进入。" });
        wx.showToast({ title: "任务不存在", icon: "none" });
        return;
      }

      this.setData(this.updateDateText({
        loadError: "",
        task,
        taskRowKey: rowKey,
        deviceId: task.deviceId || "",
        processName: task.process || "",
        status: task.status === "待部门派单" ? "进行中" : (task.status || this.data.status),
        actualStartDate: task.actualStart || this.data.actualStartDate,
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
      actualStartDate: process.actualStart || this.data.actualStartDate,
      actualFinishDate: process.actualFinish || this.data.actualFinishDate
    }));
  },

  chooseStatus(e) {
    const status = e.currentTarget.dataset.value;
    const update = { status };
    if (status === "已完成" && !this.data.actualFinishDate) {
      update.actualFinishDate = "2026-06-25";
    }
    if (status === "进行中" && !this.data.actualStartDate) {
      update.actualStartDate = "2026-06-25";
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

  submit() {
    if (this.data.isSubmitting) {
      return;
    }

    if (this.data.loadError || (!this.data.taskRowKey && (!this.data.deviceId || !this.data.processName))) {
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

    this.setData({ isSubmitting: true });
    try {
      const result = dataService.submitProgress({
        taskRowKey: this.data.taskRowKey,
        deviceId: this.data.deviceId,
        process: this.data.processName,
        task: this.data.task,
        status: this.data.status,
        actualStartDate: this.data.actualStartDate,
        actualFinishDate: this.data.actualFinishDate,
        quantity: this.data.quantity,
        remark: this.data.remark,
        attachments: this.data.attachments
      });

      wx.showToast({
        title: result.ok ? "进度已提交" : result.message || "提交失败",
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
