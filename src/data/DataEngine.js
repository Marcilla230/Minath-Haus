const REQUIRED_COLUMNS = [
  "朝代",
  "地区",
  "姓名",
  "名次",
  "任官经历",
  "著作",
  "出身",
  "婚嫁",
  "轶事",
];

const BIOGRAPHY_COLUMNS = ["任官经历", "著作", "出身", "婚嫁", "轶事"];

const MISSING_TEXT = "（史料缺载）";
const REGION_RENDER_SCALE = 2.35;

const QING_REIGN_START_YEAR = Object.freeze({
  顺治: 1644,
  康熙: 1662,
  雍正: 1723,
  乾隆: 1736,
  嘉庆: 1796,
  道光: 1821,
  咸丰: 1851,
  同治: 1862,
  光绪: 1875,
  宣统: 1909,
});

const CHINESE_DIGIT = Object.freeze({
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
});

const GANZHI_PATTERN = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/;

// X/Y are curatorial coordinates, not GIS longitude/latitude. Exact same raw
// region text always resolves to the same base coordinate.
const KNOWN_REGION_COORDS = Object.freeze({
  杭州府: { x: 0, y: 0 },
  杭州府钱塘县: { x: -5, y: 5 },
  杭州府仁和县: { x: -2, y: 6 },
  杭州府富阳县: { x: -10, y: -4 },
  杭州府临安县: { x: -17, y: 5 },
  杭州府昌化县: { x: -24, y: 8 },
  杭州府於潜县: { x: -20, y: 1 },
  杭州府新城县: { x: -13, y: -9 },
  杭州府余杭县: { x: -7, y: 10 },
  杭州府海宁县: { x: 16, y: 4 },
  海宁州: { x: 18, y: 5 },
  嘉兴府: { x: 30, y: 8 },
  湖州府: { x: 3, y: 24 },
  绍兴府: { x: 25, y: -15 },
  宁波府: { x: 48, y: -25 },
  台州府: { x: 43, y: -48 },
  金华府: { x: -2, y: -38 },
  衢州府: { x: -34, y: -35 },
  严州府: { x: -22, y: -20 },
  温州府: { x: 26, y: -68 },
  处州府: { x: -13, y: -62 },
});

const REGION_ANCHORS = Object.freeze([
  ["杭州府", { x: 0, y: 0, radius: 14 }],
  ["嘉兴府", { x: 30, y: 8, radius: 10 }],
  ["湖州府", { x: 3, y: 24, radius: 10 }],
  ["绍兴府", { x: 25, y: -15, radius: 12 }],
  ["宁波府", { x: 48, y: -25, radius: 12 }],
  ["台州府", { x: 43, y: -48, radius: 13 }],
  ["金华府", { x: -2, y: -38, radius: 12 }],
  ["衢州府", { x: -34, y: -35, radius: 11 }],
  ["严州府", { x: -22, y: -20, radius: 10 }],
  ["温州府", { x: 26, y: -68, radius: 12 }],
  ["处州府", { x: -13, y: -62, radius: 12 }],
]);

export {
  BIOGRAPHY_COLUMNS,
  KNOWN_REGION_COORDS,
  MISSING_TEXT,
  QING_REIGN_START_YEAR,
  REQUIRED_COLUMNS,
};

