import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "src", "data", "idioms.json");
const envPaths = [path.join(rootDir, ".env.local"), path.join(rootDir, ".env")];

const KCISA_URL = "https://api.kcisa.kr/openapi/service/rest/meta2018/getKRAG0420181";
const OPEN_DICT_URL = "https://opendict.korean.go.kr/api/search";
const CJK_FOUR_CHARS = /[\u3400-\u9fff]{4}/g;
const HANGUL = /^[가-힣\sㆍ·-]+$/;
const DEFAULT_LIMIT = 80;
const DEFAULT_DELAY_MS = 120;
const DEFAULT_CATEGORY = "학습";
const CATEGORY_RULES = [
  ["관계", ["친구", "우정", "부모", "사람", "서로", "아내", "스승"]],
  ["노력", ["노력", "고생", "실패", "도전", "견디", "공부", "배움"]],
  ["태도", ["행동", "말", "태도", "교만", "부끄", "망설", "제멋대로"]],
  ["지혜", ["방법", "기회", "미리", "꾀", "판단", "이치"]],
  ["위기", ["위험", "곤란", "어려운", "위기", "무너지", "막다"]],
  ["처세", ["권세", "이익", "수단", "대비", "해결", "살길"]],
  ["성장", ["발전", "출세", "인물", "이루", "나아"]],
  ["평가", ["뛰어난", "많", "우열", "겉", "속"]],
  ["감정", ["그리", "한탄", "원한", "마음", "슬픔"]],
  ["인과", ["결과", "받음", "원인", "해결해야"]],
];

const OPEN_DICT_SEEDS = [
  "일석이조",
  "칠전팔기",
  "동상이몽",
  "마이동풍",
  "이심전심",
  "온고지신",
  "타산지석",
  "고진감래",
  "대기만성",
  "화룡점정",
  "새옹지마",
  "사면초가",
  "정저지와",
  "조삼모사",
  "청출어람",
  "우공이산",
  "호가호위",
  "군계일학",
  "선견지명",
  "관포지교",
  "절차탁마",
  "자업자득",
  "인과응보",
  "견물생심",
  "백절불굴",
  "동문서답",
  "어부지리",
  "파죽지세",
  "불치하문",
  "과유불급",
  "기우",
  "맹모삼천",
  "괄목상대",
  "권토중래",
  "방약무인",
  "대우탄금",
  "다다익선",
  "양두구육",
  "유구무언",
  "침소봉대",
  "남가일몽",
  "자가당착",
  "일망타진",
  "조령모개",
  "결자해지",
  "중구난방",
  "지피지기",
  "와신상담",
  "파부침주",
];

function parseArgs() {
  const args = {
    delayMs: Number(process.env.WOORIMAL_DELAY_MS || DEFAULT_DELAY_MS),
    dryRun: false,
    limit: Number(process.env.WOORIMAL_LIMIT || DEFAULT_LIMIT),
    pageSize: Number(process.env.WOORIMAL_PAGE_SIZE || 100),
    source: process.env.WOORIMAL_SOURCE || "kcisa",
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg === "--dry-run") args.dryRun = true;
    if (arg.startsWith("--delay-ms=")) args.delayMs = Number(arg.split("=")[1]);
    if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=")[1]);
    if (arg.startsWith("--page-size=")) args.pageSize = Number(arg.split("=")[1]);
    if (arg.startsWith("--source=")) args.source = arg.split("=")[1];
  });

  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) args.delayMs = DEFAULT_DELAY_MS;
  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = DEFAULT_LIMIT;
  if (!Number.isFinite(args.pageSize) || args.pageSize < 1) args.pageSize = 100;
  return args;
}

