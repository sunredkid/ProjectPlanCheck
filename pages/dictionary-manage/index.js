const dataService = require("../../services/data-service");

const DICT_KEYS = {
  processes: { label: "工序字典", icon: "工序" },
  paramCategories: { label: "参数分类字典", icon: "参数" },
  paramLibraries: { label: "参数库权限", icon: "权限" },
  qbCategories: { label: "QB分类字典", icon: "QB" },
  userRoles: { label: "用户角色字典", icon: "角色" }
};

Page({
  data: {
    dictTabs: Object.keys(DICT_KEYS).map((key) => ({
      key,
      label: DICT_KEYS[key].label,
      icon: DICT_KEYS[key].icon
    })),
    activeDict: "processes",
    items: [],
    paramLibraries: [],
    departments: [],
    editingIndex: -1,
    editValue: ""
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '字典管理' });
    this.loadDict();
  },

  loadDict() {
    if (this.data.activeDict === "paramLibraries") {
      const departments = dataService.listDepartments ? dataService.listDepartments().map((item) => item.name) : [];
      const libraries = (dataService.getParamLibraryConfigs ? dataService.getParamLibraryConfigs() : [])
        .map((library) => {
          const visibleDepartments = library.visibleDepartments || [];
          return Object.assign({}, library, {
            departmentOptions: departments.map((department) => ({
              name: department,
              selected: visibleDepartments.indexOf(department) >= 0
            }))
          });
        });
      this.setData({
        paramLibraries: libraries,
        departments,
        items: [],
        editingIndex: -1,
        editValue: ""
      });
      return;
    }
    const items = dataService.getDictionary ? dataService.getDictionary(this.data.activeDict) : [];
    this.setData({ items: items.slice(), editingIndex: -1, editValue: "" });
  },

  switchDict(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeDict: key }, () => this.loadDict());
  },

  startEdit(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ editingIndex: index, editValue: this.data.items[index] || "" });
  },

  onEditInput(e) {
    this.setData({ editValue: e.detail.value });
  },

  cancelEdit() {
    this.setData({ editingIndex: -1, editValue: "" });
  },

  saveEdit() {
    const value = String(this.data.editValue || "").trim();
    if (!value) { wx.showToast({ title: "内容不能为空", icon: "none" }); return; }
    const items = this.data.items.slice();
    if (this.data.editingIndex >= 0) {
      items[this.data.editingIndex] = value;
    } else {
      items.push(value);
    }
    this.setData({ items, editingIndex: -1, editValue: "" });
    wx.showToast({ title: "已保存（当前为 mock 模式）", icon: "none" });
  },

  deleteItem(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.items.slice();
    items.splice(index, 1);
    this.setData({ items });
    wx.showToast({ title: "已删除（当前为 mock 模式）", icon: "none" });
  },

  startAdd() {
    this.setData({ editingIndex: -1, editValue: "" });
  },

  toggleParamDepartment(e) {
    const key = e.currentTarget.dataset.key;
    const department = e.currentTarget.dataset.department;
    const libraries = this.data.paramLibraries.map((item) => {
      if (item.key !== key) return item;
      const departmentOptions = (item.departmentOptions || []).map((option) =>
        option.name === department ? Object.assign({}, option, { selected: !option.selected }) : option
      );
      return Object.assign({}, item, { departmentOptions });
    });
    this.setData({ paramLibraries: libraries });
  },

  saveParamLibraryAccess(e) {
    const key = e.currentTarget.dataset.key;
    const library = this.data.paramLibraries.find((item) => item.key === key);
    if (!library) {
      wx.showToast({ title: "参数库不存在", icon: "none" });
      return;
    }
    const visibleDepartments = (library.departmentOptions || [])
      .filter((option) => option.selected)
      .map((option) => option.name);
    const result = dataService.updateParamLibraryAccess(key, visibleDepartments);
    wx.showToast({
      title: result.ok ? "权限已保存" : result.message || "保存失败",
      icon: result.ok ? "success" : "none"
    });
    if (result.ok) this.loadDict();
  }
});
