const dataService = require("../../services/data-service");

Page({
  data: {
    loadError: "",
    project: {},
    devices: [],
    deviceOptions: [],
    showDeviceDialog: false,
    selectedDevices: [],
    processes: [],
    departments: [],
    form: {
      device: "全部设备",
      process: "电气设计",
      department: "电气设计部",
      plannedDueDate: "2026-06-28",
      remark: ""
    },
    pendingDispatches: [],
    isSubmitting: false
  },

  onLoad(options) {
    if (!options.projectNo) {
      this.setData({ loadError: "缺少项目编号，请从项目详情重新进入。" });
      wx.showToast({ title: "缺少项目编号", icon: "none" });
      return;
    }
    const projectNo = decodeURIComponent(options.projectNo || "");
    const preview = dataService.getProjectDispatchPreview(projectNo);
    if (!preview.ok) {
      this.setData({ loadError: preview.message || "项目派单加载失败" });
      wx.showToast({ title: this.data.loadError, icon: "none" });
      return;
    }
    this.setData({
      loadError: "",
      project: preview.project,
      devices: preview.devices,
      deviceOptions: preview.devices.map((item) => ({ no: item, checked: false })),
      processes: preview.processes,
      departments: preview.departments,
      pendingDispatches: preview.pendingDispatches,
      "form.device": "全部设备",
      "form.process": preview.processes[0] || "电气设计",
      "form.department": dataService.getDefaultDepartmentForProcess(preview.processes[0] || "电气设计") || preview.departments[0] || "电气设计部"
    });
  },

  chooseOption(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.currentTarget.dataset.value;
    const nextData = { [`form.${field}`]: value };
    if (field === "process") {
      const department = dataService.getDefaultDepartmentForProcess(value);
      if (department) nextData["form.department"] = department;
    }
    this.setData(nextData);
  },

  chooseAllDevices() {
    this.setData({
      selectedDevices: [],
      "form.device": "全部设备"
    });
  },

  openDeviceDialog() {
    const selectedMap = this.data.selectedDevices.reduce((result, item) => {
      result[item] = true;
      return result;
    }, {});
    this.setData({
      showDeviceDialog: true,
      deviceOptions: this.data.devices.map((item) => ({
        no: item,
        checked: !!selectedMap[item]
      }))
    });
  },

  closeDeviceDialog() {
    this.setData({ showDeviceDialog: false });
  },

  noop() {},

  toggleDevice(e) {
    const index = e.currentTarget.dataset.index;
    const key = `deviceOptions[${index}].checked`;
    this.setData({ [key]: !this.data.deviceOptions[index].checked });
  },

  confirmDeviceSelection() {
    const selectedDevices = this.data.deviceOptions.filter((item) => item.checked).map((item) => item.no);
    if (!selectedDevices.length) {
      wx.showToast({ title: "请选择设备", icon: "none" });
      return;
    }
    this.setData({
      selectedDevices,
      showDeviceDialog: false,
      "form.device": selectedDevices.join("、")
    });
  },

  onDateChange(e) {
    this.setData({ "form.plannedDueDate": e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ "form.remark": e.detail.value });
  },

  submitDispatch() {
    if (this.data.isSubmitting) {
      return;
    }

    if (!this.data.project.projectNo) {
      wx.showToast({ title: "项目编号缺失", icon: "none" });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      const result = dataService.createProjectDispatch({
        projectNo: this.data.project.projectNo,
        process: this.data.form.process,
        department: this.data.form.department,
        device: this.data.form.device,
        devices: this.data.selectedDevices.length ? this.data.selectedDevices : null,
        plannedDueDate: this.data.form.plannedDueDate,
        remark: this.data.form.remark
      });

      if (result.ok) {
        this.setData({ pendingDispatches: (result.dispatches || [result.dispatch]).concat(this.data.pendingDispatches) });
      }
      wx.showToast({ title: result.ok ? "已派到部门" : result.message || "派单失败", icon: result.ok ? "success" : "none" });
    } catch (error) {
      wx.showToast({ title: error.message || "派单失败", icon: "none" });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