async function loadEnv() {
  for (const envPath of envPaths) {
    try {
      const raw = await fs.readFile(envPath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const index = trimmed.indexOf("=");
        if (index < 0) return;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value) {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function parseXmlItems(xml) {
  return [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
}

function parseKcisaItem(xml) {
  const fields = [
    "title",
    "alternativeTitle",
    "description",
    "subDescription",
    "subject",
    "subjectKeyword",
    "sourceTitle",
  ];
  return Object.fromEntries(fields.map((field) => [field, tagValue(xml, field)]));
}

function parseOpenDictItem(xml) {
  return {
    title: tagValue(xml, "word"),
    alternativeTitle: tagValue(xml, "original_language"),
    description: tagValue(xml, "definition"),
    subDescription: tagValue(xml, "pos"),
    subject: "",
    subjectKeyword: "",
    sourceTitle: "",
    raw: stripHtml(xml),
  };
}

function cleanReading(value) {
  const reading = stripHtml(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\uac00-\ud7a3\sㆍ·-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return HANGUL.test(reading) ? reading.replace(/\s/g, "") : "";
}

function extractHanjaCandidate(record) {
  const haystack = Object.values(record).join(" ");
  const matches = [...haystack.matchAll(CJK_FOUR_CHARS)].map((match) => match[0]);
  return matches.find((value) => new Set([...value]).size >= 2) || "";
}

function inferCategory(meaning) {
  const normalized = String(meaning || "");
  const found = CATEGORY_RULES.find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  return found ? found[0] : DEFAULT_CATEGORY;
}

function toIdiomRecord(record) {
  const idiom = extractHanjaCandidate(record);
  if (!idiom) return null;

  const titleReading = cleanReading(record.title);
  const altReading = cleanReading(record.alternativeTitle);
  const reading = titleReading || altReading;
  if (!reading || reading.length < 2 || reading.length > 8) return null;

  const meaning = stripHtml(record.description);
  if (!meaning || meaning.length < 6) return null;

  return {
    idiom,
    reading,
    meaning: meaning.endsWith(".") || meaning.endsWith("다.") ? meaning : `${meaning}.`,
    category: inferCategory(meaning),
  };
}

function mergeIdioms(existing, fetched) {
  const byIdiom = new Map(existing.map((item) => [item.idiom, item]));
  const next = [...existing];
  let nextId = Math.max(...existing.map((item) => Number(item.id))) + 1;

  fetched.forEach((item) => {
    if (byIdiom.has(item.idiom)) return;
    const record = {
      id: String(nextId).padStart(3, "0"),
      ...item,
    };
    next.push(record);
    byIdiom.set(record.idiom, record);
    nextId += 1;
  });

  return next;
}

async function request(url, params) {
  const response = await fetch(`${url}?${params}`);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  if (body.includes("<error_code>020</error_code>")) {
    throw new Error(
      "우리말샘 인증키가 등록되지 않았습니다. opendict.korean.go.kr에서 발급받은 키인지 확인해 주세요.",
    );
  }
  if (body.includes("<OpenAPI_ServiceResponse>") || body.includes("SERVICE_KEY")) {
    throw new Error("공공데이터포털 서비스키가 거부되었습니다. 활용신청 승인 상태를 확인해 주세요.");
  }
  return body;
}

async function fetchKcisaIdioms({ delayMs, limit, pageSize }) {
  const serviceKey = process.env.WOORIMAL_API_KEY || process.env.KCISA_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("WOORIMAL_API_KEY 또는 KCISA_SERVICE_KEY가 필요합니다.");
  }

  const found = [];
  let pageNo = 1;

  while (found.length < limit) {
    const params = new URLSearchParams({
      serviceKey,
      numOfRows: String(pageSize),
      pageNo: String(pageNo),
    });
    const body = await request(KCISA_URL, params);
    const items = parseXmlItems(body).map(parseKcisaItem);
    const converted = items.map(toIdiomRecord).filter(Boolean);
    found.push(...converted);

    console.log(
      `kcisa page ${pageNo}: records=${items.length}, idioms=${converted.length}, total=${found.length}`,
    );

    if (items.length === 0) break;
    pageNo += 1;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return found.slice(0, limit);
}

async function fetchOpenDictIdioms({ delayMs, limit }) {
  const key = process.env.WOORIMAL_OPEN_DICT_KEY || process.env.WOORIMAL_API_KEY;
  if (!key) {
    throw new Error("WOORIMAL_OPEN_DICT_KEY 또는 WOORIMAL_API_KEY가 필요합니다.");
  }

  const found = [];
  const seeds = [...new Set(OPEN_DICT_SEEDS)].slice(0, Math.max(limit * 2, 20));

  for (const seed of seeds) {
    if (found.length >= limit) break;
    const params = new URLSearchParams({
      key,
      q: seed,
      advanced: "y",
      method: "exact",
      type1: "word",
      req_type: "xml",
    });
    const body = await request(OPEN_DICT_URL, params);
    const converted = parseXmlItems(body)
      .map(parseOpenDictItem)
      .map(toIdiomRecord)
      .filter(Boolean);
    found.push(...converted);
    console.log(`opendict "${seed}": idioms=${converted.length}, total=${found.length}`);
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return found.slice(0, limit);
}

async function main() {
  await loadEnv();
  const args = parseArgs();
  const existing = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const source = args.source.toLowerCase();

  const fetched =
    source === "opendict"
      ? await fetchOpenDictIdioms(args)
      : await fetchKcisaIdioms(args);
  const merged = mergeIdioms(existing, fetched);
  const added = merged.length - existing.length;

  console.log(`fetched=${fetched.length}, existing=${existing.length}, added=${added}`);

  if (args.dryRun) {
    console.log("dry-run: src/data/idioms.json was not changed.");
    return;
  }

  await fs.writeFile(dataPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`updated ${path.relative(rootDir, dataPath)} (${merged.length} records)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
