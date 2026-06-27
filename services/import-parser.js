function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeHeader(value) {
  return normalizeCell(value).replace(/\s+/g, "");
}

function getHeaderNames(mapping = {}) {
  return [mapping.header].concat(mapping.aliases || []).map(normalizeHeader).filter(Boolean);
}

function isStageHeader(header = "") {
  return /^\d+[.．]/.test(normalizeHeader(header));
}

function stripStageNo(header = "") {
  return normalizeCell(header).replace(/^\d+[.．]\s*/, "");
}

function buildHeaderIndex(headers = [], fieldMappings = []) {
  const knownHeaders = new Map();
  fieldMappings.forEach((mapping) => {
    getHeaderNames(mapping).forEach((name) => knownHeaders.set(name, mapping.header));
  });
  const byHeader = {};
  const byField = {};
  const unknownHeaders = [];

  headers.forEach((header, index) => {
    const normalized = normalizeCell(header);
    const normalizedKey = normalizeHeader(header);
    if (!normalized) return;
    if (knownHeaders.has(normalizedKey)) {
      byHeader[knownHeaders.get(normalizedKey)] = index;
      const mapping = fieldMappings.find((item) => getHeaderNames(item).indexOf(normalizedKey) >= 0);
      if (mapping) byField[mapping.field] = index;
    } else if (isStageHeader(normalized)) {
      byHeader[normalized] = index;
    } else {
      unknownHeaders.push(normalized);
    }
  });

  return { byHeader, byField, unknownHeaders };
}

function mapRowToObject(row = [], headerIndex = {}, fieldMappings = []) {
  return fieldMappings.reduce((result, mapping) => {
    const columnIndex = headerIndex[mapping.header];
    result[mapping.field] = columnIndex === undefined ? "" : normalizeCell(row[columnIndex]);
    return result;
  }, {});
}

function findHeaderRowIndex(tableRows = [], fieldMappings = []) {
  const requiredMappings = fieldMappings.filter((item) => item.required);
  let best = { index: 0, score: -1 };

  tableRows.slice(0, 10).forEach((row, index) => {
    const headers = row.map(normalizeHeader);
    const score = fieldMappings.reduce((count, mapping) => {
      return count + (getHeaderNames(mapping).some((name) => headers.indexOf(name) >= 0) ? 1 : 0);
    }, 0);
    const hasRequired = requiredMappings.every((mapping) =>
      getHeaderNames(mapping).some((name) => headers.indexOf(name) >= 0)
    );
    if (hasRequired) {
      best = { index, score: score + 100 };
      return;
    }
    if (score > best.score) best = { index, score };
  });

  return best.index;
}

function getGroupRanges(groupRow = [], headerRow = []) {
  const markers = [];
  groupRow.forEach((value, index) => {
    const text = normalizeCell(value);
    if (text) markers.push({ text, index });
  });

  function findMarker(keyword) {
    return markers.find((item) => item.text.indexOf(keyword) >= 0);
  }

  function markerEnd(marker) {
    if (!marker) return -1;
    const next = markers.find((item) => item.index > marker.index);
    return next ? next.index : headerRow.length;
  }

  const plan = findMarker("计划完成日");
  const actual = findMarker("实际完成日");
  const owner = findMarker("责任人");

  return {
    plan: plan ? { start: plan.index, end: markerEnd(plan) } : null,
    actual: actual ? { start: actual.index, end: markerEnd(actual) } : null,
    owner: owner ? { start: owner.index, end: markerEnd(owner) } : null
  };
}

function getStageColumns(groupRow = [], headerRow = []) {
  const ranges = getGroupRanges(groupRow, headerRow);
  if (!ranges.plan) return [];
  const stages = [];
  for (let col = ranges.plan.start; col < ranges.plan.end; col += 1) {
    const header = normalizeCell(headerRow[col]);
    if (!isStageHeader(header)) continue;
    const offset = col - ranges.plan.start;
    stages.push({
      process: stripStageNo(header),
      planIndex: col,
      actualIndex: ranges.actual ? ranges.actual.start + offset : -1,
      ownerIndex: ranges.owner ? ranges.owner.start + offset : -1
    });
  }
  return stages;
}

function toImportRows(objects = []) {
  return objects
    .filter((item) => item.projectNo || item.deviceUniqueNo || item.deviceNo || item.projectName)
    .map((item, index) => ({
      rowKey: [
        item.projectNo,
        item.deviceUniqueNo || item.deviceNo,
        item.stagePlanFinishDate || item.plannedShipDate || item.requiredShipDate,
        index
      ].filter(Boolean).join("-"),
      projectNo: item.projectNo,
      projectName: item.projectName,
      deviceUniqueNo: item.deviceUniqueNo,
      deviceNo: item.deviceUniqueNo || item.deviceNo,
      seq: item.deviceNo,
      model: item.model,
      area: item.area,
      due: item.stagePlanFinishDate || item.plannedShipDate || item.requiredShipDate,
      actualFinish: item.stageActualFinishDate || item.actualShipDate,
      owner: item.stageOwner,
      process: item.process || "电气设计",
      department: item.department || "",
      status: item.stageActualFinishDate ? "已完成" : "未开始",
      remark: item.remark
    }));
}

