const XML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'"
};

function loadFflate() {
  try {
    return require("./vendor/fflate");
  } catch (error) {
    return null;
  }
}

function decodeXml(value = "") {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1] === "x" || entity[1] === "X" ? 16 : 10;
      const raw = entity[1] === "x" || entity[1] === "X" ? entity.slice(2) : entity.slice(1);
      return String.fromCharCode(parseInt(raw, radix));
    }
    return XML_ENTITIES[entity] || match;
  });
}

function normalizePath(path = "") {
  return String(path).replace(/^\/+/, "");
}

function dirname(path = "") {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function joinPath(base = "", target = "") {
  if (!base) return normalizePath(target);
  if (String(target).startsWith("/")) return normalizePath(target);
  const parts = `${base}/${target}`.split("/");
  const stack = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") stack.pop();
    else stack.push(part);
  });
  return stack.join("/");
}

function getZipText(files, path) {
  const entry = files[normalizePath(path)];
  const fflate = loadFflate();
  return entry && fflate ? fflate.strFromU8(entry) : "";
}

function readFileData(file = {}) {
  const filePath = file.path || file.tempFilePath || "";
  if (!filePath) {
    return { ok: false, message: "未找到Excel文件路径" };
  }

  if (typeof wx !== "undefined" && wx.getFileSystemManager) {
    try {
      const data = wx.getFileSystemManager().readFileSync(filePath);
      return { ok: true, data };
    } catch (error) {
      // wx 读取失败时，尝试 Node.js 回退（适用于开发调试环境）
    }
  }

  try {
    const fs = require("fs");
    return { ok: true, data: fs.readFileSync(filePath) };
  } catch (error) {
    return { ok: false, message: error.message || "读取Excel文件失败" };
  }
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data && data.buffer && data.byteLength !== undefined) {
    return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
  }
  return new Uint8Array(data || []);
}

function parseAttributes(tag = "") {
  const attrs = {};
  tag.replace(/([\w:]+)="([^"]*)"/g, (match, name, value) => {
    attrs[name] = decodeXml(value);
    return match;
  });
  return attrs;
}

function parseRelationships(xml = "") {
  const rels = {};
  xml.replace(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g, (match, attrsText) => {
    const attrs = parseAttributes(attrsText);
    if (attrs.Id && attrs.Target) rels[attrs.Id] = attrs.Target;
    return match;
  });
  return rels;
}

function findWorkbookPath(files) {
  const contentTypes = getZipText(files, "[Content_Types].xml");
  const match = contentTypes.match(/<(?:\w+:)?Override\b([^>]*ContentType="application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml"[^>]*)\/?>/);
  if (match) {
    const attrs = parseAttributes(match[1]);
    if (attrs.PartName) return normalizePath(attrs.PartName);
  }
  return "xl/workbook.xml";
}

function parseWorkbook(files, workbookPath) {
  const workbookXml = getZipText(files, workbookPath);
  const relsPath = joinPath(dirname(workbookPath), `_rels/${workbookPath.split("/").pop()}.rels`);
  const rels = parseRelationships(getZipText(files, relsPath));
  const sheets = [];

  workbookXml.replace(/<(?:\w+:)?sheet\b([^>]*)\/?>/g, (match, attrsText) => {
    const attrs = parseAttributes(attrsText);
    const relId = attrs["r:id"];
    if (attrs.name && relId && rels[relId]) {
      sheets.push({
        name: attrs.name,
        path: joinPath(dirname(workbookPath), rels[relId])
      });
    }
    return match;
  });

  return sheets;
}

function parseSharedStrings(files) {
  const xml = getZipText(files, "xl/sharedStrings.xml");
  if (!xml) return [];
  const strings = [];

  xml.replace(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g, (match, body) => {
    const parts = [];
    body.replace(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g, (textMatch, text) => {
      parts.push(decodeXml(text));
      return textMatch;
    });
    strings.push(parts.join(""));
    return match;
  });

  return strings;
}

