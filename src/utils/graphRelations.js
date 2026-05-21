export const RELATION_TYPES = Object.freeze({
  nativePlace: {
    label: "籍贯相同",
    color: "#38bdf8",
  },
  kinship: {
    label: "亲属血缘",
    color: "#fb7185",
  },
  officePlace: {
    label: "同地任官",
    color: "#34d399",
  },
  localExam: {
    label: "同届乡试",
    color: "#fbbf24",
  },
});

const TEXT_FIELDS_FOR_KINSHIP = ["出身", "婚嫁", "轶事"];
const TEXT_FIELDS_FOR_OFFICE = ["任官经历", "轶事"];
const KINSHIP_TERMS =
  /父|母|祖|曾祖|高祖|祖父|祖母|伯|叔|兄|弟|姊|妹|子|嗣|孙|孙女|族|宗|亲|妻|娶|女|婿|外祖|甥|姻|家族|世家|昆仲|从兄|从弟/;
const LOCAL_EXAM_REIGN_PATTERN =
  /(顺治|康熙|雍正|乾隆|嘉庆|道光|咸丰|同治|光绪|宣统)[元一二三四五六七八九十百廿卅〇零两\d]+年/g;
const GANZHI_PATTERN = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;
const PLACE_PATTERN = /[\u4e00-\u9fa5]{2,10}?(?:省|府|州|县|道)/g;

export function createDefaultRelationModes(active = false) {
  return Object.fromEntries(
    Object.keys(RELATION_TYPES).map((key) => [key, active]),
  );
}

export function buildExplorationGraph(nodes, selectedNode, modes) {
  if (!selectedNode) {
    return emptyGraph(false);
  }

  const active = Object.keys(RELATION_TYPES).some((key) => modes[key]);
  const relatedIds = new Set([selectedNode.id]);
  const edgeMap = new Map();
  const countsByType = Object.fromEntries(
    Object.keys(RELATION_TYPES).map((key) => [key, 0]),
  );

  if (!active) {
    return { ...emptyGraph(false), relatedIds };
  }

  const selectedOfficePlaces = extractOfficePlaces(selectedNode);
  const selectedExamKeys = extractLocalExamKeys(selectedNode);

  nodes.forEach((node) => {
    if (node.id === selectedNode.id) return;

    if (modes.nativePlace && node.raw["地区"] === selectedNode.raw["地区"]) {
      addEdge(edgeMap, selectedNode, node, "nativePlace", selectedNode.raw["地区"]);
    }

    if (modes.kinship) {
      const evidence = getKinshipEvidence(selectedNode, node);
      if (evidence) {
        addEdge(edgeMap, selectedNode, node, "kinship", evidence);
      }
    }

    if (modes.officePlace) {
      const sharedPlaces = intersect(selectedOfficePlaces, extractOfficePlaces(node));
      if (sharedPlaces.length > 0) {
        addEdge(edgeMap, selectedNode, node, "officePlace", sharedPlaces.join("、"));
      }
    }

    if (modes.localExam) {
      const sharedExamKeys = intersect(selectedExamKeys, extractLocalExamKeys(node));
      if (sharedExamKeys.length > 0) {
        addEdge(edgeMap, selectedNode, node, "localExam", sharedExamKeys.join("、"));
      }
    }
  });

  const edges = [...edgeMap.values()];
  edges.forEach((edge) => {
    relatedIds.add(edge.to.id);
    countsByType[edge.type] += 1;
  });

  return {
    active,
    relatedIds,
    edges,
    countsByType,
  };
}

function emptyGraph(active) {
  return {
    active,
    relatedIds: new Set(),
    edges: [],
    countsByType: Object.fromEntries(Object.keys(RELATION_TYPES).map((key) => [key, 0])),
  };
}

function addEdge(edgeMap, from, to, type, evidence) {
  const key = `${from.id}:${to.id}:${type}`;
  if (edgeMap.has(key)) return;

  edgeMap.set(key, {
    id: key,
    type,
    label: RELATION_TYPES[type].label,
    evidence,
    from,
    to,
    color: RELATION_TYPES[type].color,
  });
}

function getKinshipEvidence(selectedNode, candidateNode) {
  const selectedText = collectText(selectedNode, TEXT_FIELDS_FOR_KINSHIP);
  const candidateText = collectText(candidateNode, TEXT_FIELDS_FOR_KINSHIP);
  const selectedName = selectedNode.core.name?.trim();
  const candidateName = candidateNode.core.name?.trim();

  if (candidateName && candidateName.length >= 2 && selectedText.includes(candidateName)) {
    return candidateName;
  }

  if (selectedName && selectedName.length >= 2 && candidateText.includes(selectedName)) {
    return selectedName;
  }

  const sameSurname = selectedName?.[0] && selectedName[0] === candidateName?.[0];
  const sameNativePlace = selectedNode.raw["地区"] === candidateNode.raw["地区"];
  if (sameSurname && sameNativePlace && (KINSHIP_TERMS.test(selectedText) || KINSHIP_TERMS.test(candidateText))) {
    return `${selectedName?.[0]}氏同籍亲缘线索`;
  }

  return null;
}

function extractOfficePlaces(node) {
  const text = collectText(node, TEXT_FIELDS_FOR_OFFICE);
  const matches = text.match(PLACE_PATTERN) ?? [];
  return unique(
    matches
      .map(cleanPlace)
      .filter((place) => place.length >= 2)
      .filter((place) => !/乡试|会试|殿试|进士|举人|出身/.test(place)),
  );
}

function extractLocalExamKeys(node) {
  const text = node.raw["名次"] ?? "";
  const normalized = text.replace(/\s+/g, "");
  const keys = [];
  const chunks = normalized.split(/[，。；、,.]/).filter(Boolean);

  chunks.forEach((chunk) => {
    if (!chunk.includes("乡试") && !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(chunk)) {
      return;
    }

    const reignMatches = [...chunk.matchAll(LOCAL_EXAM_REIGN_PATTERN)].map((match) => match[0]);
    if (reignMatches.length > 0) {
      keys.push(`${reignMatches[0]}乡试`);
      return;
    }

    const ganzhiMatches = [...chunk.matchAll(GANZHI_PATTERN)].map((match) => match[0]);
    if (ganzhiMatches.length > 0) {
      keys.push(`${ganzhiMatches[0]}乡试`);
    }
  });

  if (keys.length === 0 && normalized.includes("同年") && normalized.includes("乡试")) {
    keys.push(`${node.raw["朝代"]}乡试`);
  }

  return unique(keys);
}

function collectText(node, fields) {
  return fields.map((field) => node.metadata?.[field] ?? "").join("\n");
}

function cleanPlace(place) {
  return place
    .replace(/^(授|任|官|署|补|迁|历|至|为|知|候选|钦定|升|转|起家)+/, "")
    .replace(/^[，。；、\s]+|[，。；、\s]+$/g, "");
}

function intersect(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function unique(items) {
  return [...new Set(items)];
}