function toStageImportRows(dataRows = [], headerIndex = {}, stageColumns = [], meta = {}) {
  if (!stageColumns.length) return [];
  const result = [];

  dataRows.forEach((row, rowIndex) => {
    const base = {
      deviceUniqueNo: normalizeCell(row[headerIndex.byField.deviceUniqueNo]),
      projectNo: normalizeCell(row[headerIndex.byField.projectNo]),
      deviceNo: normalizeCell(row[headerIndex.byField.deviceNo]),
      projectName: normalizeCell(row[headerIndex.byField.projectName]),
      model: normalizeCell(row[headerIndex.byField.model]),
      area: normalizeCell(row[headerIndex.byField.area]),
      requiredShipDate: normalizeCell(row[headerIndex.byField.requiredShipDate]),
      plannedShipDate: normalizeCell(row[headerIndex.byField.plannedShipDate]),
      actualShipDate: normalizeCell(row[headerIndex.byField.actualShipDate]),
      currentStage: normalizeCell(row[headerIndex.byField.currentStage]),
      currentOwner: normalizeCell(row[headerIndex.byField.currentOwner]),
      remark: normalizeCell(row[headerIndex.byField.remark])
    };

    if (!base.projectNo && !base.deviceUniqueNo && !base.deviceNo && !base.projectName) return;

    stageColumns.forEach((stage) => {
      const due = normalizeCell(row[stage.planIndex]);
      const actualFinish = stage.actualIndex >= 0 ? normalizeCell(row[stage.actualIndex]) : "";
      const owner = stage.ownerIndex >= 0 ? normalizeCell(row[stage.ownerIndex]) : "";
      if (!due && !actualFinish && !owner) return;

      let status = "未开始";
      if (actualFinish) status = "已完成";
      else if (base.currentStage && base.currentStage === stage.process) status = "进行中";

      result.push({
        rowKey: [
          base.projectNo,
          base.deviceUniqueNo || base.deviceNo,
          stage.process,
          rowIndex
        ].filter(Boolean).join("-"),
        projectNo: base.projectNo,
        projectName: base.projectName,
        deviceUniqueNo: base.deviceUniqueNo,
        deviceNo: base.deviceUniqueNo || base.deviceNo,
        seq: base.deviceNo,
        model: base.model,
        area: base.area,
        requiredShipDate: base.requiredShipDate,
        plannedShipDate: base.plannedShipDate,
        actualShipDate: base.actualShipDate,
        currentStage: base.currentStage,
        currentOwner: base.currentOwner,
        stageDue: due,
        excelRow: rowIndex + (meta.headerRowIndex || 0) + 2,
        due: due || base.plannedShipDate || base.requiredShipDate,
        actualFinish: actualFinish || (stage.process === "入库/发货" ? base.actualShipDate : ""),
        owner: owner || (base.currentStage === stage.process ? base.currentOwner : ""),
        process: stage.process,
        department: "",
        status,
        remark: base.remark
      });
    });
  });

  return result;
}

function parseStandardRows(tableRows = [], fieldMappings = [], options = {}) {
  const headerRowIndex = options.headerRowIndex === undefined
    ? findHeaderRowIndex(tableRows, fieldMappings)
    : options.headerRowIndex;
  const groupRow = tableRows[Math.max(headerRowIndex - 1, 0)] || [];
  const headers = tableRows[headerRowIndex] || [];
  const dataRows = tableRows.slice(headerRowIndex + 1);
  const headerIndex = buildHeaderIndex(headers, fieldMappings);
  const objects = dataRows.map((row) => mapRowToObject(row, headerIndex.byHeader, fieldMappings));
  const stageRows = toStageImportRows(dataRows, headerIndex, getStageColumns(groupRow, headers), { headerRowIndex });

  return {
    headerRowIndex,
    headers: headers.map(normalizeCell).filter(Boolean),
    unknownHeaders: headerIndex.unknownHeaders,
    rawRows: objects,
    detailRows: stageRows.length ? stageRows : toImportRows(objects)
  };
}

module.exports = {
  normalizeCell,
  normalizeHeader,
  buildHeaderIndex,
  mapRowToObject,
  findHeaderRowIndex,
  getStageColumns,
  parseStandardRows,
  toImportRows
};
