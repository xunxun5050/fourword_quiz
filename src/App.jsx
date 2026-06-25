import { useEffect, useMemo, useReducer, useState } from "react";
import {
  FaBolt,
  FaCalendarDay,
  FaChartBar,
  FaCheck,
  FaClock,
  FaFileAlt,
  FaHome,
  FaImage,
  FaMedal,
  FaPalette,
  FaPlay,
  FaRedoAlt,
  FaStopwatch,
  FaTimes,
  FaTrophy,
} from "react-icons/fa";
import idioms from "./data/idioms.json";

const TOTAL_SECONDS = 60;
const COUNTDOWN_SECONDS = 3;
const FEEDBACK_DELAY = 850;
const STORAGE_KEYS = {
  bestScore: "sjse_best_score",
  bestAccuracy: "sjse_best_accuracy",
  playCount: "sjse_play_count",
  dailyLeaderboard: "sjse_daily_leaderboard",
  gameTheme: "sjse_game_theme",
  nickname: "sjse_nickname",
  playerId: "sjse_player_id",
};
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim();
const MAX_LEADERBOARD_ENTRIES = 5;

const DIFFICULTIES = {
  easy: { label: "쉬움", seconds: 15 },
  normal: { label: "보통", seconds: 10 },
  hard: { label: "어려움", seconds: 7 },
};
const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);
const GAME_THEMES = {
  hanji: { label: "한지", description: "한지 보드", next: "notebook" },
  notebook: { label: "노트", description: "코랄 노트", next: "hanji" },
};
const GITHUB_REPOSITORY_URL = "https://github.com/xunxun5050/fourword_quiz";
const FEEDBACK_MAILTO = `mailto:contact@oshizi.com?subject=${encodeURIComponent(
  "사자성어 퀴즈 건의",
)}&body=${encodeURIComponent(
  `건의 내용을 적어주세요.\n\n관련 저장소: ${GITHUB_REPOSITORY_URL}`,
)}`;
const INFO_PAGE_LINKS = [
  { label: "건의하기", path: "/ko/feedback" },
  { label: "게임 방법", path: "/ko/how-to-play" },
  { label: "Contact", path: "/ko/contact" },
  { label: "이용약관", path: "/ko/terms" },
  { label: "개인정보", path: "/ko/privacy" },
  { label: "규칙", path: "/ko/rules" },
];
const INFO_PAGES = {
  "/ko/feedback": {
    title: "건의하기",
    summary:
      "사자성어 퀴즈가 더 재미있고 정확해질 수 있도록 의견을 보내주세요.",
    sections: [
      {
        heading: "어떤 의견이든 좋아요",
        body: [
          "문제 오류, 뜻풀이 수정, 난이도 조정, 새로운 기능 아이디어를 환영합니다.",
          "성어 추가 요청은 한자, 한글 독음, 뜻을 함께 적어주시면 검토가 더 빨라집니다.",
        ],
      },
      {
        heading: "보내면 좋은 정보",
        body: [
          "사용한 기기와 브라우저, 발생한 화면, 재현 방법을 적어주세요.",
          "리더보드나 결과 저장 관련 문제라면 닉네임과 대략적인 플레이 시간을 함께 알려주세요.",
          `관련 저장소: ${GITHUB_REPOSITORY_URL}`,
        ],
      },
    ],
    actions: [
      {
        href: FEEDBACK_MAILTO,
        label: "메일로 건의하기",
      },
    ],
  },
  "/ko/how-to-play": {
    title: "게임 방법",
    summary:
      "60초 동안 한자 빈칸 문제와 뜻풀이 문제를 빠르게 풀어 정답 수를 올리는 게임입니다.",
    sections: [
      {
        heading: "시작하기",
        body: [
          "홈 화면에서 난이도를 고른 뒤 게임 시작을 누르면 3초 카운트다운 후 문제가 시작됩니다.",
          "쉬움은 문제당 15초, 보통은 10초, 어려움은 7초가 주어집니다.",
        ],
      },
      {
        heading: "문제 유형",
        body: [
          "빈칸 한자는 사자성어의 ? 자리에 들어갈 한자를 고르는 문제입니다.",
          "뜻 보고 맞히기는 뜻풀이를 보고 알맞은 사자성어를 고르는 문제입니다.",
        ],
      },
      {
        heading: "점수와 결과",
        body: [
          "정답을 맞히면 1개 정답으로 기록되고, 60초가 끝나면 결과 화면에서 복기할 수 있습니다.",
          "결과 화면에서는 나온 성어와 뜻, 정답 여부를 텍스트나 이미지로 저장할 수 있습니다.",
        ],
      },
    ],
  },
  "/ko/contact": {
    title: "Contact",
    summary:
      "문의, 제휴, 오류 신고는 아래 안내에 맞춰 보내주세요.",
    sections: [
      {
        heading: "문의 범위",
        body: [
          "서비스 이용 문의, 콘텐츠 오류 제보, 광고 및 제휴 문의를 받을 수 있습니다.",
          "개인정보 관련 요청은 개인정보 페이지의 안내와 함께 확인해 주세요.",
        ],
      },
      {
        heading: "빠른 확인을 위한 정보",
        body: [
          "문의 목적, 발생한 화면, 사용 기기, 브라우저 정보를 함께 적어주시면 좋습니다.",
          "답변이 필요한 문의는 회신 가능한 이메일 주소를 함께 보내주세요.",
        ],
      },
    ],
    actions: [
      {
        href: "mailto:contact@oshizi.com?subject=%EC%82%AC%EC%9E%90%EC%84%B1%EC%96%B4%20%ED%80%B4%EC%A6%88%20%EB%AC%B8%EC%9D%98",
        label: "contact@oshizi.com",
      },
    ],
  },
  "/ko/terms": {
    title: "이용약관",
    summary:
      "사자성어 퀴즈를 이용하기 전에 알아두면 좋은 기본 약관입니다.",
    sections: [
      {
        heading: "서비스 목적",
        body: [
          "이 서비스는 사자성어 학습과 복습을 돕는 퀴즈형 콘텐츠입니다.",
          "게임 점수와 리더보드는 재미와 학습 동기를 위한 참고 정보로 제공됩니다.",
        ],
      },
      {
        heading: "이용자의 책임",
        body: [
          "서비스를 방해하거나 비정상적인 방법으로 점수, 리더보드, 저장 기능을 조작해서는 안 됩니다.",
          "닉네임에는 타인을 불쾌하게 하거나 권리를 침해하는 표현을 사용하지 않아야 합니다.",
        ],
      },
      {
        heading: "콘텐츠와 변경",
        body: [
          "성어 데이터와 뜻풀이는 정확성을 높이기 위해 계속 수정될 수 있습니다.",
          "서비스 화면, 기능, 정책은 운영 상황에 따라 사전 고지 후 변경될 수 있습니다.",
        ],
      },
    ],
  },
  "/ko/privacy": {
    title: "개인정보",
    summary:
      "사자성어 퀴즈에서 저장하거나 사용할 수 있는 정보와 목적을 안내합니다.",
    sections: [
      {
        heading: "저장되는 정보",
        body: [
          "브라우저에는 닉네임, 플레이어 식별값, 최고 기록, 플레이 횟수, 결과 저장 상태가 저장될 수 있습니다.",
          "리더보드 등록 시 닉네임, 점수, 정확도, 난이도, 시도 문제 수, 플레이 시간이 저장될 수 있습니다.",
        ],
      },
      {
        heading: "사용 목적",
        body: [
          "저장 정보는 게임 기록 유지, 하루 단위 리더보드 표시, 결과 복기를 위해 사용됩니다.",
          "민감한 개인정보나 결제 정보는 게임 기능을 위해 요구하지 않습니다.",
        ],
      },
      {
        heading: "광고와 외부 서비스",
        body: [
          "Google AdSense가 활성화된 경우 광고 제공을 위해 쿠키 또는 유사 기술이 사용될 수 있습니다.",
          "광고 개인화와 관련한 자세한 내용은 Google의 광고 및 개인정보 안내를 확인해 주세요.",
        ],
      },
    ],
  },
  "/ko/rules": {
    title: "규칙",
    summary:
      "게임 점수, 제한 시간, 리더보드 기준을 정리한 규칙입니다.",
    sections: [
      {
        heading: "기본 규칙",
        body: [
          "총 제한 시간은 60초이며, 시간이 끝나면 자동으로 결과 화면으로 이동합니다.",
          "각 문제는 난이도별 제한 시간 안에 선택해야 하고, 정답 1개마다 점수 1점이 올라갑니다.",
        ],
      },
      {
        heading: "난이도",
        body: [
          "쉬움은 문제와 선택지에 한글 힌트가 함께 제공됩니다.",
          "보통과 어려움은 더 빠른 판단을 요구하며, 문제당 제한 시간이 더 짧습니다.",
        ],
      },
      {
        heading: "리더보드",
        body: [
          "리더보드는 난이도별로 나뉘며 하루 동안 상위 5개 기록만 표시됩니다.",
          "하루 기준은 한국 시간으로 계산되며, 새 날짜가 되면 새 기록판으로 시작합니다.",
        ],
      },
    ],
  },
};
const HOME_PREVIEW_IDIOMS = idioms.slice(0, 6);
const HOME_GAME_GUIDE = [
  {
    title: "빈칸 한자",
    body: "사자성어 네 글자 중 비어 있는 한자를 보고 알맞은 글자를 고릅니다.",
  },
  {
    title: "뜻 보고 맞히기",
    body: "뜻풀이를 읽고 그 의미에 맞는 사자성어를 빠르게 찾아봅니다.",
  },
  {
    title: "결과 복기",
    body: "게임이 끝나면 나온 성어, 독음, 뜻을 다시 확인하고 따로 저장할 수 있습니다.",
  },
];
const HOME_DATA_NOTES = [
  "수록된 사자성어는 한자 표기, 한글 독음, 뜻풀이를 함께 볼 수 있도록 정리했습니다.",
  "우리말샘 기반 데이터를 게임에 맞게 다듬어 빈칸 문제와 뜻풀이 문제로 활용합니다.",
  "오류나 어색한 뜻풀이는 건의하기를 통해 알려주면 검토 후 반영할 수 있습니다.",
];
const NICKNAME_ADJECTIVES = [
  "반짝이는",
  "차분한",
  "날렵한",
  "청명한",
  "든든한",
  "명랑한",
  "느긋한",
  "또렷한",
  "푸른",
  "따뜻한",
];
const NICKNAME_NOUNS = [
  "붓",
  "별빛",
  "구름",
  "등불",
  "서책",
  "나침반",
  "매화",
  "소나무",
  "물결",
  "찻잔",
];

