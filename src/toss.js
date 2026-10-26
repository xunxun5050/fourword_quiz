// 앱인토스(Apps in Toss) SDK 연동 헬퍼.
//
// 같은 코드가 웹(Vercel)과 토스 미니앱에서 함께 쓰이므로, 토스 밖에서는 모든 함수가
// 조용히 no-op(또는 null)이 되도록 만든다. SDK는 토스 환경에서만 동적으로 불러와서
// 웹 사용자는 SDK 청크를 내려받지 않는다.

const BEST_SCORE_KEY = "sjse_toss_submitted_best";

function hasNativeBridge() {
  return typeof window !== "undefined" && Boolean(window.ReactNativeWebView);
}

function isDevPreview() {
  if (!import.meta.env.DEV) return false;
  // 개발 서버에서는 devtools 플러그인이 SDK를 mock으로 바꿔준다.
  // ?web=1 을 붙이면 토스 밖(웹) 동작을 그대로 확인할 수 있다.
  return !new URLSearchParams(window.location.search).has("web");
}

export function isTossEnvironment() {
  return hasNativeBridge() || isDevPreview();
}

let sdkPromise = null;

function loadSdk() {
  if (!isTossEnvironment()) return Promise.resolve(null);
  if (!sdkPromise) {
    sdkPromise = import("@apps-in-toss/web-framework").catch(() => null);
  }
  return sdkPromise;
}

// 사용자 고유 키(hash). 앱 버전이 낮거나 오류면 null.
export async function getTossUserKey() {
  const sdk = await loadSdk();
  if (!sdk) return null;
  try {
    const result = await sdk.User.getAnonymousKey();
    return result?.type === "HASH" ? result.hash : null;
  } catch {
    return null;
  }
}

// 햅틱. 처리했으면 true, 토스 밖이라 호출자가 폴백해야 하면 false.
export function triggerTossHaptic(type) {
  if (!isTossEnvironment()) return false;
  loadSdk()
    .then((sdk) => sdk?.Device.triggerHaptic({ type }))
    .catch(() => {});
  return true;
}

// 토스 게임센터 프로필의 닉네임. 프로필이 없거나 앱 버전이 낮으면 null.
export async function getTossNickname() {
  const sdk = await loadSdk();
  if (!sdk) return null;
  try {
    const profile = await sdk.Game.getUserProfile();
    return profile?.statusCode === "SUCCESS" && profile.nickname ? profile.nickname : null;
  } catch {
    return null;
  }
}

// 리더보드가 최고점 유지인지 마지막 점수 덮어쓰기인지 문서에 없으므로,
// 이 기기에서 제출한 최고점을 넘을 때만 제출한다(어느 쪽이어도 순위가 깎이지 않는다).
export async function submitTossScore(score) {
  const sdk = await loadSdk();
  if (!sdk) return null;

  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
  } catch {
    best = 0;
  }
  if (!(score > best)) return null;

  try {
    const result = await sdk.Game.setLeaderboardScore({ score: String(score) });
    // LEADERBOARD_NOT_FOUND(콘솔 설정/승인 전) 등은 저장하지 않아서 다음 판에 다시 시도한다.
    if (result?.statusCode === "SUCCESS") {
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(score));
      } catch {
        // 저장 실패는 무시한다.
      }
    }
    return result?.statusCode ?? null;
  } catch {
    return null;
  }
}

export async function closeTossView() {
  const sdk = await loadSdk();
  if (!sdk) return;
  try {
    await sdk.Screen.close();
  } catch {
    // 닫기 실패는 무시한다.
  }
}

// 토스 상단 뒤로가기 구독. 리스너를 등록하면 기본 뒤로가기 동작이 차단되므로,
// 앱을 나가야 할 때는 핸들러가 직접 closeTossView()를 호출해야 한다.
export function subscribeTossBack(handler) {
  if (!isTossEnvironment()) return () => {};

  let cancelled = false;
  let unsubscribe = null;

  loadSdk().then((sdk) => {
    if (!sdk || cancelled) return;
    try {
      unsubscribe = sdk.graniteEvent.addEventListener("backEvent", {
        onEvent: handler,
        onError: () => {},
      });
    } catch {
      unsubscribe = null;
    }
  });

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
}

// 토스 앱의 상태바/하단 바에 가려지지 않도록 SDK의 safe area 값을 CSS 변수로 내려준다.
// 토스 밖에서는 아무것도 하지 않아서 CSS의 env(safe-area-inset-*) 기본값이 그대로 쓰인다.
export function syncTossSafeArea() {
  if (!isTossEnvironment()) return () => {};

  let cancelled = false;
  let unsubscribe = null;

  const apply = (insets) => {
    if (!insets) return;
    const style = document.documentElement.style;
    style.setProperty("--safe-top", `${insets.top ?? 0}px`);
    style.setProperty("--safe-right", `${insets.right ?? 0}px`);
    style.setProperty("--safe-bottom", `${insets.bottom ?? 0}px`);
    style.setProperty("--safe-left", `${insets.left ?? 0}px`);
  };

  loadSdk().then((sdk) => {
    if (!sdk || cancelled) return;
    try {
      apply(sdk.SafeArea.get());
      unsubscribe = sdk.SafeArea.subscribe({ onEvent: apply });
    } catch {
      unsubscribe = null;
    }
  });

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
}
