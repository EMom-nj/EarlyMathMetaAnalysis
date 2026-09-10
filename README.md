# 📐 유아 수학 교구 & 학습지 인터랙티브 대시보드

> **아이의 연령(±1세)을 기반으로 맞춤 교구와 학습지를 추천하고, 브랜드별 차별화·1:1 비교·학술 실증 연구를 제공하는 GitHub Pages 대시보드 웹 애플리케이션입니다.**

---

## 🌟 주요 기능 (Key Features)

1. **아기 나이 입력 & ±1세 정밀 자동 매칭 (Onboarding Hero)**
   - 만 2세 ~ 9세(초2) 중 내 아이 나이를 선택하면, **±1세 발달 범위에 최적화된 교구·학습지**만 우선 선별 노출.
   - 예: 만 5세 선택 시 → 4~6세 대상 28개 프로그램 자동 필터링.
2. **콘텐츠 유형 3-way 필터**
   - `전체 둘러보기` / `🧩 교구만 보기 (원목·구체물)` / `📚 학습지만 보기 (연산·사고력)`.
3. **상단 인터랙티브 퀵 바 (Sticky Navigation)**
   - 스크롤을 내려도 상단에서 언제든 나이, 유형, 검색어를 실시간 변경 가능.
4. **5대 핵심 탭**
   - 🎯 **내 아이 맞춤 추천**: 카드 덱 형태의 맞춤 추천 (핵심 특징, 난이도, 차별성)
   - 🧩 **교구 탐색기**: 몬스터매스(도형 특화), 플레이팩토, 오르다 등 브랜드별 고유 강점 및 풀세트 라인업
   - 📚 **학습지 로드맵**: 원리셈, 소마셈, 팩토 등의 권장 일일 학습 시간(매일 10분, 주 5일) 및 단계별 커리큘럼
   - ⚖️ **1:1 브랜드 정밀 비교기**: 소마 vs 시매쓰 vs 천종현 등 최대 4개 브랜드의 9대 핵심 지표 나란히 비교
   - 🔬 **학술 연구 검증실**:
     - *"학습지 주입식 vs 교구 놀이 중심"* 장기 추적 실증 연구 (Marcon 2002 6학년 추적 실패, Durkin 2022 반더빌트 RCT, Burts 1990 스트레스 행동 등)
     - 교구 효과 실증 연구(Carbonneau 메타분석 등) 및 프뢰벨 가베(은물) RCT 부재 팩트체크
5. **상세 프로필 모달 & 플로팅 1:1 비교함**
   - 브랜드별 R&D 연구진, 서울교대 교수 감수 내역, 공식 사이트 링크 바로가기 지원.

---

## 🚀 GitHub Pages 1분 배포 방법 (How to Deploy)

이 프로젝트는 순수 HTML5, Modern CSS, ES6+ Javascript로 작성되어 별도의 빌드 과정이나 백엔드 서버 없이 즉시 무료 호스팅됩니다.

### Step 1. GitHub 저장소(Repository) 생성
1. [GitHub.com](https://github.com)에 로그인 후 새 Repository를 만듭니다 (예: `math-edu-dashboard`).
2. Public(공개)으로 설정합니다.

### Step 2. 파일 업로드 (Push)
이 폴더(`수학 교구`)에 있는 모든 파일들을 업로드합니다:
- `index.html`
- `css/style.css`
- `js/data.js`
- `js/app.js`
- `README.md`

*(Git 명령어를 사용하시는 경우:)*
```bash
git init
git add .
git commit -m "feat: 유아 수학 교구 및 학습지 인터랙티브 대시보드 구축"
git branch -M main
git remote add origin https://github.com/<사용자_아이디>/math-edu-dashboard.git
git push -u origin main
```

### Step 3. GitHub Pages 활성화
1. 생성한 GitHub 저장소의 **Settings** 탭으로 이동합니다.
2. 좌측 메뉴에서 **Pages**를 클릭합니다.
3. **Build and deployment > Source** 항목에서 **Deploy from a branch**를 선택합니다.
4. **Branch**를 `main`, 폴더를 `/ (root)`로 선택하고 **Save**를 누릅니다.
5. 약 1분 후 `https://<사용자_아이디>.github.io/math-edu-dashboard/` 주소로 전 세계 누구나 접속할 수 있는 웹 대시보드가 무료로 열립니다! 🎉

---

## 💻 로컬에서 바로 확인하는 방법
- 인터넷 연결이나 서버 없이도, 본 폴더 내의 [`index.html`](file:///c:/Users/rlee2/Documents/육아정보/수학%20교구/index.html) 파일을 크롬(Chrome), 엣지(Edge), 사파리(Safari) 등 웹 브라우저에서 **더블 클릭**하시면 로컬에서 즉시 모든 기능을 테스트해 보실 수 있습니다.
