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
  FaPlay,
  FaRedoAlt,
  FaStopwatch,
  FaTimes,
  FaTrophy,
} from "react-icons/fa";
import idioms from "./data/idioms.json";

const TOTAL_SECONDS = 60;
const FEEDBACK_DELAY = 850;
const STORAGE_KEYS = {
  bestScore: "sjse_best_score",
  bestAccuracy: "sjse_best_accuracy",
  playCount: "sjse_play_count",
  dailyLeaderboard: "sjse_daily_leaderboard",
};
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim();

const DIFFICULTIES = {
  easy: { label: "쉬움", seconds: 15 },
  normal: { label: "보통", seconds: 10 },
  hard: { label: "어려움", seconds: 7 },
};
const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

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

  return {
    type: "A",
    idiomId: item.id,
    answer,
    blankIndex,
    prompt: chars.map((char, index) => (index === blankIndex ? "?" : char)).join(""),
    choices: shuffle([answer, ...distractors]),
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

  return {
    type: "B",
    idiomId: item.id,
    answer: item.idiom,
    prompt: item.meaning,
    choices: shuffle([item.idiom, ...distractors]),
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    .slice(0, 10);
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

function formatPlayedAt(isoDate) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoDate));
}

function buildLeaderboardEntry({ accuracy, difficulty, score, attempted, history }) {
  const now = new Date();
  const totalTimeSpent = history.reduce((sum, record) => sum + record.timeSpent, 0);
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    score,
    accuracy,
    attempted,
    difficulty,
    playedAt: now.toISOString(),
    totalTimeSpent: Number(totalTimeSpent.toFixed(1)),
  };
}