export async function loadJinshiData(csvUrl = "/data.csv", options = {}) {
  if (typeof fetch !== "function") {
    throw new Error("loadJinshiData requires a browser-like fetch environment.");
  }

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to load CSV from ${csvUrl}: ${response.status}`);
  }

  const csvText = await response.text();
  return parseJinshiCsv(csvText, options);
}

export function parseJinshiCsv(csvText, options = {}) {
  const rows = parseCsvStrict(csvText);
  if (rows.length === 0) {
    return { nodes: [], warnings: ["CSV is empty."], columns: [] };
  }

  const headers = rows[0].map((header, index) =>
    index === 0 ? stripBom(header) : header,
  );
  const warnings = validateColumns(headers);
  const dataRows = rows.slice(1);
  const nodes = dataRows
    .map((row, rowOffset) => rowToNode(row, headers, rowOffset + 1, options))
    .filter(Boolean);

  return { nodes: spreadClusteredNodes(nodes), warnings, columns: headers };
}

export function parseCsvStrict(csvText) {
  const text = String(csvText ?? "");
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (insideQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      insideQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(dropTerminalCarriageReturn(field));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(dropTerminalCarriageReturn(field));
    rows.push(row);
  }

  return rows;
}

export function parseReignYear(rawEraText) {
  const raw = preserveCell(rawEraText);
  const reignName = Object.keys(QING_REIGN_START_YEAR).find((name) =>
    raw.includes(name),
  );

  if (!reignName) {
    return {
      raw,
      reignName: null,
      regnalYear: null,
      ganzhi: extractGanzhi(raw),
      gregorianYear: null,
      z: null,
      warning: `Cannot detect Qing reign title from 朝代: ${raw}`,
    };
  }

  const yearMatch = raw.match(new RegExp(`${reignName}(.+?)年`));
  const regnalYear = yearMatch ? parseChineseYearNumber(yearMatch[1]) : null;
  const gregorianYear =
    regnalYear == null
      ? null
      : QING_REIGN_START_YEAR[reignName] + regnalYear - 1;

  return {
    raw,
    reignName,
    regnalYear,
    ganzhi: extractGanzhi(raw),
    gregorianYear,
    z: gregorianYear == null ? null : (gregorianYear - 1644) * -5,
    warning:
      regnalYear == null
        ? `Cannot parse regnal year number from 朝代: ${raw}`
        : null,
  };
}

export function parseChineseYearNumber(rawYearText) {
  const text = preserveCell(rawYearText).trim();
  if (text === "元") return 1;
  if (/^\d+$/.test(text)) return Number(text);
  if (text.length === 0) return null;

  const normalized = text
    .replace(/初/g, "")
    .replace(/正/g, "一")
    .replace(/廿/g, "二十")
    .replace(/卅/g, "三十");

  if (normalized.includes("百")) {
    const [hundredsPart, rest = ""] = normalized.split("百");
    const hundreds = chineseDigitValue(hundredsPart || "一");
    const restValue = rest ? parseChineseYearNumber(rest.replace(/^零/, "")) : 0;
    return hundreds == null || restValue == null ? null : hundreds * 100 + restValue;
  }

  if (normalized.includes("十")) {
    const [tensPart, onesPart = ""] = normalized.split("十");
    const tens = tensPart ? chineseDigitValue(tensPart) : 1;
    const ones = onesPart ? chineseDigitValue(onesPart) : 0;
    return tens == null || ones == null ? null : tens * 10 + ones;
  }

  return chineseDigitValue(normalized);
}

export function getRegionCoordinate(rawRegionText) {
  const raw = preserveCell(rawRegionText);
  const exact = KNOWN_REGION_COORDS[raw];
  if (exact) {
    return {
      raw,
      key: raw,
      base: { x: exact.x, y: exact.y, z: 0 },
      source: "exact",
    };
  }

  const anchorEntry = REGION_ANCHORS.find(([name]) => raw.includes(name));
  if (anchorEntry) {
    const [name, anchor] = anchorEntry;
    const angle = hashToUnit(`${raw}:angle`) * Math.PI * 2;
    const distance = anchor.radius * (0.35 + hashToUnit(`${raw}:distance`) * 0.65);
    return {
      raw,
      key: raw,
      base: {
        x: roundCoord(anchor.x + Math.cos(angle) * distance),
        y: roundCoord(anchor.y + Math.sin(angle) * distance),
        z: 0,
      },
      source: `derived:${name}`,
    };
  }

  const angle = hashToUnit(`${raw}:fallback-angle`) * Math.PI * 2;
  const distance = 20 + hashToUnit(`${raw}:fallback-distance`) * 45;
  return {
    raw,
    key: raw,
    base: {
      x: roundCoord(Math.cos(angle) * distance),
      y: roundCoord(Math.sin(angle) * distance),
      z: 0,
    },
    source: "hash-fallback",
  };
}

export function createRenderPerturbation(seedText, radius = 1.65) {
  const angle = hashToUnit(`${seedText}:perturb-angle`) * Math.PI * 2;
  const distance = hashToUnit(`${seedText}:perturb-distance`) * radius;
  return {
    x: roundCoord(Math.cos(angle) * distance),
    y: roundCoord(Math.sin(angle) * distance),
    z: roundCoord((hashToUnit(`${seedText}:perturb-z`) - 0.5) * 0.8),
  };
}

export function spreadClusteredNodes(nodes) {
  const grouped = new Map();
  nodes.forEach((node) => {
    const key = `${node.raw["地区"]}|${node.chronology.z}`;
    const group = grouped.get(key) ?? [];
    group.push(node);
    grouped.set(key, group);
  });

  grouped.forEach((group) => {
    const count = group.length;
    const baseRadius = count > 10 ? 3.1 : count > 4 ? 2.55 : 1.85;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    group.forEach((node, index) => {
      const ring = Math.sqrt(index + 0.35);
      const angle = index * goldenAngle + hashToUnit(`${node.id}:cluster-angle`) * 0.72;
      const clusterOffset = {
        x: roundCoord(Math.cos(angle) * ring * baseRadius),
        y: roundCoord(Math.sin(angle) * ring * baseRadius),
        z: roundCoord((index - (count - 1) / 2) * 0.62 + node.geography.perturbation.z),
      };

      node.geography.cluster = {
        index,
        count,
        offset: clusterOffset,
      };
      node.geography.position = {
        x: roundCoord(node.geography.base.x * REGION_RENDER_SCALE + clusterOffset.x),
        y: roundCoord(node.geography.base.y * REGION_RENDER_SCALE + clusterOffset.y),
        z: roundCoord(node.chronology.z + clusterOffset.z),
      };
    });
  });

  return nodes;
}

function rowToNode(row, headers, sourceRowNumber, options) {
  if (isEmptyCsvRow(row)) return null;

  const rawRow = Object.fromEntries(
    headers.map((header, index) => [header, preserveCell(row[index])]),
  );
  const sourceIndex = sourceRowNumber - 1;
  const name = rawRow["姓名"];
  const rankText = rawRow["名次"];
  const era = parseReignYear(rawRow["朝代"]);
  const region = getRegionCoordinate(rawRow["地区"]);
  const seed = `${sourceRowNumber}|${rawRow["朝代"]}|${rawRow["地区"]}|${name}|${rankText}`;
  const perturbation = createRenderPerturbation(seed, options.perturbationRadius ?? 1.65);
  const z = era.z ?? 0;

  return {
    id: `jinshi-${sourceRowNumber}-${stableHash(seed)}`,
    source: {
      rowNumber: sourceRowNumber + 1,
      rowIndex: sourceIndex,
      csvColumns: headers,
    },
    raw: rawRow,
    core: {
      name,
      rankText,
      label: [name, rankText].filter(Boolean).join("｜"),
    },
    chronology: {
      raw: era.raw,
      reignName: era.reignName,
      regnalYear: era.regnalYear,
      ganzhi: era.ganzhi,
      gregorianYear: era.gregorianYear,
      z,
    },
    geography: {
      raw: region.raw,
      key: region.key,
      base: region.base,
      perturbation,
      position: {
        x: roundCoord(region.base.x * REGION_RENDER_SCALE + perturbation.x),
        y: roundCoord(region.base.y * REGION_RENDER_SCALE + perturbation.y),
        z: roundCoord(z + perturbation.z),
      },
      coordinateSource: region.source,
    },
    metadata: biographyMetadata(rawRow),
    metadataDisplay: biographyDisplayMetadata(rawRow),
    parseWarnings: [era.warning].filter(Boolean),
  };
}

function biographyMetadata(rawRow) {
  return Object.fromEntries(
    BIOGRAPHY_COLUMNS.map((column) => [column, preserveCell(rawRow[column])]),
  );
}

function biographyDisplayMetadata(rawRow) {
  return Object.fromEntries(
    BIOGRAPHY_COLUMNS.map((column) => {
      const raw = preserveCell(rawRow[column]);
      return [column, raw.trim().length === 0 ? MISSING_TEXT : raw];
    }),
  );
}

function validateColumns(headers) {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  const extra = headers.filter((column) => !REQUIRED_COLUMNS.includes(column));
  const warnings = [];

  if (missing.length > 0) {
    throw new Error(`CSV missing required column(s): ${missing.join(", ")}`);
  }

  const orderedAsExpected = REQUIRED_COLUMNS.every(
    (column, index) => headers[index] === column,
  );
  if (!orderedAsExpected) {
    warnings.push(
      `CSV columns differ from the expected order: ${REQUIRED_COLUMNS.join(", ")}`,
    );
  }

  if (extra.length > 0) {
    warnings.push(`CSV contains extra column(s); preserved in raw row: ${extra.join(", ")}`);
  }

  return warnings;
}

function extractGanzhi(text) {
  return text.match(GANZHI_PATTERN)?.[0] ?? null;
}

function chineseDigitValue(text) {
  if (text.length !== 1) return null;
  return CHINESE_DIGIT[text] ?? null;
}

function preserveCell(value) {
  return value == null ? "" : String(value);
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function dropTerminalCarriageReturn(text) {
  return text.endsWith("\r") ? text.slice(0, -1) : text;
}

function isEmptyCsvRow(row) {
  return row.every((cell) => preserveCell(cell).trim().length === 0);
}

function stableHash(text) {
  let hash = 2166136261;
  const source = String(text);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function hashToUnit(text) {
  return parseInt(stableHash(text), 36) / 0xffffffff;
}

function roundCoord(value) {
  return Number(value.toFixed(4));
}
