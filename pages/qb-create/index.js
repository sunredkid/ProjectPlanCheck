const authService = require("../../services/auth-service");
const attachmentService = require("../../services/attachment-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    currentUser: {},
    project: {},
    categories: [],
    raisedProcesses: [],
    departments: [],
    usersByDepartment: {},
    availableUsers: [],
    devices: [],
    form: {
      qbNo: "",
      category: "",
      raisedProcess: "",
      occurredAt: "2026-06-24",
      quantity: "1",
      description: "",
      reason: "",
      temporaryAction: "",
      longTermAction: "",
      sourceDepartment: "",
      responsibleDepartment: "",
      currentOwner: ""
    },
    canCreate: false,
    loadError: "",
    attachments: [],
    isSubmitting: false,
    isUploadingAtt: false,
    uploadProgress: 0,
    uploadTotal: 0
  },

  onLoad(options) {
    if (!options.projectNo) {
      this.setData({ loadError: "缺少项目编号，请从项目详情重新进入。" });
      wx.showToast({ title: "缺少项目编号", icon: "none" });
      return;
    }
    const projectNo = decodeURIComponent(options.projectNo || "");
    const data = dataService.getQbCreateOptions(projectNo);
    if (!data.ok) {
      this.setData({ loadError: data.message || "QB创建加载失败" });
      wx.showToast({ title: this.data.loadError, icon: "none" });
      return;
    }
    this.setData({
      loadError: "",
      project: data.project,
      categories: data.categories,
      raisedProcesses: data.raisedProcesses,
      departments: data.departments,
      usersByDepartment: data.usersByDepartment,
      availableUsers: data.availableUsers,
      devices: data.devices,
      "form.category": data.defaults.category,
      "form.raisedProcess": data.defaults.raisedProcess,
      "form.sourceDepartment": data.defaults.sourceDepartment,
      "form.responsibleDepartment": data.defaults.responsibleDepartment,
      "form.currentOwner": data.defaults.currentOwner
    });
  },

  onShow() {
    const user = authService.getCurrentUser();
    this.setData({
      currentUser: user,
      canCreate: permissionService.canCreateQb(user)
    });
  },

  setField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ["form." + field]: e.detail.value });
  },

  chooseOption(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.currentTarget.dataset.value;
    if (field === "responsibleDepartment") {
      const availableUsers = this.data.usersByDepartment[value] || [];
      this.setData({
        "form.responsibleDepartment": value,
        availableUsers,
        "form.currentOwner": availableUsers[0] || ""
      });
      return;
    }
    this.setData({ ["form." + field]: value });
  },

  toggleDevice(e) {
    const index = e.currentTarget.dataset.index;
    const key = "devices[" + index + "].checked";
    this.setData({ [key]: !this.data.devices[index].checked });
  },

  uploadFile() {
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
    const prefix = "qb/" + (this.data.project.projectNo || "qb") + "/";

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

    if (!this.data.canCreate) {
      wx.showToast({ title: "仅采购部可新增QB", icon: "none" });
      return;
    }

    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }

    if (!this.data.form.qbNo || !this.data.form.description || !this.data.form.currentOwner) {
      wx.showToast({ title: "请填写QB单号、异常描述和当前负责人", icon: "none" });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      const result = dataService.createQb({
        ...this.data.form,
        projectNo: this.data.project.projectNo,
        initiator: this.data.currentUser.name,
        linkedDevices: this.data.devices.filter(item => item.checked).map(item => item.no),
        attachments: this.data.attachments
      });
      wx.showToast({ title: result.ok ? "QB已创建" : result.message || "QB创建失败", icon: result.ok ? "success" : "none" });
      if (!result.ok) return;
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      wx.showToast({ title: error.message || "QB创建失败", icon: "none" });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
