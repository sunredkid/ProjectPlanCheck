const authService = require("../../services/auth-service");
const dataService = require("../../services/data-service");
const permissionService = require("../../services/permission-service");

Page({
  data: {
    loadError: "",
    currentUser: {},
    canEdit: false,
    sortMode: false,
    groupedParams: [],
    collapsedCategories: {},
    dragState: null,
    device: {},
    params: [],
    categoryOrder: []
  },

  onLoad(options) {
    if (!options.deviceId && !options.id) {
      this.setData({ loadError: "缺少设备标识，无法加载参数详情" });
      wx.showToast({ title: "设备标识缺失", icon: "none" });
      return;
    }
    const deviceId = decodeURIComponent(options.deviceId || options.id || "");
    const device = dataService.getDevice(deviceId);
    if (!device || device.id !== deviceId) {
      this.setData({ loadError: "设备不存在，无法加载参数详情" });
      wx.showToast({ title: "设备不存在", icon: "none" });
      return;
    }
    const project = dataService.getProject(device.projectNo) || {};
    this.setData({
      loadError: "",
      device: {
        id: device.id,
        projectNo: device.projectNo,
        projectName: project.name || device.projectNo,
        deviceNo: device.deviceNo,
        model: device.model,
        area: device.area
      },
      params: dataService.getParamsByDevice(device.id),
      categoryOrder: dataService.getParamCategoryOrder()
    });
    this.buildGroups();
  },

  onShow() {
    const user = authService.getCurrentUser();
    const params = this.data.device.id ? dataService.getParamsByDevice(this.data.device.id) : this.data.params;
    const categoryOrder = dataService.getParamCategoryOrder();
    this.setData({
      currentUser: user,
      canEdit: permissionService.canEditParams(user),
      params,
      categoryOrder
    });
    this.buildGroups();
  },

  buildGroups() {
    const params = this.data.params.slice().sort((a, b) => a.sort - b.sort);
    const categoryOrder = this.data.categoryOrder.slice();
    params.forEach((param) => {
      const category = param.category || "未分类";
      if (categoryOrder.indexOf(category) < 0) categoryOrder.push(category);
    });
    const groupedParams = categoryOrder
      .map((category) => {
        const items = params.filter((item) => (item.category || "未分类") === category);
        return {
          category,
          count: items.length,
          collapsed: !!this.data.collapsedCategories[category],
          items
        };
      })
      .filter((group) => group.count > 0);
    this.setData({ groupedParams });
  },

  toggleGroup(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      [`collapsedCategories.${category}`]: !this.data.collapsedCategories[category]
    });
    this.buildGroups();
  },

  addParam() {
    wx.navigateTo({
      url: `/pages/param-edit/index?mode=add&deviceId=${encodeURIComponent(this.data.device.id)}`
    });
  },

  editParam(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/param-edit/index?mode=edit&deviceId=${encodeURIComponent(this.data.device.id)}&id=${encodeURIComponent(id)}`
    });
  },

  toggleSortMode() {
    this.setData({ sortMode: !this.data.sortMode, dragState: null });
    this.buildGroups();
  },

  startDrag(e) {
    if (!this.data.sortMode) return;
    const touch = e.touches[0];
    const target = e.currentTarget;
    this.setData({
      dragState: {
        id: target.dataset.id,
        category: target.dataset.category,
        startY: touch.clientY,
        currentY: touch.clientY,
        startX: touch.clientX,
        currentX: touch.clientX
      }
    });
  },

  moveDrag(e) {
    const drag = this.data.dragState;
    if (!drag) return;
    const touch = e.touches[0];
    const dy = touch.clientY - drag.currentY;
    if (Math.abs(dy) < 42 && Math.abs(touch.clientX - drag.currentX) < 60) return;

    this.setData({
      "dragState.currentY": touch.clientY,
      "dragState.currentX": touch.clientX
    });

    // Swipe left-right to change category
    const swipeX = touch.clientX - drag.startX;
    if (Math.abs(swipeX) > 80) {
      const categoryOrder = this.data.categoryOrder;
      const currentIdx = categoryOrder.indexOf(drag.category);
      if (swipeX > 80 && currentIdx > 0) {
        // swipe right -> prev category
        this.moveToCategory(drag.id, drag.category, categoryOrder[currentIdx - 1]);
        this.setData({ "dragState.category": categoryOrder[currentIdx - 1], "dragState.startX": touch.clientX, "dragState.startY": touch.clientY });
        return;
      }
      if (swipeX < -80 && currentIdx < categoryOrder.length - 1) {
        // swipe left -> next category
        this.moveToCategory(drag.id, drag.category, categoryOrder[currentIdx + 1]);
        this.setData({ "dragState.category": categoryOrder[currentIdx + 1], "dragState.startX": touch.clientX, "dragState.startY": touch.clientY });
        return;
      }
      return;
    }

    // Vertical swipe within same category
    if (Math.abs(dy) >= 42) {
      const direction = dy > 0 ? 1 : -1;
      this.swapInCategory(drag.id, drag.category, direction);
      this.setData({
        "dragState.currentY": touch.clientY
      });
    }
  },

  endDrag() {
    this.setData({ dragState: null });
  },

  moveToCategory(id, oldCategory, newCategory) {
    const result = dataService.moveParamCategory(this.data.device.id, id, newCategory);
    if (!result.ok) {
      wx.showToast({ title: result.message || "移动失败", icon: "none" });
      return;
    }
    // Reload params
    const params = dataService.getParamsByDevice(this.data.device.id);
    this.setData({ params });
    this.buildGroups();
    wx.showToast({ title: `已移到 ${newCategory}`, icon: "none", duration: 1000 });
  },

  swapInCategory(id, category, direction) {
    const categoryItems = this.data.params
      .filter((item) => item.category === category)
      .sort((a, b) => a.sort - b.sort);
    const currentIndex = categoryItems.findIndex((item) => item.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const temp = categoryItems[currentIndex];
    categoryItems[currentIndex] = categoryItems[targetIndex];
    categoryItems[targetIndex] = temp;

    const rebuilt = [];
    this.data.categoryOrder.forEach((cat) => {
      const items = cat === category
        ? categoryItems
        : this.data.params.filter((item) => item.category === cat).sort((a, b) => a.sort - b.sort);
      rebuilt.push(...items);
    });
    rebuilt.forEach((item, index) => {
      item.sort = index + 1;
    });
    this.setData({ params: rebuilt });
    const result = dataService.saveParamOrder(this.data.device.id, rebuilt);
    if (!result.ok) {
      wx.showToast({ title: result.message || "参数排序保存失败", icon: "none" });
      return;
    }
    this.buildGroups();
  }
});