const INITIAL_STATS = {
  bestScore: 0,
  bestAccuracy: 0,
  playCount: 0,
};

const INITIAL_LEADERBOARD = {
  date: "",
  entriesByDifficulty: createEmptyLeaderboardEntries(),
};

const initialState = {
  phase: "home",
  difficulty: "normal",
  currentQuestion: null,
  questionNumber: 0,
  score: 0,
  attempted: 0,
  history: [],
  usedIds: [],
  selectedAnswer: null,
  lastResult: null,
  totalStartedAt: null,
  questionStartedAt: null,
  countdownStartedAt: null,
  feedbackUntil: null,
  resultSaved: true,
};

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getIdiomReadingChars(item) {
  return [...String(item.reading || "").replace(/[^가-힣]/g, "")];
}

function getCharacterReading(item, index) {
  return getIdiomReadingChars(item)[index] || "";
}

function findChoiceReading(char, index, allItems, source) {
  if ([...source.idiom][index] === char) {
    return getCharacterReading(source, index);
  }

  const match = allItems.find((candidate) => [...candidate.idiom][index] === char);
  return match ? getCharacterReading(match, index) : "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function fillChoices(groups, answer, size) {
  const result = [];

  groups.forEach((group) => {
    const candidates = shuffle(unique(group)).filter((item) => item !== answer);
    candidates.forEach((candidate) => {
      if (result.length < size && !result.includes(candidate)) {
        result.push(candidate);
      }
    });
  });

  return result.slice(0, size);
}

function makeTypeAQuestion(item, allItems) {
  const chars = [...item.idiom];
  const blankIndex = Math.floor(Math.random() * chars.length);
  const answer = chars[blankIndex];
  const sameCategoryChars = allItems
    .filter((candidate) => candidate.id !== item.id && candidate.category === item.category)
    .map((candidate) => [...candidate.idiom][blankIndex]);
  const samePositionChars = allItems
    .filter((candidate) => candidate.id !== item.id)
    .map((candidate) => [...candidate.idiom][blankIndex]);
  const randomChars = allItems.flatMap((candidate) => [...candidate.idiom]);
  const distractors = fillChoices(
    [sameCategoryChars, samePositionChars, randomChars],
    answer,
    3,
  );
  const choices = shuffle([answer, ...distractors]);

  return {
    type: "A",
    idiomId: item.id,
    answer,
    blankIndex,
    prompt: chars.map((char, index) => (index === blankIndex ? "?" : char)).join(""),
    promptReadings: getIdiomReadingChars(item),
    choices,
    choiceReadings: Object.fromEntries(
      choices.map((choice) => [choice, findChoiceReading(choice, blankIndex, allItems, item)]),
    ),
    source: item,
  };
}

function makeTypeBQuestion(item, allItems) {
  const sameCategoryIdioms = allItems
    .filter((candidate) => candidate.id !== item.id && candidate.category === item.category)
    .map((candidate) => candidate.idiom);
  const randomIdioms = allItems
    .filter((candidate) => candidate.id !== item.id && candidate.category !== item.category)
    .map((candidate) => candidate.idiom);
  const distractors = fillChoices([sameCategoryIdioms, randomIdioms], item.idiom, 3);
  const choices = shuffle([item.idiom, ...distractors]);

  return {
    type: "B",
    idiomId: item.id,
    answer: item.idiom,
    prompt: item.meaning,
    choices,
    choiceReadings: Object.fromEntries(
      choices.map((choice) => [
        choice,
        allItems.find((candidate) => candidate.idiom === choice)?.reading || "",
      ]),
    ),
    source: item,
  };
}

