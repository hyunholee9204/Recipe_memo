/* =========================================================
   레시피 노트 — 정적 콘텐츠 페이지 공용 스크립트
   광고 슬롯 처리만 담당한다. (index.html 앱은 app.js가 처리)
   ========================================================= */
(() => {
  "use strict";

  /* AdSense 수동 배치 슬롯:
     data-ad-slot 이 실제 광고 단위 ID(6자리 이상 숫자)로 채워지면 그 자리를 보이게 하고
     adsbygoogle 를 push 한다. placeholder("0000000000") 상태에서는 빈 광고 띠가 생기지
     않도록 숨긴 채로 둔다. AdSense "자동 광고"는 헤드의 로더만으로 이미 동작한다. */
  function initAds() {
    document.querySelectorAll("ins.adsbygoogle").forEach((ins) => {
      const slot = ins.getAttribute("data-ad-slot") || "";
      const box = ins.closest(".ad-slot");
      if (/^\d{6,}$/.test(slot) && slot !== "0000000000") {
        if (box) box.hidden = false;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (_) {
          /* 광고 차단기 등 — 무시 */
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAds);
  } else {
    initAds();
  }
})();
