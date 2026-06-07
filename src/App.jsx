import { useEffect, useMemo, useReducer, useState } from "react";
import {
  FaBolt,
  FaChartBar,
  FaCheck,
  FaClock,
  FaHome,
  FaPlay,
  FaRedoAlt,
  FaShareAlt,
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
};

const DIFFICULTIES = {
  easy: { label: "쉬움", seconds: 15 },
  normal: { label: "보통", seconds: 10 },
  hard: { label: "어려움", seconds: 7 },
};

const INITIAL_STATS = {
  bestScore: 0,
  bestAccuracy: 0,
  playCount: 0,
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
  const [copyState, setCopyState] = useState("idle");

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
    saveStats(nextStats);
    setStats(nextStats);
    dispatch({ type: "MARK_SAVED" });
  }, [accuracy, state.phase, state.resultSaved, state.score, stats]);

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

  async function copyResult() {
    const text = `사자성어 퀴즈 결과: 정답 ${state.score}개, 정확도 ${accuracy}%, ${getGrade(
      accuracy,
    )}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  }

  return (
    <main className="app-shell">
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
            copyState={copyState}
            difficulty={state.difficulty}
            history={state.history}
            onCopy={copyResult}
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

function HomeView({ difficulty, onDifficultyChange, onStart, stats }) {
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
  copyState,
  difficulty,
  history,
  onCopy,
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
        <button className="secondary-action" onClick={onCopy} type="button">
          <FaShareAlt /> {copyState === "copied" ? "복사 완료" : "공유하기"}
        </button>
        <button className="primary-action" onClick={onRestart} type="button">
          <FaRedoAlt /> 다시 하기
        </button>
      </footer>
    </section>
  );
}

export default App;