function makeQuestion(usedIds) {
  const remaining = idioms.filter((item) => !usedIds.includes(item.id));
  if (remaining.length === 0) {
    return { question: null, usedIds };
  }

  const item = sample(remaining);
  const type = Math.random() < 0.5 ? "A" : "B";
  const question =
    type === "A" ? makeTypeAQuestion(item, idioms) : makeTypeBQuestion(item, idioms);

  return {
    question,
    usedIds: [...usedIds, item.id],
  };
}

function secondsLeft(startedAt, duration, now) {
  if (!startedAt) return duration;
  return Math.max(0, duration - (now - startedAt) / 1000);
}

function displaySeconds(value) {
  return Math.ceil(Math.max(0, value));
}

function formatClock(value) {
  const seconds = displaySeconds(value);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function normalizeInfoPath(pathname) {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return INFO_PAGES[normalizedPath] ? normalizedPath : null;
}

function getInitialInfoPath() {
  if (typeof window === "undefined") return null;
  return normalizeInfoPath(window.location.pathname);
}

function loadStats() {
  if (typeof window === "undefined") return INITIAL_STATS;

  return {
    bestScore: Number(localStorage.getItem(STORAGE_KEYS.bestScore) || 0),
    bestAccuracy: Number(localStorage.getItem(STORAGE_KEYS.bestAccuracy) || 0),
    playCount: Number(localStorage.getItem(STORAGE_KEYS.playCount) || 0),
  };
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEYS.bestScore, String(stats.bestScore));
  localStorage.setItem(STORAGE_KEYS.bestAccuracy, String(stats.bestAccuracy));
  localStorage.setItem(STORAGE_KEYS.playCount, String(stats.playCount));
}

function getTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function createEmptyLeaderboardEntries() {
  return Object.fromEntries(DIFFICULTY_KEYS.map((difficulty) => [difficulty, []]));
}

function createDailyLeaderboard(date = getTodayKey()) {
  return {
    date,
    entriesByDifficulty: createEmptyLeaderboardEntries(),
  };
}

function sortLeaderboardEntries(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];

  return safeEntries
    .filter((entry) => Number(entry.attempted) > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.totalTimeSpent !== b.totalTimeSpent) return a.totalTimeSpent - b.totalTimeSpent;
      return new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

function normalizeDailyLeaderboard(saved, today = getTodayKey()) {
  if (!saved || saved.date !== today) {
    return createDailyLeaderboard(today);
  }

  const normalized = createDailyLeaderboard(saved.date);

  if (saved.entriesByDifficulty && typeof saved.entriesByDifficulty === "object") {
    DIFFICULTY_KEYS.forEach((difficulty) => {
      normalized.entriesByDifficulty[difficulty] = sortLeaderboardEntries(
        saved.entriesByDifficulty[difficulty] || [],
      );
    });
    return normalized;
  }

  if (Array.isArray(saved.entries)) {
    saved.entries.forEach((entry) => {
      const difficulty = DIFFICULTIES[entry.difficulty] ? entry.difficulty : "normal";
      normalized.entriesByDifficulty[difficulty].push({ ...entry, difficulty });
    });

    DIFFICULTY_KEYS.forEach((difficulty) => {
      normalized.entriesByDifficulty[difficulty] = sortLeaderboardEntries(
        normalized.entriesByDifficulty[difficulty],
      );
    });
  }

  return normalized;
}

function loadDailyLeaderboard() {
  if (typeof window === "undefined") return INITIAL_LEADERBOARD;

  const today = getTodayKey();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyLeaderboard) || "null");
    return normalizeDailyLeaderboard(saved, today);
  } catch {
    return createDailyLeaderboard(today);
  }
}

function saveDailyLeaderboard(leaderboard) {
  localStorage.setItem(STORAGE_KEYS.dailyLeaderboard, JSON.stringify(leaderboard));
}

function createRandomNickname() {
  const adjective = sample(NICKNAME_ADJECTIVES);
  const noun = sample(NICKNAME_NOUNS);
  const suffix = Math.floor(100 + Math.random() * 900);

  return `${adjective}${noun}${suffix}`;
}

function createPlayerId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadPlayerProfile() {
  if (typeof window === "undefined") {
    return { nickname: createRandomNickname(), playerId: createPlayerId() };
  }

  const savedNickname = localStorage.getItem(STORAGE_KEYS.nickname);
  const savedPlayerId = localStorage.getItem(STORAGE_KEYS.playerId);
  const profile = {
    nickname: savedNickname || createRandomNickname(),
    playerId: savedPlayerId || createPlayerId(),
  };

  localStorage.setItem(STORAGE_KEYS.nickname, profile.nickname);
  localStorage.setItem(STORAGE_KEYS.playerId, profile.playerId);

  return profile;
}

function loadGameTheme() {
  if (typeof window === "undefined") return "hanji";

  const savedTheme = localStorage.getItem(STORAGE_KEYS.gameTheme);
  return GAME_THEMES[savedTheme] ? savedTheme : "hanji";
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error("Leaderboard API unavailable");
  }

  return response.json();
}

async function fetchSharedLeaderboard() {
  const response = await fetch("/api/leaderboard", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const data = await parseJsonResponse(response);

  return normalizeDailyLeaderboard(data.leaderboard, getTodayKey());
}

async function submitSharedLeaderboard(entry) {
  const response = await fetch("/api/leaderboard", {
    body: JSON.stringify(entry),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = await parseJsonResponse(response);

  return normalizeDailyLeaderboard(data.leaderboard, getTodayKey());
}

function formatPlayedAt(isoDate) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(isoDate));
}

function buildLeaderboardEntry({ accuracy, difficulty, score, attempted, history, playerProfile }) {
  const now = new Date();
  const totalTimeSpent = history.reduce((sum, record) => sum + record.timeSpent, 0);
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: playerProfile.nickname,
    playerId: playerProfile.playerId,
    score,
    accuracy,
    attempted,
    difficulty,
    playedAt: now.toISOString(),
    totalTimeSpent: Number(totalTimeSpent.toFixed(1)),
  };
}

function isBetterLeaderboardEntry(next, previous) {
  if (!previous) return true;
  if (next.score !== previous.score) return next.score > previous.score;
  if (next.accuracy !== previous.accuracy) return next.accuracy > previous.accuracy;
  if (next.totalTimeSpent !== previous.totalTimeSpent) {
    return next.totalTimeSpent < previous.totalTimeSpent;
  }

  return new Date(next.playedAt).getTime() > new Date(previous.playedAt).getTime();
}

