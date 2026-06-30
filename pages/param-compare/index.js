const dataService = require("../../services/data-service");

function buildSelection(projects) {
  const result = {};
  (projects || []).forEach((project) => {
    result[project.projectNo] = { all: true, deviceIds: [] };
  });
  return result;
}

function withExportSelectedState(projects, selection) {
  return (projects || []).map((project) => {
    const current = selection && selection[project.projectNo] ? selection[project.projectNo] : { all: true, deviceIds: [] };
    const ids = current.deviceIds || [];
    return Object.assign({}, project, {
      allSelected: current.all !== false,
      devices: (project.devices || []).map((device) => Object.assign({}, device, {
        selected: !current.all && ids.indexOf(device.id) >= 0
      }))
    });
  });
}

Page({
  data: {
    allDevices: [],
    selectedIds: [],
    compareResult: null,
    showResult: false,
    categories: [],
    expandedCategories: {},
    selectedMap: {},
    exportMode: "project",
    exportProjectNo: "",
    exportStartDate: "",
    exportEndDate: "",
    exportProjects: [],
    exportDeviceSelection: {},
    paramNameOptions: [],
    filterParamMap: {},
    filterValue: "",
    exporting: false
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "参数对比" });
    this.loadDevices();
    this.loadExportOptions();
  },

  loadDevices() {
    const devices = dataService.listParamDevices();
    this.setData({ allDevices: this.withSelectedState(devices, this.data.selectedIds) });
  },

  loadExportOptions() {
    const options = dataService.getParamExportOptions();
    const projectNo = this.data.exportProjectNo || (options.projects[0] && options.projects[0].projectNo) || "";
    const filterParamMap = {};
    (options.paramNames || []).forEach((name) => { filterParamMap[name] = false; });
    const selection = buildSelection(options.projects || []);
    this.setData({
      exportProjects: withExportSelectedState(options.projects || [], selection),
      exportProjectNo: projectNo,
      exportDeviceSelection: selection,
      paramNameOptions: (options.paramNames || []).map((name) => ({ name, selected: false })),
      filterParamMap
    });
  },

  withSelectedState(devices, selectedIds) {
    const selectedMap = {};
    (selectedIds || []).forEach((id) => { selectedMap[id] = true; });
    return (devices || []).map((device) => Object.assign({}, device, { selected: !!selectedMap[device.id] }));
  },

  toggleDevice(e) {
    const deviceId = e.currentTarget.dataset.id;
    if (!deviceId) return;
    const ids = this.data.selectedIds.slice();
    const idx = ids.indexOf(deviceId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else if (ids.length < 5) {
      ids.push(deviceId);
    } else {
      wx.showToast({ title: "最多选择5台设备", icon: "none" });
      return;
    }
    const selectedMap = {};
    ids.forEach((id) => { selectedMap[id] = true; });
    this.setData({
      selectedIds: ids,
      selectedMap,
      allDevices: this.withSelectedState(this.data.allDevices, ids),
      showResult: false
    });
  },

  startCompare() {
    if (this.data.selectedIds.length < 2) {
      wx.showToast({ title: "请至少选择2台设备", icon: "none" });
      return;
    }
    const result = dataService.getParamCompareData(this.data.selectedIds);
    const categoriesWithCount = [];
    const seen = {};
    const catDiffCount = {};
    (result.matrix || []).forEach((row) => {
      const cat = row.category || "未分类";
      if (!seen[cat]) {
        seen[cat] = true;
        categoriesWithCount.push({ name: cat, diffCount: 0 });
      }
      if (row.hasDiff) catDiffCount[cat] = (catDiffCount[cat] || 0) + 1;
    });
    categoriesWithCount.forEach((cat) => { cat.diffCount = catDiffCount[cat.name] || 0; });
    const expanded = {};
    categoriesWithCount.forEach((cat) => { expanded[cat.name] = true; });
    this.setData({
      compareResult: result,
      categories: categoriesWithCount,
      expandedCategories: expanded,
      showResult: true
    });
  },

  resetCompare() {
    this.setData({
      selectedIds: [],
      selectedMap: {},
      allDevices: this.withSelectedState(this.data.allDevices, []),
      compareResult: null,
      showResult: false,
      categories: [],
      expandedCategories: {}
    });
  },

  toggleCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    const expanded = Object.assign({}, this.data.expandedCategories);
    expanded[cat] = !expanded[cat];
    this.setData({ expandedCategories: expanded });
  },

  switchExportMode(e) {
    this.setData({ exportMode: e.currentTarget.dataset.mode || "project" });
  },

  onProjectPickerChange(e) {
    const index = Number(e.detail.value || 0);
    const project = this.data.exportProjects[index];
    if (project) this.setData({ exportProjectNo: project.projectNo });
  },

  onStartDateChange(e) {
    this.setData({ exportStartDate: e.detail.value || "" });
  },

  onEndDateChange(e) {
    this.setData({ exportEndDate: e.detail.value || "" });
  },

  toggleExportAllDevices(e) {
    const projectNo = e.currentTarget.dataset.projectNo;
    if (!projectNo) return;
    const selection = Object.assign({}, this.data.exportDeviceSelection);
    selection[projectNo] = { all: true, deviceIds: [] };
    this.setData({
      exportDeviceSelection: selection,
      exportProjects: withExportSelectedState(this.data.exportProjects, selection)
    });
  },

  toggleExportDevice(e) {
    const projectNo = e.currentTarget.dataset.projectNo;
    const deviceId = e.currentTarget.dataset.deviceId;
    if (!projectNo || !deviceId) return;
    const selection = Object.assign({}, this.data.exportDeviceSelection);
    const current = selection[projectNo] || { all: true, deviceIds: [] };
    const ids = current.all ? [] : (current.deviceIds || []).slice();
    const idx = ids.indexOf(deviceId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(deviceId);
    selection[projectNo] = ids.length ? { all: false, deviceIds: ids } : { all: true, deviceIds: [] };
    this.setData({
      exportDeviceSelection: selection,
      exportProjects: withExportSelectedState(this.data.exportProjects, selection)
    });
  },

  toggleFilterParam(e) {
    const name = e.currentTarget.dataset.name;
    if (!name) return;
    const map = Object.assign({}, this.data.filterParamMap);
    map[name] = !map[name];
    this.setData({
      filterParamMap: map,
      paramNameOptions: this.data.paramNameOptions.map((item) => Object.assign({}, item, { selected: !!map[item.name] }))
    });
  },

  onFilterValueInput(e) {
    this.setData({ filterValue: e.detail.value || "" });
  },

  exportParamExcel() {
    if (this.data.exporting) return;
    const filterParamNames = Object.keys(this.data.filterParamMap).filter((name) => this.data.filterParamMap[name]);
    this.setData({ exporting: true });
    try {
      const result = dataService.exportParamWorkbook({
        mode: this.data.exportMode,
        projectNo: this.data.exportProjectNo,
        startDate: this.data.exportStartDate,
        endDate: this.data.exportEndDate,
        deviceSelection: this.data.exportDeviceSelection,
        filterParamNames,
        filterValue: this.data.filterValue
      });
      if (!result.ok) {
        wx.showToast({ title: result.message || "导出失败", icon: "none" });
        return;
      }
      wx.showToast({ title: result.message || "导出成功", icon: "none" });
      if (wx.openDocument) {
        wx.openDocument({ filePath: result.filePath, fileType: "xlsx", showMenu: true });
      }
    } catch (error) {
      wx.showToast({ title: (error && error.message) || "导出失败", icon: "none" });
    } finally {
      this.setData({ exporting: false });
    }
  }
});