function updateDailyLeaderboard(current, entry) {
  const today = getTodayKey();
  const normalized =
    current.date === today ? normalizeDailyLeaderboard(current, today) : createDailyLeaderboard(today);
  const difficulty = DIFFICULTIES[entry.difficulty] ? entry.difficulty : "normal";
  const entries = normalized.entriesByDifficulty[difficulty] || [];

  return {
    date: today,
    entriesByDifficulty: {
      ...normalized.entriesByDifficulty,
      [difficulty]: sortLeaderboardEntries([...entries, { ...entry, difficulty }]),
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

  const questionDuration = DIFFICULTIES[state.difficulty].seconds;
  const totalLeft = secondsLeft(state.totalStartedAt, TOTAL_SECONDS, now);
  const questionLeft = secondsLeft(state.questionStartedAt, questionDuration, now);
  const questionProgress = Math.max(0, Math.min(1, questionLeft / questionDuration));
  const accuracy = getAccuracy(state.score, state.attempted);

  useEffect(() => {
    if (state.phase !== "playing" && state.phase !== "feedback") return undefined;

    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [state.phase]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDailyLeaderboard((current) => {
        const today = getTodayKey();
        if (current.date === today) return current;

        const resetLeaderboard = createDailyLeaderboard(today);
        saveDailyLeaderboard(resetLeaderboard);
        return resetLeaderboard;
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
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
  }, [now, questionLeft, state.feedbackUntil, state.phase, totalLeft]);

  useEffect(() => {
    if (state.phase !== "result" || state.resultSaved) return;

    const nextStats = {
      bestScore: Math.max(stats.bestScore, state.score),
      bestAccuracy: Math.max(stats.bestAccuracy, accuracy),
      playCount: stats.playCount + 1,
    };
    const nextLeaderboard =
      state.attempted > 0
        ? updateDailyLeaderboard(
            dailyLeaderboard,
            buildLeaderboardEntry({
              accuracy,
              difficulty: state.difficulty,
              score: state.score,
              attempted: state.attempted,
              history: state.history,
            }),
          )
        : dailyLeaderboard;
    saveStats(nextStats);
    if (state.attempted > 0) {
      saveDailyLeaderboard(nextLeaderboard);
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

  function startGame() {
    setNow(Date.now());
    dispatch({ type: "START", difficulty: state.difficulty, now: Date.now() });
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

  return (
    <main className="app-shell">
      <AdSenseAuto />
      <div className="arcade-stage">
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

        {state.phase === "home" && (
          <HomeView
            difficulty={state.difficulty}
            onDifficultyChange={(difficulty) =>
              dispatch({ type: "SET_DIFFICULTY", difficulty })
            }
            onStart={startGame}
            dailyLeaderboard={dailyLeaderboard}
            stats={stats}
          />
        )}

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
            score={state.score}
            stats={stats}
          />
        )}

        <p className="sr-only" aria-live="polite">
          전체 남은 시간 {displaySeconds(totalLeft)}초, 문제 남은 시간{" "}
          {displaySeconds(questionLeft)}초, 현재 점수 {state.score}점
        </p>
      </div>
    </main>
  );
}

function AdSenseAuto() {
  useEffect(() => {
    if (!ADSENSE_CLIENT || ADSENSE_CLIENT === "ca-pub-0000000000000000") {
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
    };
  }, []);

  return null;
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

  return (
    <header className="hud">
      <div className="logo-lockup" aria-label="사자성어 퀴즈">
        <span>사자성어</span>
        <strong>퀴즈</strong>
      </div>

      <div className="hud-metrics" aria-label="게임 정보">
        <Metric icon={<FaClock />} label="전체 시간" value={formatClock(totalLeft)} danger={totalLeft < 10} />
        <Metric icon={<FaTrophy />} label="점수" value={score} />
        <Metric icon={<FaBolt />} label="문제" value={`Q.${Math.max(1, questionNumber || 1)}`} />
      </div>

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

function HomeView({ dailyLeaderboard, difficulty, onDifficultyChange, onStart, stats }) {
  return (
    <section className="home-view">
      <div className="home-copy">
        <span className="kicker">
          <FaStopwatch /> 60초 한자 스프린트
        </span>
        <h1>뜻도 한자도 빠르게 맞혀요</h1>
        <p>
          같은 사자성어는 한 판에 한 번만 등장합니다. 빈칸 한자와 뜻풀이 문제를
          번갈아 풀며 최고 기록을 갱신해보세요.
        </p>
      </div>

      <div className="start-panel">
        <div className="mini-scoreboard">
          <span>최고 기록</span>
          <strong>{stats.bestScore}개</strong>
          <small>최고 정확도 {stats.bestAccuracy}% · 플레이 {stats.playCount}회</small>
        </div>

        <DailyLeaderboard
          difficulty={difficulty}
          leaderboard={dailyLeaderboard}
          limit={3}
          variant="compact"
        />

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
    </section>
  );
}

function GameView({
  currentQuestion,
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
  const timerTone =
    questionLeft <= 4 ? "danger" : questionLeft <= 7 ? "warning" : "normal";

  return (
    <section className={`game-view ${lastResult ? `is-${lastResult}` : ""}`}>
      <div className="question-frame">
        <span className="question-type">
          {currentQuestion.type === "A" ? "빈칸 한자" : "뜻 보고 맞히기"}
        </span>
        {currentQuestion.type === "A" ? (
          <div className="hanja-prompt" aria-label={`문제 ${currentQuestion.prompt}`}>
            {[...currentQuestion.prompt].map((char, index) => (
              <span className={char === "?" ? "blank-char" : ""} key={`${char}-${index}`}>
                {char}
              </span>
            ))}
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

      <div className="choice-grid">
        {currentQuestion.choices.map((choice, index) => {
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
              aria-label={`${index + 1}번 선택지 ${choice}`}
              className={`choice-button ${stateClass}`}
              disabled={isFeedback}
              key={`${choice}-${index}`}
              onClick={() => onAnswer(choice)}
              type="button"
            >
              <span>{choice}</span>
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
          {stats.playCount}회 플레이
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
                <strong>{entry.score}개 정답</strong>
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