function parseStyles(files) {
  const xml = getZipText(files, "xl/styles.xml");
  const dateNumFmtIds = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  const customDateFmtIds = new Set();

  xml.replace(/<(?:\w+:)?numFmt\b([^>]*)\/?>/g, (match, attrsText) => {
    const attrs = parseAttributes(attrsText);
    const id = Number(attrs.numFmtId);
    const code = String(attrs.formatCode || "").toLowerCase();
    if (id && /[ymdh]/.test(code)) customDateFmtIds.add(id);
    return match;
  });

  const styleDateFlags = [];
  const cellXfsMatch = xml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  const cellXfsXml = cellXfsMatch ? cellXfsMatch[1] : "";
  cellXfsXml.replace(/<(?:\w+:)?xf\b([^>]*)\/?>/g, (match, attrsText) => {
    const attrs = parseAttributes(attrsText);
    const id = Number(attrs.numFmtId || 0);
    styleDateFlags.push(dateNumFmtIds.has(id) || customDateFmtIds.has(id));
    return match;
  });

  return styleDateFlags;
}

function columnToIndex(cellRef = "") {
  const letters = String(cellRef).replace(/\d/g, "");
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + letters.charCodeAt(i) - 64;
  }
  return Math.max(index - 1, 0);
}

function excelDateToString(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return String(value || "");
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const date = new Date(utc);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCellValue(cellXml, attrs, sharedStrings, styleDateFlags) {
  const type = attrs.t || "";
  const valueMatch = cellXml.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/);
  const inlineMatch = cellXml.match(/<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/);
  const rawValue = valueMatch ? decodeXml(valueMatch[1]) : "";

  if (type === "s") return sharedStrings[Number(rawValue)] || "";
  if (type === "inlineStr" && inlineMatch) {
    const texts = [];
    inlineMatch[1].replace(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g, (match, text) => {
      texts.push(decodeXml(text));
      return match;
    });
    return texts.join("");
  }
  if (type === "str" || type === "b") return rawValue;

  const styleIndex = attrs.s === undefined ? -1 : Number(attrs.s);
  if (styleDateFlags[styleIndex] && rawValue) return excelDateToString(rawValue);
  return rawValue;
}

function parseWorksheetRows(files, sheetPath, sharedStrings, styleDateFlags) {
  const xml = getZipText(files, sheetPath);
  const rows = [];

  xml.replace(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g, (rowMatch, rowBody) => {
    const row = [];
    rowBody.replace(/<(?:\w+:)?c\b([^>]*)\/>|<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g, (cellMatch, attrsTextSelfClosing, attrsTextPaired, body) => {
      const attrs = parseAttributes(attrsTextSelfClosing || attrsTextPaired || "");
      const columnIndex = columnToIndex(attrs.r || "");
      row[columnIndex] = getCellValue(cellMatch, attrs, sharedStrings, styleDateFlags);
      return cellMatch;
    });
    rows.push(row.map((item) => item || ""));
    return rowMatch;
  });

  return rows;
}

function readSheetRows(file = {}, sheetName = "") {
  const fflate = loadFflate();
  if (!fflate) {
    return {
      ok: false,
      message: "xlsx解压依赖未找到，请确认 services/vendor/fflate.js 存在。"
    };
  }

  const fileResult = readFileData(file);
  if (!fileResult.ok) return fileResult;

  try {
    const files = fflate.unzipSync(toUint8Array(fileResult.data));
    const workbookPath = findWorkbookPath(files);
    const sheets = parseWorkbook(files, workbookPath);
    const target = sheets.find((item) => item.name === sheetName) || (sheets.length === 1 ? sheets[0] : null);

    if (!target) {
      return {
        ok: false,
        message: `未找到标准工作表：${sheetName}`
      };
    }

    return {
      ok: true,
      sheetName: target.name,
      rows: parseWorksheetRows(files, target.path, parseSharedStrings(files), parseStyles(files))
    };
  } catch (error) {
    return { ok: false, message: error.message || "解析Excel文件失败" };
  }
}

module.exports = {
  readSheetRows
};
