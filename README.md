# Plock — 플래너 · 다이어리 · 가계부

PC와 휴대폰에서 함께 쓰는 개인 기록 웹앱(PWA)입니다.

- **플래너**: 월/주 캘린더, 할 일(세부 항목·우선순위), 습관(연속 기록·히트맵), 카테고리, `.ics` 가져오기/내보내기
- **다이어리**: 종이 한 장처럼 꾸미는 일기. 사진 넣기, 이모지·내 스티커를 자유롭게 붙이고 끌어서 이동 / 크기·회전 조절,
  갤러리 사진으로 스티커 만들기(배경 지우기·원형·둥근 네모), 종이·글씨체·기분·날씨
- **가계부**: 월별 수입/지출, 예산, 달력, 카테고리 통계, 영수증 첨부, CSV 내보내기
- **오늘**: 오늘 일정·할 일·습관·일기·지출을 한 화면에
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

로컬 Firebase 에뮬레이터로 로그인/동기화를 시험하려면:

```bash
npx firebase emulators:start --only auth,firestore
VITE_FIREBASE_EMULATOR=1 npm run dev
```

## 배포 (Firebase Hosting)

### 1. 한 번만 해 두는 Firebase 콘솔 설정

1. **Authentication > 로그인 방법**에서 **이메일/비밀번호**와 **Google**을 사용 설정
2. **Authentication > 설정 > 승인된 도메인**에 배포 도메인이 있는지 확인
   (`pivotal-reducer-2thv3.web.app`, `pivotal-reducer-2thv3.firebaseapp.com`은 기본 포함. 커스텀 도메인을 쓰면 추가)

### 2. 배포

```bash
npm install -g firebase-tools   # 처음 한 번
firebase login
npm run deploy                  # 빌드 + Hosting + Firestore 보안 규칙 배포
```

`firebase.json`이 Hosting(`dist/`)과 Firestore 규칙(`firestore.rules`, 데이터베이스
`ai-studio-remixplannerdiar-…`)을 함께 배포합니다.

### 3. 이전 버전에서 넘어올 때 (중요)

이전 버전은 Firestore 규칙이 `allow read, write: if true` 였고 `users` 컬렉션에 **비밀번호가 평문으로** 저장되어 있었습니다.
누구나 모든 사용자의 비밀번호·일기·가계부를 읽을 수 있는 상태였습니다.

1. 새 버전을 배포하면 새 규칙이 적용되어 예전 컬렉션(`users`, `userData`, `systemBackups`)은 아무도 읽을 수 없게 됩니다.
2. 예전 데이터는 대부분 각자의 브라우저(localStorage)에도 남아 있으므로, 새 버전 접속 후 **설정 > 데이터 > 이전 버전 기록 가져오기**로 옮길 수 있습니다.
3. 옮긴 뒤에는 Firebase 콘솔 > Firestore에서 `users`, `userData`, `systemBackups` 컬렉션을 **삭제**하세요. (평문 비밀번호가 남아 있습니다.)
4. 예전 계정의 비밀번호를 다른 사이트에서도 쓰고 있었다면 그곳 비밀번호를 바꾸도록 사용자에게 알려 주세요.

## 무료 한도 참고 (Firebase Spark 요금제)

Firestore 무료 한도는 저장 1GiB, 하루 읽기 5만 / 쓰기 2만 건입니다. 사진은 장당 약 150–600KB로 압축되므로
소규모(수십 명) 사용에는 충분하지만, 사진을 아주 많이 올리는 사용자가 늘면 Blaze 요금제나 Cloud Storage 전환을 고려하세요.

## 구조

```
src/
  app/        라우팅(해시), 레이아웃(데스크톱 사이드바 / 모바일 하단 탭)
  data/       저장소 추상화: localRepo(IndexedDB) · cloudRepo(Firestore) · DataProvider · 백업/이전 데이터 변환
  features/   today · planner · diary · ledger · settings · auth
  lib/        날짜, 이미지 압축·스티커 가공, 한국어 자연어 분석기, Gemini(REST), .ics, 알림
```