function updateDailyLeaderboard(current, entry) {
  const today = getTodayKey();
  const normalized =
    current.date === today ? normalizeDailyLeaderboard(current, today) : createDailyLeaderboard(today);
  const difficulty = DIFFICULTIES[entry.difficulty] ? entry.difficulty : "normal";
  const entries = normalized.entriesByDifficulty[difficulty] || [];
  const previous = entries.find((item) => item.playerId && item.playerId === entry.playerId);
  const mergedEntries = entries.filter((item) => !entry.playerId || item.playerId !== entry.playerId);

  if (isBetterLeaderboardEntry(entry, previous)) {
    mergedEntries.push(entry);
  } else if (previous) {
    mergedEntries.push(previous);
  }

  return {
    date: today,
    entriesByDifficulty: {
      ...normalized.entriesByDifficulty,
      [difficulty]: sortLeaderboardEntries(mergedEntries.map((item) => ({ ...item, difficulty }))),
    },
  };
}

function getLeaderboardEntries(leaderboard, difficulty) {
  const difficultyKey = DIFFICULTIES[difficulty] ? difficulty : "normal";
  if (leaderboard.entriesByDifficulty) {
    return leaderboard.entriesByDifficulty[difficultyKey] || [];
  }

  if (Array.isArray(leaderboard.entries)) {
    return leaderboard.entries.filter((entry) => entry.difficulty === difficultyKey);
  }

  return [];
}

function getAccuracy(score, attempted) {
  if (attempted === 0) return 0;
  return Math.round((score / attempted) * 100);
}

function getGrade(accuracy) {
  if (accuracy >= 90) return "사자성어 마스터";
  if (accuracy >= 70) return "사자성어 고수";
  if (accuracy >= 50) return "사자성어 중급";
  if (accuracy >= 30) return "사자성어 입문";
  return "다시 도전";
}

function getExportTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("");
}

function getAnswerLabel(record) {
  if (record.correct) return "정답";
  if (record.userAnswer === null) return "시간 초과";
  return "오답";
}

function getRecordAnswer(record) {
  return record.userAnswer ?? "시간 초과";
}

