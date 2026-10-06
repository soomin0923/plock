# Plock — 플래너 · 다이어리 · 가계부

PC와 휴대폰에서 함께 쓰는 개인 기록 웹앱(PWA)입니다.

- **플래너**: 월/주 캘린더(공휴일·대체공휴일 표시, 카테고리별 보기), 날짜를 누르고 바로 쓰고 엔터로 할 일 추가, 그날의 시간표,
  할 일(세부 항목·우선순위), 습관(연속 기록·히트맵), 카테고리, `.ics` 가져오기/내보내기
- **쏟아내기**: 한 줄 적고 엔터. 쓰다 만 내용도 자동 저장되고, ⭐ 보관함, 링크·카테고리·마감일, 긴 메모·사진을 붙일 수 있어요.
  “내일 3시 회의”, “점심 김밥 4500원”처럼 날짜·금액이 보이면 ‘바로 넣기’ 버튼으로 일정·할 일·가계부에 한 번에 넣어요.
- **LP 플레이어**: YouTube · YouTube Music 링크(곡/재생목록)를 올려 두면 탭을 옮겨도 계속 재생돼요. 목록은 계정에 저장돼요.
- **다이어리**: 종이 한 장처럼 꾸미는 일기. 사진 넣기, 이모지·내 스티커를 자유롭게 붙이고 끌어서 이동 / 크기·회전 조절,
  갤러리 사진으로 스티커 만들기(배경 지우기·원형·둥근 네모), 종이·글씨체·기분·날씨
- **가계부**: 월별 수입/지출, 예산, 달력, 카테고리 통계, 영수증 첨부, CSV 내보내기
- **오늘**: 위젯 대시보드. 일정·할 일·습관·일기·지출·쏟아내기·LP·가계부·미니 달력 위젯을 추가/삭제하고 끌어서 순서·크기를 바꿔요
- **편하게 저장**: 일기는 닫으면 자동 저장(작성 중 내용은 새로고침해도 복구), 메모 상세는 저장 버튼 없이 바로 저장
- **화면 설정**: 테마 프리셋(다크 포함), 배경·카드·글자·포인트 색 직접 고르기, 안 쓰는 탭 숨기기, 일정 알림(정각/n분 전) + 알림 소리
- **AI (선택)**: 각 사용자가 자기 Gemini API 키를 넣으면 “내일 3시 팀 회의”, “점심 김밥 4500원” 같은 문장 정리와 영수증 읽기를
  AI가 처리합니다. 키가 없어도 내장 한국어 분석기로 동작합니다.

## 데이터는 어디에 저장되나요?

| 상태 | 저장 위치 |
|---|---|
| 로그인 안 함(게스트) | 이 브라우저의 IndexedDB에만 저장 |
| 로그인 | Firestore `accounts/{uid}/…` + 브라우저 오프라인 캐시(IndexedDB). 오프라인에서도 쓰고, 연결되면 자동 동기화 |
| Gemini API 키 · 테마 · 알림 설정 | 그 기기의 localStorage에만 저장 (서버로 보내지 않음) |

- 사진은 올릴 때 자동으로 압축(최대 1600px)되어 한 장씩 별도 문서로 저장됩니다.
- 게스트로 쓰다가 로그인하면 “이 기기의 기록을 계정으로 옮길까요?”가 뜹니다.
- 이전 버전 Plock이 브라우저에 남긴 데이터는 **설정 > 데이터**에서 가져올 수 있습니다.
- 서버 코드가 없습니다. Firebase Hosting(정적 호스팅) + Firebase Auth + Firestore 만으로 동작합니다.

