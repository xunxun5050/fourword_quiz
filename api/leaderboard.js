import { getCache } from "@vercel/functions";

const DIFFICULTIES = ["easy", "normal", "hard"];
const MAX_ENTRIES = 5;
const ONE_DAY_SECONDS = 24 * 60 * 60;
const cache = getCache({ namespace: "fourword-quiz-leaderboard" });

export const config = {
  regions: ["icn1"],
};

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

function secondsUntilTomorrowInSeoul() {
  const now = new Date();
  const today = getTodayKey(now);
  const tomorrowStart = new Date(`${today}T15:00:00.000Z`).getTime();
  const seconds = Math.ceil((tomorrowStart - now.getTime()) / 1000);

  return Math.max(3600, seconds + 3600);
}

function createEmptyEntries() {
  return Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, []]));
}

function createLeaderboard(date = getTodayKey()) {
  return {
    date,
    entriesByDifficulty: createEmptyEntries(),
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, number));
}

function sanitizeText(value, fallback, maxLength) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim();

  return (text || fallback).slice(0, maxLength);
}

function isBetterEntry(next, previous) {
  if (!previous) return true;
  if (next.score !== previous.score) return next.score > previous.score;
  if (next.accuracy !== previous.accuracy) return next.accuracy > previous.accuracy;
  if (next.totalTimeSpent !== previous.totalTimeSpent) {
    return next.totalTimeSpent < previous.totalTimeSpent;
  }

  return new Date(next.playedAt).getTime() > new Date(previous.playedAt).getTime();
}

function sortEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => Number(entry.attempted) > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.totalTimeSpent !== b.totalTimeSpent) return a.totalTimeSpent - b.totalTimeSpent;
      return new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
    })
    .slice(0, MAX_ENTRIES);
}

function normalizeLeaderboard(saved, today = getTodayKey()) {
  if (!saved || saved.date !== today || typeof saved !== "object") {
    return createLeaderboard(today);
  }

  const normalized = createLeaderboard(today);
  DIFFICULTIES.forEach((difficulty) => {
    normalized.entriesByDifficulty[difficulty] = sortEntries(
      saved.entriesByDifficulty?.[difficulty] || [],
    );
  });

  return normalized;
}

function createEntry(payload) {
  const difficulty = DIFFICULTIES.includes(payload.difficulty) ? payload.difficulty : "normal";
  const playerId = sanitizeText(payload.playerId, "guest", 64);
  const now = new Date();

  return {
    id: `${playerId}-${now.getTime()}`,
    playerId,
    nickname: sanitizeText(payload.nickname, "익명", 16),
    score: Math.round(clampNumber(payload.score, 0, 999)),
    accuracy: Math.round(clampNumber(payload.accuracy, 0, 100)),
    attempted: Math.round(clampNumber(payload.attempted, 1, 999)),
    difficulty,
    playedAt: now.toISOString(),
    totalTimeSpent: Number(clampNumber(payload.totalTimeSpent, 0, 3600).toFixed(1)),
  };
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function readLeaderboard() {
  const today = getTodayKey();
  const saved = await cache.get(`daily:${today}`);

  return normalizeLeaderboard(saved, today);
}

async function writeLeaderboard(leaderboard) {
  await cache.set(`daily:${leaderboard.date}`, leaderboard, {
    name: "daily leaderboard",
    tags: ["leaderboard", `leaderboard:${leaderboard.date}`],
    ttl: secondsUntilTomorrowInSeoul(),
  });
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    const leaderboard = await readLeaderboard();
    sendJson(response, 200, { leaderboard });
    return;
  }

  if (request.method === "POST") {
    try {
      const payload = await readRequestBody(request);
      const entry = createEntry(payload);
      const leaderboard = await readLeaderboard();
      const entries = leaderboard.entriesByDifficulty[entry.difficulty] || [];
      const previous = entries.find((item) => item.playerId === entry.playerId);
      const mergedEntries = entries.filter((item) => item.playerId !== entry.playerId);

      if (isBetterEntry(entry, previous)) {
        mergedEntries.push(entry);
      } else if (previous) {
        mergedEntries.push(previous);
      }

      const nextLeaderboard = {
        ...leaderboard,
        entriesByDifficulty: {
          ...leaderboard.entriesByDifficulty,
          [entry.difficulty]: sortEntries(mergedEntries),
        },
      };

      await writeLeaderboard(nextLeaderboard);
      sendJson(response, 200, { leaderboard: nextLeaderboard });
    } catch {
      sendJson(response, 400, { error: "invalid_leaderboard_entry" });
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  sendJson(response, 405, { error: "method_not_allowed" });
}
