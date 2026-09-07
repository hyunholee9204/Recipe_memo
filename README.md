# 레시피 노트 🍳

> 직접 만든 요리를 기록하는, 나만의 부엌 노트

자취를 하다 보면 "그때 그거 어떻게 만들었더라?" 하는 순간이 자주 온다.
**레시피 노트**는 서버도 로그인도 없이, 내 브라우저 안에만 저장되는 개인용 요리 기록장이다.
메모장처럼 부담 없이 적고, 다음에 요리할 때 체크리스트처럼 펼쳐 본다.

<p align="center">
  <img src="docs/screenshot-home.png" width="49%" alt="레시피 목록 화면" />
  <img src="docs/screenshot-detail.png" width="49%" alt="레시피 상세 화면" />
</p>

## ✨ 주요 기능

| 기능 | 설명 |
| --- | --- |
| **레시피 기록** | 제목 · 사진 · 카테고리 · 조리시간 · 난이도 · 태그 · 재료 · 만드는 법 · 메모 |
| **별점 (0.5 단위)** | 별을 누를 때마다 반 칸씩 채워짐. 목록만 훑어도 "만족했던 레시피"가 한눈에 |
| **재료 체크리스트** | 상세 화면에서 재료를 하나씩 체크하며 요리 (새로고침하면 초기화) |
| **검색 & 필터** | 제목 · 재료 · 태그 통합 검색, 카테고리별 · 즐겨찾기 필터 |
| **즐겨찾기** | 자주 만드는 레시피를 별표로 고정 |
| **사진 첨부** | 업로드 시 자동으로 1000px로 리사이즈 + JPEG 압축해 저장 공간 절약 |
| **JSON 백업 / 복원** | `⋯` 메뉴에서 전체 데이터를 내보내고 다시 불러오기 |
| **다크 모드** | OS 설정 자동 반영 |
| **반응형** | 주방에서 폰으로 보기 좋은 레이아웃 |

## 🛠 기술 스택

- **순수 HTML + CSS + JavaScript** — 프레임워크·빌드 도구 없음
- **localStorage** — 모든 데이터는 브라우저에 저장, 서버 불필요
- **Google Fonts** — 명조 계열(Gowun Batang / Nanum Myeongjo)로 손글씨 레시피 카드 느낌
- 개발 편의를 위한 `live-server` (자동 새로고침)

정적 파일 3개(`index.html`, `styles.css`, `app.js`)가 전부라 어디든 그대로 올라간다.

## 🚀 실행

```bash
# 그냥 파일을 열어도 동작한다
open index.html

# 또는 로컬 개발 서버 (파일 저장 시 자동 새로고침)
npm run dev        # http://127.0.0.1:8765

# 자동 새로고침이 필요 없다면
npm run start
```

> `npm install` 은 필요 없다. 스크립트가 `npx` 로 서버를 즉석 실행한다.

## 📦 배포

정적 사이트라 아래 어디든 폴더를 그대로 올리면 끝이다.

- **GitHub Pages** — Settings → Pages → 브랜치 선택
- **Netlify / Vercel / Cloudflare Pages** — 폴더 드래그 앤 드롭

## 🗂 프로젝트 구조

```
.
├── index.html      # 마크업 + 상세/편집용 <template>
├── styles.css      # 디자인 시스템, 다크 모드, 반응형
├── app.js          # 상태 관리 · 저장 · 렌더링 · 백업 (의존성 없음)
├── package.json    # dev/start 스크립트
└── docs/           # README용 스크린샷
```

### 데이터 모델

```js
{
  id: string,
  title: string,
  category: string,      // 한식 / 양식 / 일식 / 중식 / 분식 / ...
  time: number | null,   // 조리시간(분)
  difficulty: string,    // 쉬움 / 보통 / 어려움
  tags: string[],
  ingredients: string[], // 한 줄에 하나
  steps: string[],       // 한 줄에 한 단계
  memo: string,
  rating: number,        // 0 ~ 5 (0.5 단위)
  image: string | null,  // data URL (JPEG)
  favorite: boolean,
  createdAt: number,
  updatedAt: number
}
```

localStorage 키: `recipe-note:v1`

## ⚠️ 데이터 보관 안내

레시피는 **접속한 브라우저에만** 저장된다.
캐시를 지우거나 기기를 바꾸면 사라지므로, `⋯` 메뉴의 **JSON 백업**을 가끔 받아 두는 것을 권장한다.

## 🧭 로드맵 (v2 아이디어)

- 냉장고에 있는 재료로 만들 수 있는 레시피 검색
- 여러 레시피를 골라 장보기 리스트 자동 생성
- 인분 수 조절 시 재료량 자동 계산
- 재료를 `이름 / 양` 구조로 분리해 저장

## 📄 라이선스

MIT — 개인 학습·활용 목적의 사이드 프로젝트입니다.
