import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  // 콘솔에 등록하는 앱 이름과 반드시 동일해야 해요. 콘솔 등록 후에는 수정할 수 없어요.
  appName: "sajaseongeo-geupsujeon",
  brand: {
    primaryColor: "#f25a48",
  },
  // 이 앱은 클립보드/카메라/위치 등 네이티브 권한을 쓰지 않아요.
  permissions: [],
  webView: {
    // 게임 체크리스트: OS 뒤로가기 제스처 미지원
    allowsBackForwardNavigationGestures: false,
    // 게임 진행 중 당겨서 새로고침하면 진행 상황이 사라져요.
    pullToRefreshEnabled: false,
  },
  webBundleDir: "dist",
});