## 개발

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 타입 검사 + 프로덕션 빌드 (dist/)
```

로컬 Firebase 에뮬레이터로 로그인/동기화를 시험하려면 (실제 프로젝트 데이터는 건드리지 않음):

```bash
# 터미널 1 — Auth·Firestore 에뮬레이터 (Java 21 이상 필요: java -version 으로 확인)
npm run emulators
# 터미널 2 — 에뮬레이터에 연결된 개발 서버 (.env.emulator 사용)
npm run dev:emu
```

> `npx firebase …`는 쓰지 마세요. 이 프로젝트의 `firebase`는 웹 SDK 패키지라 실행 파일이 없어서
> `could not determine executable to run` 오류가 납니다. CLI 패키지 이름은 `firebase-tools`이고,
> 위 npm 스크립트가 `npx firebase-tools …`로 실행합니다. (Windows cmd/PowerShell, macOS, Linux 동일)

## 배포 (Firebase Hosting)

### 1. 한 번만 해 두는 Firebase 콘솔 설정

1. **Authentication > 로그인 방법**에서 **이메일/비밀번호**와 **Google**을 사용 설정
2. **Authentication > 설정 > 승인된 도메인**에 배포 도메인이 있는지 확인
   (`pivotal-reducer-2thv3.web.app`, `pivotal-reducer-2thv3.firebaseapp.com`은 기본 포함. 커스텀 도메인을 쓰면 추가)

### 2. 배포

```bash
npm run firebase:login   # 처음 한 번: 브라우저가 열리면 Firebase 프로젝트 소유 Google 계정으로 로그인
npm run deploy           # 빌드 + Hosting + Firestore 보안 규칙 배포
```

배포가 끝나면 `https://pivotal-reducer-2thv3.web.app` 에 새 버전이 올라갑니다. (전역 설치 없이 `npx firebase-tools`로 실행)

`firebase.json`이 Hosting(`dist/`)과 Firestore 규칙(`firestore.rules`, 데이터베이스
`ai-studio-remixplannerdiar-…`)을 함께 배포합니다.

### 3. 이전 버전에서 넘어올 때 (중요)

이전 버전은 Firestore 규칙이 `allow read, write: if true` 였고 `users` 컬렉션에 **비밀번호가 평문으로** 저장되어 있었습니다.
누구나 모든 사용자의 비밀번호·일기·가계부를 읽을 수 있는 상태였습니다.

1. 새 버전을 배포하면 새 규칙이 적용되어 예전 컬렉션(`users`, `userData`, `systemBackups`)은 아무도 읽을 수 없게 됩니다.
2. 예전 데이터는 대부분 각자의 브라우저(localStorage)에도 남아 있으므로, 새 버전 접속 후 **설정 > 데이터 > 이전 버전 기록 가져오기**로 옮길 수 있습니다.
3. 옮긴 뒤에는 Firebase 콘솔 > Firestore에서 `users`, `userData`, `systemBackups` 컬렉션을 **삭제**하세요. (평문 비밀번호가 남아 있습니다.)
4. 예전 계정의 비밀번호를 다른 사이트에서도 쓰고 있었다면 그곳 비밀번호를 바꾸도록 사용자에게 알려 주세요.

## 서버 비용

이 앱은 **유료 서버 없이** 동작하도록 만들어져 있습니다.

| 기능 | 어디서 실행되나 | 비용 |
|---|---|---|
| 화면·PWA | Firebase Hosting (정적 파일) | 무료 한도 내 |
| 로그인·계정 데이터 | Firebase Auth · Firestore | 무료 한도 내 |
| AI (Gemini) | 사용자 각자의 API 키로 Google에 직접 요청 | 운영자 비용 없음 |
| 사진 압축·스티커 가공 | 사용자의 브라우저 | 없음 |

- 프로젝트를 **Spark(무료) 요금제로 유지**하면 결제 수단이 연결되지 않으므로 요금이 청구될 수 없습니다.
  한도를 넘으면 과금되는 대신 그날 남은 시간 동안 해당 기능이 멈춥니다. Blaze(종량제)로 바꾸지 마세요.
- Firestore 무료 한도는 저장 1GiB, 하루 읽기 5만 / 쓰기 2만 건입니다. 앱을 새로 열면 계정의 기록 수만큼 읽기가 잡힙니다
  (닫은 지 30분이 안 된 기기는 바뀐 기록만 읽음). 1인당 기록 수백 건 기준으로 사용자 수십 명 규모까지는 충분합니다.
- 사진은 장당 약 150–600KB로 압축해 저장합니다. 사진을 아주 많이 올리는 사용자가 늘면 저장 1GiB 한도를 먼저 보게 됩니다.

## 구조

```
src/
  app/        라우팅(해시), 레이아웃(데스크톱 사이드바 / 모바일 하단 탭)
  data/       저장소 추상화: localRepo(IndexedDB) · cloudRepo(Firestore) · DataProvider · 백업/이전 데이터 변환
  features/   today · planner · diary · ledger · settings · auth
  lib/        날짜, 이미지 압축·스티커 가공, 한국어 자연어 분석기, Gemini(REST), .ics, 알림
```