function buildResultExportText({ history }) {
  const lines = ["No\t사자성어 훈음\t뜻"];

  history.forEach((record, index) => {
    lines.push(
      `${index + 1}\t${record.source.idiom} (${record.source.reading})\t${record.source.meaning}`,
    );
  });

  return lines.join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function wrapCanvasText(context, text, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    let chunk = "";
    [...word].forEach((char) => {
      const testChunk = `${chunk}${char}`;
      if (context.measureText(testChunk).width <= maxWidth) {
        chunk = testChunk;
      } else {
        lines.push(chunk);
        chunk = char;
      }
    });
    currentLine = chunk;
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  const lines = wrapCanvasText(context, text, maxWidth);
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
  return lines.length * lineHeight;
}

function buildResultImageBlob({ accuracy, difficulty, history, score }) {
  return new Promise((resolve, reject) => {
    const width = 1200;
    const rowBaseHeight = 240;
    const height = Math.max(760, 330 + Math.max(1, history.length) * rowBaseHeight);
    const canvas = document.createElement("canvas");
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("이미지 생성에 실패했습니다."));
      return;
    }

    context.scale(scale, scale);
    context.fillStyle = "#fffdf6";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#f25a48";
    context.fillRect(0, 0, 18, height);
    context.fillStyle = "#09878f";
    context.fillRect(width - 18, 0, 18, height);

    context.fillStyle = "#162027";
    context.font = "900 54px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    context.fillText("사자성어 퀴즈 결과", 64, 84);
    context.fillStyle = "#f25a48";
    context.font = "900 88px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    context.fillText(`${score}개 정답`, 64, 180);

    context.fillStyle = "#162027";
    context.font = "800 28px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    context.fillText(
      `정확도 ${accuracy}% · 시도 ${history.length}문제 · 난이도 ${DIFFICULTIES[difficulty].label}`,
      64,
      230,
    );
    context.fillStyle = "rgba(22, 32, 39, 0.62)";
    context.font = "700 22px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    context.fillText(`저장일시 ${new Date().toLocaleString("ko-KR")}`, 64, 270);

    context.strokeStyle = "rgba(9, 135, 143, 0.55)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(64, 306);
    context.lineTo(width - 64, 306);
    context.stroke();

    let y = 366;
    const rows = history.length > 0 ? history : [];
    if (rows.length === 0) {
      context.fillStyle = "rgba(22, 32, 39, 0.7)";
      context.font = "800 30px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
      context.fillText("저장할 문제 기록이 없습니다.", 64, y);
    }

    rows.forEach((record, index) => {
      const isCorrect = record.correct;
      context.fillStyle = isCorrect ? "#0ba968" : "#e94b3c";
      context.fillRect(64, y - 38, 44, 44);
      context.fillStyle = "#ffffff";
      context.font = "900 26px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
      context.fillText(isCorrect ? "O" : "X", 76, y - 8);

      context.fillStyle = "#162027";
      context.font = "900 38px Songti SC, AppleMyungjo, serif";
      context.fillText(`${index + 1}. ${record.source.idiom}`, 128, y);

      context.fillStyle = "rgba(22, 32, 39, 0.72)";
      context.font = "800 22px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
      context.fillText(`${record.source.reading} · ${getAnswerLabel(record)}`, 128, y + 34);

      context.fillStyle = "#162027";
      context.font = "700 24px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
      const meaningHeight = drawWrappedText(
        context,
        `뜻: ${record.source.meaning}`,
        128,
        y + 72,
        width - 210,
        32,
      );

      context.fillStyle = isCorrect ? "#075d65" : "#a53127";
      context.font = "800 21px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
      const answerY = y + 84 + meaningHeight;
      context.fillText(
        `내 답: ${getRecordAnswer(record)} · 정답: ${record.answer} · ${record.timeSpent.toFixed(1)}초`,
        128,
        answerY,
      );

      const separatorY = Math.max(y + rowBaseHeight - 34, answerY + 26);
      context.strokeStyle = "rgba(15, 35, 42, 0.16)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(64, separatorY);
      context.lineTo(width - 64, separatorY);
      context.stroke();

      y = separatorY + 46;
    });

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("이미지 저장 파일을 만들 수 없습니다."));
      }
    }, "image/png");
  });
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_DIFFICULTY":
      return state.phase === "home" ? { ...state, difficulty: action.difficulty } : state;
    case "SHOW_LEADERBOARD":
      return {
        ...initialState,
        phase: "leaderboard",
        difficulty: action.difficulty,
      };
    case "COUNTDOWN":
      return {
        ...initialState,
        phase: "countdown",
        difficulty: action.difficulty,
        countdownStartedAt: action.now,
      };
    case "START": {
      const now = action.now;
      const { question, usedIds } = makeQuestion([]);
      return {
        ...initialState,
        phase: "playing",
        difficulty: action.difficulty,
        currentQuestion: question,
        questionNumber: 1,
        usedIds,
        totalStartedAt: now,
        questionStartedAt: now,
        countdownStartedAt: null,
        resultSaved: false,
      };
    }
    case "ANSWER": {
      if (state.phase !== "playing" || !state.currentQuestion) return state;
      const now = action.now;
      const questionDuration = DIFFICULTIES[state.difficulty].seconds;
      const userAnswer = action.answer;
      const timedOut = userAnswer === null;
      const correct = !timedOut && userAnswer === state.currentQuestion.answer;
      const timeSpent = Math.min(
        questionDuration,
        Math.max(0, (now - state.questionStartedAt) / 1000),
      );
      const record = {
        idiomId: state.currentQuestion.idiomId,
        type: state.currentQuestion.type,
        prompt: state.currentQuestion.prompt,
        answer: state.currentQuestion.answer,
        userAnswer,
        correct,
        timeSpent,
        source: state.currentQuestion.source,
      };

      return {
        ...state,
        phase: "feedback",
        score: state.score + (correct ? 1 : 0),
        attempted: state.attempted + 1,
        history: [...state.history, record],
        selectedAnswer: userAnswer,
        lastResult: timedOut ? "timeout" : correct ? "correct" : "wrong",
        feedbackUntil: now + FEEDBACK_DELAY,
      };
    }
    case "NEXT": {
      if (state.phase !== "feedback") return state;
      const { question, usedIds } = makeQuestion(state.usedIds);
      if (!question) {
        return { ...state, phase: "result", currentQuestion: null, resultSaved: false };
      }

      return {
        ...state,
        phase: "playing",
        currentQuestion: question,
        usedIds,
        questionNumber: state.questionNumber + 1,
        selectedAnswer: null,
        lastResult: null,
        feedbackUntil: null,
        questionStartedAt: action.now,
      };
    }
    case "END":
      return {
        ...state,
        phase: "result",
        currentQuestion: null,
        selectedAnswer: null,
        lastResult: null,
        feedbackUntil: null,
        resultSaved: false,
      };
    case "HOME":
      return { ...initialState, difficulty: state.difficulty };
    case "MARK_SAVED":
      return { ...state, resultSaved: true };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState(loadStats);
  const [dailyLeaderboard, setDailyLeaderboard] = useState(loadDailyLeaderboard);
  const [exportState, setExportState] = useState("idle");
  const [gameTheme, setGameTheme] = useState(loadGameTheme);
  const [playerProfile] = useState(loadPlayerProfile);
  const [infoPath, setInfoPath] = useState(getInitialInfoPath);

  const questionDuration = DIFFICULTIES[state.difficulty].seconds;
  const totalLeft = secondsLeft(state.totalStartedAt, TOTAL_SECONDS, now);
  const questionLeft = secondsLeft(state.questionStartedAt, questionDuration, now);
  const questionProgress = Math.max(0, Math.min(1, questionLeft / questionDuration));
  const infoPage = infoPath ? INFO_PAGES[infoPath] : null;
  const countdownLeft =
    state.phase === "countdown" && state.countdownStartedAt
      ? Math.max(
          1,
          Math.ceil(COUNTDOWN_SECONDS - (now - state.countdownStartedAt) / 1000),
        )
      : COUNTDOWN_SECONDS;
  const accuracy = getAccuracy(state.score, state.attempted);

  useEffect(() => {
    function handlePopState() {
      setInfoPath(getInitialInfoPath());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = infoPage ? `${infoPage.title} | 사자성어 퀴즈` : "사자성어 퀴즈";
  }, [infoPage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.gameTheme, gameTheme);
  }, [gameTheme]);

  useEffect(() => {
    if (
      state.phase !== "countdown" &&
      state.phase !== "playing" &&
      state.phase !== "feedback"
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [state.phase]);

  useEffect(() => {
    let cancelled = false;

    async function refreshLeaderboard() {
      try {
        const sharedLeaderboard = await fetchSharedLeaderboard();
        if (cancelled) return;
        saveDailyLeaderboard(sharedLeaderboard);
        setDailyLeaderboard(sharedLeaderboard);
      } catch {
        if (cancelled) return;
        setDailyLeaderboard((current) => {
          const today = getTodayKey();
          if (current.date === today) return current;

          const resetLeaderboard = createDailyLeaderboard(today);
          saveDailyLeaderboard(resetLeaderboard);
          return resetLeaderboard;
        });
      }
    }

    refreshLeaderboard();
    const interval = window.setInterval(refreshLeaderboard, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (state.phase === "countdown") {
      if (!state.countdownStartedAt) return;
      if (now - state.countdownStartedAt >= COUNTDOWN_SECONDS * 1000) {
        const startedAt = Date.now();
        setNow(startedAt);
        dispatch({ type: "START", difficulty: state.difficulty, now: startedAt });
      }
      return;
    }

    if (state.phase !== "playing" && state.phase !== "feedback") return;

    if (totalLeft <= 0) {
      dispatch({ type: "END" });
      return;
    }

    if (state.phase === "playing" && questionLeft <= 0) {
      dispatch({ type: "ANSWER", answer: null, now });
      return;
    }

    if (state.phase === "feedback" && state.feedbackUntil && now >= state.feedbackUntil) {
      dispatch({ type: "NEXT", now });
    }
  }, [
    now,
    questionLeft,
    state.countdownStartedAt,
    state.difficulty,
    state.feedbackUntil,
    state.phase,
    totalLeft,
  ]);

  useEffect(() => {
    if (state.phase !== "result" || state.resultSaved) return;

    const leaderboardEntry =
      state.attempted > 0
        ? buildLeaderboardEntry({
            accuracy,
            difficulty: state.difficulty,
            score: state.score,
            attempted: state.attempted,
            history: state.history,
            playerProfile,
          })
        : null;
    const nextStats = {
      bestScore: Math.max(stats.bestScore, state.score),
      bestAccuracy: Math.max(stats.bestAccuracy, accuracy),
      playCount: stats.playCount + 1,
    };
    const nextLeaderboard =
      leaderboardEntry
        ? updateDailyLeaderboard(dailyLeaderboard, leaderboardEntry)
        : dailyLeaderboard;
    saveStats(nextStats);
    if (leaderboardEntry) {
      saveDailyLeaderboard(nextLeaderboard);
      submitSharedLeaderboard(leaderboardEntry)
        .then((sharedLeaderboard) => {
          saveDailyLeaderboard(sharedLeaderboard);
          setDailyLeaderboard(sharedLeaderboard);
        })
        .catch(() => {});
    }
    setStats(nextStats);
    setDailyLeaderboard(nextLeaderboard);
    dispatch({ type: "MARK_SAVED" });
  }, [
    accuracy,
    dailyLeaderboard,
    state.attempted,
    state.difficulty,
    state.history,
    state.phase,
    state.resultSaved,
    state.score,
    stats,
    playerProfile,
  ]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (state.phase !== "playing") return;
      if (!["1", "2", "3", "4"].includes(event.key)) return;
      const choice = state.currentQuestion?.choices[Number(event.key) - 1];
      if (choice) {
        event.preventDefault();
        submitAnswer(choice);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const resultLabel = useMemo(() => {
    if (state.lastResult === "correct") return "정답!";
    if (state.lastResult === "wrong") return "오답!";
    if (state.lastResult === "timeout") return "시간 초과!";
    return "";
  }, [state.lastResult]);

  function navigateInfoPage(path, event) {
    if (
      event &&
      (event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey)
    ) {
      return;
    }

    event?.preventDefault();
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setInfoPath(path);
  }

  function navigateHomeRoute() {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }
    setInfoPath(null);
    dispatch({ type: "HOME" });
  }

  function showLeaderboardPreview() {
    dispatch({ type: "SHOW_LEADERBOARD", difficulty: state.difficulty });
  }

  function startGame() {
    const startedAt = Date.now();
    setNow(startedAt);
    dispatch({ type: "COUNTDOWN", difficulty: state.difficulty, now: startedAt });
  }

  function toggleGameTheme() {
    setGameTheme((currentTheme) => GAME_THEMES[currentTheme]?.next || "hanji");
  }

  function submitAnswer(answer) {
    if (state.phase !== "playing") return;
    const correct = answer === state.currentQuestion.answer;
    if (navigator.vibrate) {
      navigator.vibrate(correct ? 30 : [25, 25, 25]);
    }
    dispatch({ type: "ANSWER", answer, now: Date.now() });
  }

  function exportTextResult() {
    if (state.history.length === 0) return;
    const text = buildResultExportText({
      history: state.history,
    });
    const filename = `sajaseongeo-result-${getExportTimestamp()}.txt`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });

    downloadBlob(blob, filename);
    setExportState("text");
    window.setTimeout(() => setExportState("idle"), 1600);
  }

  async function exportImageResult() {
    if (state.history.length === 0) return;
    try {
      const blob = await buildResultImageBlob({
        accuracy,
        difficulty: state.difficulty,
        history: state.history,
        score: state.score,
      });
      downloadBlob(blob, `sajaseongeo-result-${getExportTimestamp()}.png`);
      setExportState("image");
      window.setTimeout(() => setExportState("idle"), 1600);
    } catch {
      setExportState("failed");
      window.setTimeout(() => setExportState("idle"), 1600);
    }
  }

  if (infoPage) {
    return <InfoPage page={infoPage} onHome={navigateHomeRoute} />;
  }

  return (
    <main className={`app-shell is-${state.phase}-phase theme-${gameTheme}`}>
      <AdSenseAuto enabled={state.phase === "home"} />
      <div className="arcade-stage">
        {state.phase !== "countdown" &&
          state.phase !== "leaderboard" &&
          state.phase !== "result" && (
          <Hud
            phase={state.phase}
            difficulty={state.difficulty}
            onDifficultyChange={(difficulty) =>
              dispatch({ type: "SET_DIFFICULTY", difficulty })
            }
            onHome={() => dispatch({ type: "HOME" })}
            questionNumber={state.questionNumber}
            score={state.score}
            totalLeft={totalLeft}
          />
        )}

        {state.phase === "home" && (
          <HomeView
            difficulty={state.difficulty}
            gameTheme={gameTheme}
            onDifficultyChange={(difficulty) =>
              dispatch({ type: "SET_DIFFICULTY", difficulty })
            }
            onNavigateInfo={navigateInfoPage}
            onStart={showLeaderboardPreview}
            onThemeToggle={toggleGameTheme}
          />
        )}

        {state.phase === "leaderboard" && (
          <LeaderboardPreviewView
            difficulty={state.difficulty}
            leaderboard={dailyLeaderboard}
            onHome={() => dispatch({ type: "HOME" })}
            onStart={startGame}
          />
        )}

        {state.phase === "countdown" && <CountdownView count={countdownLeft} />}

        {(state.phase === "playing" || state.phase === "feedback") && state.currentQuestion && (
          <GameView
            currentQuestion={state.currentQuestion}
            difficulty={state.difficulty}
            lastResult={state.lastResult}
            onAnswer={submitAnswer}
            onFinish={() => dispatch({ type: "END" })}
            onHome={() => dispatch({ type: "HOME" })}
            questionLeft={questionLeft}
            questionProgress={questionProgress}
            resultLabel={resultLabel}
            selectedAnswer={state.selectedAnswer}
            totalLeft={totalLeft}
          />
        )}

        {state.phase === "result" && (
          <ResultView
            accuracy={accuracy}
            difficulty={state.difficulty}
            history={state.history}
            dailyLeaderboard={dailyLeaderboard}
            exportState={exportState}
            onExportImage={exportImageResult}
            onExportText={exportTextResult}
            onHome={() => dispatch({ type: "HOME" })}
            onRestart={startGame}
            playerProfile={playerProfile}
            score={state.score}
            stats={stats}
          />
        )}

        <p className="sr-only" aria-live="polite">
          {state.phase === "countdown"
            ? `게임 시작까지 ${countdownLeft}초`
            : state.phase === "leaderboard"
              ? `오늘의 ${DIFFICULTIES[state.difficulty].label} 난이도 리더보드`
            : `전체 남은 시간 ${displaySeconds(totalLeft)}초, 문제 남은 시간 ${displaySeconds(
                questionLeft,
              )}초, 현재 점수 ${state.score}점`}
        </p>
      </div>
    </main>
  );
}

function AdSenseAuto({ enabled }) {
  useEffect(() => {
    if (!enabled || !ADSENSE_CLIENT || ADSENSE_CLIENT === "ca-pub-0000000000000000") {
      return undefined;
    }

    const scriptId = "adsense-auto-ads";
    if (document.getElementById(scriptId)) {
      return undefined;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      ADSENSE_CLIENT,
    )}`;
    document.head.appendChild(script);

    return () => {
      script.remove();
      document
        .querySelectorAll(".google-auto-placed, ins.adsbygoogle")
        .forEach((element) => element.remove());
    };
  }, [enabled]);

  return null;
}

function InfoPage({ onHome, page }) {
  return (
    <main className="app-shell is-info-phase">
      <article className="info-stage">
        <button className="info-home-button" onClick={onHome} type="button">
          <FaHome /> 게임으로 돌아가기
        </button>

        <header className="info-header">
          <span>사자성어 퀴즈</span>
          <h1>{page.title}</h1>
          <p>{page.summary}</p>
        </header>

        <div className="info-sections">
          {page.sections.map((section) => (
            <section className="info-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        {page.actions && (
          <div className="info-actions">
            {page.actions.map((action) => (
              <a className="primary-action" href={action.href} key={action.href}>
                {action.label}
              </a>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}

function Hud({
  difficulty,
  onDifficultyChange,
  onHome,
  phase,
  questionNumber,
  score,
  totalLeft,
}) {
  const homeDisabled = phase === "home";
  const selectedDifficulty = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;

  return (
    <header className="hud">
      <div className="logo-lockup" aria-label="사자성어 퀴즈">
        <span className="logo-hanja" aria-hidden="true">四字</span>
        <span className="logo-copy">
          <span>사자성어</span>
          <strong>퀴즈</strong>
        </span>
        <span className="logo-spark" aria-hidden="true">!</span>
      </div>

      {phase !== "home" && (
        <div className="hud-metrics" aria-label="게임 정보">
          <Metric icon={<FaClock />} label="전체 시간" value={formatClock(totalLeft)} danger={totalLeft < 10} />
          <Metric icon={<FaTrophy />} label="점수" value={score} />
          <Metric icon={<FaBolt />} label="문제" value={`Q.${Math.max(1, questionNumber || 1)}`} />
        </div>
      )}

      {phase === "home" ? (
        <div className="difficulty-group" aria-label="난이도">
          {Object.entries(DIFFICULTIES).map(([key, value]) => (
            <button
              aria-pressed={difficulty === key}
              className={`difficulty-button ${difficulty === key ? "is-active" : ""}`}
              disabled={phase !== "home"}
              key={key}
              onClick={() => onDifficultyChange(key)}
              type="button"
            >
              {value.label}
            </button>
          ))}
        </div>
      ) : (
        <div
          aria-label={`현재 난이도 ${selectedDifficulty.label}, 문제당 ${selectedDifficulty.seconds}초`}
          className="difficulty-chip"
        >
          <span>난이도</span>
          <strong>{selectedDifficulty.label}</strong>
        </div>
      )}

      <button
        aria-label="홈으로"
        className="icon-home"
        disabled={homeDisabled}
        onClick={onHome}
        title="홈으로"
        type="button"
      >
        <FaHome />
      </button>
    </header>
  );
}

function Metric({ danger = false, icon, label, value }) {
  return (
    <div className={`metric ${danger ? "is-danger" : ""}`}>
      <span className="metric-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HomeView({
  difficulty,
  gameTheme,
  onDifficultyChange,
  onNavigateInfo,
  onStart,
  onThemeToggle,
}) {
  const currentTheme = GAME_THEMES[gameTheme] || GAME_THEMES.hanji;
  const nextTheme = GAME_THEMES[currentTheme.next] || GAME_THEMES.hanji;

  return (
    <section className="home-view">
      <button
        aria-label={`현재 테마 ${currentTheme.description}. ${nextTheme.description} 테마로 변경`}
        className="theme-toggle"
        onClick={onThemeToggle}
        title={`${currentTheme.description} 테마`}
        type="button"
      >
        <FaPalette aria-hidden="true" />
        <span>{currentTheme.label}</span>
      </button>

      <div className="home-hero">
        <div className="landing-panel">
          <div className="landing-copy">
            <strong className="landing-title">사자성어 퀴즈</strong>
            <span className="landing-mark" aria-hidden="true">四字</span>
            <p className="landing-lead">60초 사자성어 스프린트</p>
          </div>
          <div className="difficulty-picker">
            <span>난이도 선택</span>
            <div className="difficulty-group is-large">
              {Object.entries(DIFFICULTIES).map(([key, value]) => (
                <button
                  aria-pressed={difficulty === key}
                  className={`difficulty-button ${difficulty === key ? "is-active" : ""}`}
                  key={key}
                  onClick={() => onDifficultyChange(key)}
                  type="button"
                >
                  {value.label}
                  <small>{value.seconds}초</small>
                </button>
              ))}
            </div>
          </div>

          <button className="primary-action" onClick={onStart} type="button">
            <FaPlay /> 게임 시작
          </button>
        </div>
      </div>

      <div className="home-content" aria-label="사자성어 학습 콘텐츠">
        <section className="home-content-section">
          <div className="home-section-heading">
            <span>미리 보기</span>
            <h2>오늘의 예시 성어</h2>
            <p>
              한자 모양과 한글 독음, 뜻을 함께 보면 빈칸 문제와 뜻풀이 문제를
              더 자연스럽게 풀 수 있습니다.
            </p>
          </div>
          <ul className="idiom-preview-list">
            {HOME_PREVIEW_IDIOMS.map((item) => (
              <li key={item.id}>
                <strong>{item.idiom}</strong>
                <span>{item.reading}</span>
                <p>{item.meaning}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-content-section">
          <div className="home-section-heading">
            <span>게임 설명</span>
            <h2>뜻과 한자를 번갈아 익혀요</h2>
            <p>
              사자성어 퀴즈는 제한 시간 안에 뜻과 한자를 빠르게 연결해보는
              학습형 게임입니다.
            </p>
          </div>
          <div className="home-guide-grid">
            {HOME_GAME_GUIDE.map((item) => (
              <article className="home-guide-item" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-content-section">
          <div className="home-section-heading">
            <span>수록 데이터 안내</span>
            <h2>한자, 독음, 뜻을 함께 정리했습니다</h2>
          </div>
          <ul className="home-data-list">
            {HOME_DATA_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </div>

      <nav className="home-footer-links" aria-label="사이트 안내">
        <div>
          {INFO_PAGE_LINKS.slice(0, 3).map((link, index) => (
            <span className="home-footer-item" key={link.path}>
              {index > 0 && <span aria-hidden="true">·</span>}
              <a href={link.path} onClick={(event) => onNavigateInfo(link.path, event)}>
                {link.label}
              </a>
            </span>
          ))}
        </div>
        <div>
          {INFO_PAGE_LINKS.slice(3).map((link, index) => (
            <span className="home-footer-item" key={link.path}>
              {index > 0 && <span aria-hidden="true">·</span>}
              <a href={link.path} onClick={(event) => onNavigateInfo(link.path, event)}>
                {link.label}
              </a>
            </span>
          ))}
        </div>
      </nav>
    </section>
  );
}

function CountdownView({ count }) {
  return (
    <section className="countdown-view" aria-label="게임 시작 카운트다운">
      <div className="countdown-card" role="status" aria-live="assertive">
        <span>잠시 후 시작</span>
        <strong key={count}>{count}</strong>
      </div>
    </section>
  );
}

function LeaderboardPreviewView({ difficulty, leaderboard, onHome, onStart }) {
  const selectedDifficulty = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;

  return (
    <section className="leaderboard-preview-view">
      <div className="leaderboard-preview-panel">
        <div className="leaderboard-preview-copy">
          <span className="kicker">
            <FaMedal /> 오늘의 기록
          </span>
          <h1>{selectedDifficulty.label} 리더보드</h1>
          <p>
            오늘 같은 난이도로 플레이한 상위 5개 기록입니다. 준비되면 바로 시작해보세요.
          </p>
        </div>

        <DailyLeaderboard
          difficulty={difficulty}
          leaderboard={leaderboard}
          limit={5}
          variant="preview"
        />

        <footer className="leaderboard-preview-actions">
          <button className="secondary-action" onClick={onHome} type="button">
            <FaHome /> 난이도 선택
          </button>
          <button className="primary-action" onClick={onStart} type="button">
            <FaPlay /> 게임 시작
          </button>
        </footer>
      </div>
    </section>
  );
}

function GameView({
  currentQuestion,
  difficulty,
  lastResult,
  onAnswer,
  onFinish,
  onHome,
  questionLeft,
  questionProgress,
  resultLabel,
  selectedAnswer,
}) {
  const isFeedback = Boolean(lastResult);
  const showEasyHints = difficulty === "easy";
  const hasPromptReadings = showEasyHints && currentQuestion.type === "A";
  const gameViewClassName = [
    "game-view",
    lastResult ? `is-${lastResult}` : "",
    hasPromptReadings ? "has-prompt-readings" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const timerTone =
    questionLeft <= 4 ? "danger" : questionLeft <= 7 ? "warning" : "normal";

  return (
    <section className={gameViewClassName}>
      <div className="question-frame">
        <span className="question-type">
          {currentQuestion.type === "A" ? "빈칸 한자" : "뜻 보고 맞히기"}
        </span>
        {currentQuestion.type === "A" ? (
          <div className="hanja-prompt" aria-label={`문제 ${currentQuestion.prompt}`}>
            {[...currentQuestion.prompt].map((char, index) => {
              const isBlank = char === "?";
              const reading = currentQuestion.promptReadings?.[index] ?? "";

              return (
                <span
                  className={`prompt-char ${isBlank ? "blank-char" : ""}`}
                  key={`${char}-${index}`}
                >
                  <span>{char}</span>
                  {hasPromptReadings && (
                    <small
                      aria-hidden={isBlank ? true : undefined}
                      className={isBlank ? "prompt-reading-spacer" : undefined}
                    >
                      {isBlank ? "\u00a0" : reading || "\u00a0"}
                    </small>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="meaning-prompt">{currentQuestion.prompt}</p>
        )}
      </div>

      <div className={`timer-row is-${timerTone}`}>
        <FaStopwatch aria-hidden="true" />
        <div className="timer-track" aria-label="문제 타이머">
          <span style={{ width: `${questionProgress * 100}%` }} />
        </div>
        <strong>{displaySeconds(questionLeft)}초</strong>
      </div>

      <div className={`choice-grid ${showEasyHints ? "has-easy-hints" : ""}`}>
        {currentQuestion.choices.map((choice, index) => {
          const choiceReading = currentQuestion.choiceReadings?.[choice];
          const isAnswer = choice === currentQuestion.answer;
          const isSelected = choice === selectedAnswer;
          const stateClass = isFeedback
            ? isAnswer
              ? "is-correct"
              : isSelected
                ? "is-wrong"
                : "is-muted"
            : "";

          return (
            <button
              aria-label={`${index + 1}번 선택지 ${choice}${showEasyHints && choiceReading ? ` ${choiceReading}` : ""}`}
              className={`choice-button ${stateClass}`}
              disabled={isFeedback}
              key={`${choice}-${index}`}
              onClick={() => onAnswer(choice)}
              type="button"
            >
              <span className="choice-main">{choice}</span>
              {showEasyHints && choiceReading && (
                <small className="choice-reading">{choiceReading}</small>
              )}
              {isFeedback && isAnswer && <FaCheck className="choice-icon" aria-hidden="true" />}
              {isFeedback && isSelected && !isAnswer && (
                <FaTimes className="choice-icon" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {isFeedback && (
        <div className="feedback-chip" role="status">
          {resultLabel}
          {lastResult !== "correct" && <small>정답 {currentQuestion.answer}</small>}
        </div>
      )}

      <footer className="game-actions">
        <button className="secondary-action" onClick={onHome} type="button">
          <FaHome /> 홈으로
        </button>
        <button className="result-action" onClick={onFinish} type="button">
          <FaChartBar /> 결과 보기
        </button>
      </footer>
    </section>
  );
}

function ResultView({
  accuracy,
  dailyLeaderboard,
  difficulty,
  exportState,
  history,
  onExportImage,
  onExportText,
  onHome,
  onRestart,
  playerProfile,
  score,
  stats,
}) {
  const grade = getGrade(accuracy);

  return (
    <section className="result-view">
      <div className="result-summary">
        <span className="kicker">
          <FaTrophy /> 게임 결과
        </span>
        <h1>{grade}</h1>
        <div className="score-line">
          <strong>{score}</strong>
          <span>개 정답</span>
        </div>
        <p>
          정확도 {accuracy}% · 시도 {history.length}문제 · 난이도{" "}
          {DIFFICULTIES[difficulty].label}
        </p>
        <div className="best-strip">
          최고 기록 {stats.bestScore}개 · 최고 정확도 {stats.bestAccuracy}% · 총{" "}
          {stats.playCount}회 플레이 · 닉네임 {playerProfile.nickname}
        </div>
        <DailyLeaderboard
          difficulty={difficulty}
          leaderboard={dailyLeaderboard}
          limit={5}
          variant="result"
        />
      </div>

      <div className="history-panel">
        <div className="history-title">
          <strong>문제 복기</strong>
          <span>{history.length}문제</span>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <p className="empty-history">아직 기록된 문제가 없어요. 바로 다시 도전해보세요.</p>
          ) : (
            history.map((record, index) => (
              <article className="history-item" key={`${record.idiomId}-${index}`}>
                <span className={`result-mark ${record.correct ? "is-right" : "is-miss"}`}>
                  {record.correct ? <FaCheck /> : <FaTimes />}
                </span>
                <div>
                  <strong>{record.source.idiom}</strong>
                  <small>
                    {record.source.reading} · {record.source.meaning}
                  </small>
                  {!record.correct && (
                    <em>
                      내 답: {record.userAnswer ?? "시간 초과"} · 정답: {record.answer}
                    </em>
                  )}
                </div>
                <time>{record.timeSpent.toFixed(1)}초</time>
              </article>
            ))
          )}
        </div>
      </div>

      <footer className="result-actions">
        <button className="secondary-action" onClick={onHome} type="button">
          <FaHome /> 홈으로
        </button>
        <button
          className="secondary-action"
          disabled={history.length === 0}
          onClick={onExportText}
          type="button"
        >
          <FaFileAlt /> {exportState === "text" ? "텍스트 저장됨" : "텍스트 저장"}
        </button>
        <button
          className="secondary-action"
          disabled={history.length === 0}
          onClick={onExportImage}
          type="button"
        >
          <FaImage /> {exportState === "image" ? "이미지 저장됨" : "이미지 저장"}
        </button>
        <button className="primary-action" onClick={onRestart} type="button">
          <FaRedoAlt /> 다시 하기
        </button>
      </footer>
    </section>
  );
}

function DailyLeaderboard({ difficulty, leaderboard, limit = 5, variant = "compact" }) {
  const difficultyKey = DIFFICULTIES[difficulty] ? difficulty : "normal";
  const entries = getLeaderboardEntries(leaderboard, difficultyKey).slice(0, limit);

  return (
    <section className={`daily-leaderboard is-${variant}`} aria-label="오늘의 리더보드">
      <div className="leaderboard-head">
        <strong>
          <FaMedal /> 오늘의 리더보드 · {DIFFICULTIES[difficultyKey].label}
        </strong>
        <span>
          <FaCalendarDay /> {leaderboard.date || getTodayKey()}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="leaderboard-empty">오늘 첫 기록을 세워보세요.</p>
      ) : (
        <ol className="leaderboard-list">
          {entries.map((entry, index) => (
            <li className="leaderboard-row" key={entry.id}>
              <span className="leaderboard-rank">{index + 1}</span>
              <div>
                <strong>{entry.nickname || "익명"} · {entry.score}개 정답</strong>
                <small>
                  정확도 {entry.accuracy}% · {DIFFICULTIES[entry.difficulty].label} ·{" "}
                  {formatPlayedAt(entry.playedAt)}
                </small>
              </div>
              <em>{entry.attempted}문제</em>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default App;
