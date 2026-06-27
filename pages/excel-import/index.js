const importService = require("../../services/import-service");

Page({
  data: {
    selectedFile: "",
    selectedFileText: "尚未选择文件",
    parsed: false,
    preview: {
      templateVersion: "",
      standardSheet: "",
      projectCount: 0,
      deviceCount: 0,
      taskCount: 0,
      errorCount: 0,
      warningCount: 0
    },
    mappingMode: "按表头名称识别，不按固定列号",
    requiredFields: [],
    planGroup: "各阶段 / 计划完成日",
    actualGroup: "各阶段 / 实际完成日",
    ownerGroup: "各阶段 / 责任人",
    warnings: [],
    errors: [],
    rowIssues: [],
    detailRows: [],
    acceptanceParsed: false,
    acceptanceSummary: {
      total: 0,
      passed: 0,
      failed: 0,
      projectCount: 0,
      deviceCount: 0,
      taskCount: 0,
      errorCount: 0,
      warningCount: 0
    },
    acceptanceItems: [],
    headerValidation: {
      recognizedHeaders: [],
      missingRequired: [],
      unknownHeaders: []
    },
    selectedFileInfo: null,
    templateInfo: null,
    isParsing: false,
    isAccepting: false,
    isImporting: false,
    isBusy: false
  },

  formatIssueDetail(issue = {}) {
    const detail = issue.detail || {};
    return [
      detail.projectNo || "-",
      detail.deviceNo || "-",
      detail.process || "-"
    ].join("｜");
  },

  normalizeRowIssues(rowIssues = []) {
    return rowIssues.map((item) => ({
      ...item,
      detailText: this.formatIssueDetail(item)
    }));
  },

  onLoad() {
    const template = importService.getStandardTemplateInfo();
    const requiredFields = importService
      .getFieldMappings()
      .filter((item) => item.required)
      .map((item) => item.header);

    this.setData({
      "preview.templateVersion": "单台设备生产进度统一跟踪表 v3",
      "preview.standardSheet": template.sheetName,
      requiredFields,
      templateInfo: template
    });
  },

  chooseFile() {
    if (wx.chooseMessageFile) {
      wx.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["xlsx", "xls"],
        success: (res) => {
          const file = importService.normalizeSelectedFile((res.tempFiles || [])[0]);
          this.setData({
            selectedFile: file.name,
            selectedFileText: file.name || "尚未选择文件",
            selectedFileInfo: file,
            parsed: false
          });
          wx.showToast({ title: "file selected", icon: "success" });
        },
        fail: () => {
          this.useSampleFile();
        }
      });
      return;
    }

    this.useSampleFile();
  },

  downloadTemplate() {
    const template = importService.getTemplateDownloadInfo();
    this.setData({ templateInfo: template });

    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: template.path,
        success: () => wx.showToast({ title: "template path copied", icon: "success" })
      });
      return;
    }

    wx.showModal({
      title: "Template path",
      content: template.path,
      showCancel: false
    });
  },

  useSampleFile() {
    const file = importService.normalizeSelectedFile({
      name: "sample_import_v3.xlsx",
      path: ""
    });
    this.setData({
      selectedFile: file.name,
      selectedFileText: file.name || "尚未选择文件",
      selectedFileInfo: file,
      parsed: false
    });
    wx.showToast({ title: "sample file selected", icon: "success" });
  },

  chooseAcceptanceFiles() {
    if (this.data.isBusy) {
      return;
    }

    if (!wx.chooseMessageFile) {
      wx.showToast({ title: "当前环境不支持多文件选择", icon: "none" });
      return;
    }

    this.setData({ isAccepting: true, isBusy: true });
    wx.chooseMessageFile({
      count: 9,
      type: "file",
      extension: ["xlsx", "xls"],
      success: (res) => {
        try {
          const files = (res.tempFiles || []).map(importService.normalizeSelectedFile);
          if (!files.length) {
            wx.showToast({ title: "未选择文件", icon: "none" });
            return;
          }

          const result = importService.validateImportSamples(files);
          this.setData({
            acceptanceParsed: true,
            acceptanceSummary: result.summary,
            acceptanceItems: result.items.map((item) => ({
              ...item,
              firstError: (item.errors || [])[0] || "",
              firstWarning: (item.warnings || [])[0] || ""
            }))
          });
          wx.showToast({
            title: result.ok ? "验收通过" : "存在问题",
            icon: result.ok ? "success" : "none"
          });
        } catch (error) {
          wx.showToast({ title: error.message || "验收失败", icon: "none" });
        } finally {
          this.setData({ isAccepting: false, isBusy: false });
        }
      },
      fail: () => {
        this.setData({ isAccepting: false, isBusy: false });
        wx.showToast({ title: "未选择文件", icon: "none" });
      }
    });
  },

  parseFile() {
    if (this.data.isBusy) {
      return;
    }

    if (!this.data.selectedFile) {
      wx.showToast({ title: "请先选择Excel文件", icon: "none" });
      return;
    }

    this.setData({ isParsing: true, isBusy: true });
    try {
      const result = importService.parseExcelPreview(this.data.selectedFileInfo || { name: this.data.selectedFile });
      this.setData({
        parsed: true,
        preview: {
          templateVersion: result.templateVersion,
          standardSheet: result.standardSheet,
          projectCount: result.projectCount,
          deviceCount: result.deviceCount,
          taskCount: result.taskCount,
          errorCount: result.errorCount,
          warningCount: result.warningCount
        },
        warnings: result.warnings,
        errors: result.errors,
        rowIssues: this.normalizeRowIssues(result.rowIssues || []),
        detailRows: result.detailRows,
        headerValidation: result.headerValidation
      });
      wx.showToast({ title: "解析完成", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "解析失败", icon: "none" });
    } finally {
      this.setData({ isParsing: false, isBusy: false });
    }
  },

  confirmImport() {
    if (this.data.isBusy) {
      return;
    }

    if (!this.data.parsed) {
      wx.showToast({ title: "请先解析并预览", icon: "none" });
      return;
    }
    if (this.data.preview.errorCount > 0) {
      wx.showToast({ title: "存在错误，不能导入", icon: "none" });
      return;
    }

    wx.showModal({
      title: "确认导入",
      content: `将导入 ${this.data.preview.projectCount} 个项目、${this.data.preview.deviceCount} 台设备、${this.data.preview.taskCount} 条工序任务。`,
      confirmText: "导入",
      success: (res) => {
        if (res.confirm) {
          this.setData({ isImporting: true, isBusy: true });
          try {
            const result = importService.confirmImport(this.data.detailRows);
            wx.showToast({
              title: result.ok ? `导入${result.taskCount}条任务` : "导入失败",
              icon: result.ok ? "success" : "none"
            });
            if (result.ok) {
              setTimeout(() => wx.navigateTo({ url: "/pages/import-logs/index" }), 900);
            }
          } catch (error) {
            wx.showToast({ title: error.message || "导入失败", icon: "none" });
          } finally {
            this.setData({ isImporting: false, isBusy: false });
          }
        }
      }
    });
  },

  openLogs() {
    wx.navigateTo({
      url: "/pages/import-logs/index"
    });
  }
});
