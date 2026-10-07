# Plock 데이터 추출·분석

앱 화면에는 아무것도 보이지 않습니다. 데이터는 계정(Firestore) 또는 브라우저(IndexedDB)에만 쌓이고,
필요할 때 브라우저 개발자 콘솔에서 파일로 내려받습니다.

## 1. 무엇이 쌓이나 — `parseLogs`

자연어 입력을 할 때마다 한 행이 생깁니다. (오늘 화면·플래너 입력창, 쏟아내기의 '바로 넣기'·'할 일로/일정으로', 가계부 입력창)

| 컬럼 | 뜻 |
|---|---|
| `input` | 사용자가 입력한 문장 그대로 |
| `ref_date`, `ref_time`, `weekday`, `timezone` | 입력한 시점 (상대 날짜 "내일"의 기준) |
| `mode` | `ai`(Gemini) / `local`(내장 분석기) / `local_fallback`(AI 실패 → 내장 분석기) |
| `model`, `latency_ms`, `error` | 사용한 모델, 걸린 시간, AI 오류 메시지 |
| `pred_*` | 파서가 낸 값 (종류·제목·날짜·시각·카테고리…) |
| `final_*` | 사용자가 확인 창에서 고친 뒤 **실제로 저장한 값** = 정답 라벨 |
| `changed` | 사용자가 고친 필드 목록 (예: `date,startTime`) |
| `outcome` | `saved` / `cancelled` / `undone`(저장 후 되돌림) / `pending` |

- 입력 문장 원문이 남는 곳은 이 컬렉션뿐입니다. **이 기능을 넣기 전의 입력은 어디에도 남아 있지 않습니다.**
- 일기·사진·스티커는 기록하지도, 내보내지도 않습니다.
- 앱 시작 시 불러오지 않는 컬렉션이라 Firestore 읽기 비용이 늘지 않습니다. 설정 > 데이터의 '모든 기록 삭제'로 함께 지워집니다.

## 2. 내려받기

배포된 사이트(또는 `npm run dev`)를 로그인한 상태로 열고, `F12` → Console 탭에서:

```js
plock.help()            // 사용법
plock.parseLogCount()   // 쌓인 행 수
plock.exportSql()       // plock-YYYYMMDD.sql  — MySQL 덤프 (아래 7개 테이블)
plock.exportParseLogs() // plock-parse-logs-YYYYMMDD.csv + .jsonl
```

`exportSql()` 테이블: `categories`, `events`, `tasks`, `ledger_categories`, `ledger`, `notes`, `parse_logs`.
외래 키를 일부러 걸지 않았습니다. 고아 참조·중복을 SQL로 찾기 위해서입니다.

## 3. MySQL에 적재하고 분석

```bash
mysql -u root -p -e "CREATE DATABASE plock DEFAULT CHARSET utf8mb4"
mysql -u root -p --default-character-set=utf8mb4 plock < plock-20261007.sql
mysql -u root -p --default-character-set=utf8mb4 plock < analysis/queries.sql   # 또는 쿼리를 하나씩 실행
```

`queries.sql`:
- **A. 데이터 품질** — 중복 일정(`GROUP BY … HAVING COUNT(*) > 1`), 가져오기 배치, 고아 카테고리(`LEFT JOIN … IS NULL`), 시각 변환 의심
- **B. 파서 평가** — 경로·방식별 저장률, 필드별 정확도(`<=>`), 날짜 오답 목록, 표현 유형별 정확도, 자주 고친 필드, 가계부 금액 정확도

## 4. 주의

- 내려받은 `.sql/.csv/.jsonl`과 앱 백업 `.json`에는 개인 기록이 들어 있습니다. 저장소에 올리지 마세요(`.gitignore`에 패턴 추가됨).
- 다른 사람의 데이터는 그 사람 계정에만 있고, 본인이 직접 내보내야 합니다. 여러 사람 데이터를 쓰려면 동의를 받으세요.
- 한글이 `??`로 보이면 클라이언트 문자셋 문제입니다. `--default-character-set=utf8mb4`를 붙이세요.
- `changed`에는 앱이 자동으로 맞춘 값도 들어갑니다. 예: 시작 시각을 16:00으로 고치면 종료 시각이 자동으로 17:00이 되어 `startTime,endTime`이 됩니다. 날짜·시작 시각 위주로 평가하세요.
- 정답 라벨(`final_*`)은 "사용자가 저장한 값"입니다. 사용자가 틀린 값을 그대로 저장하면 정답으로 잡힙니다. 평가 보고서에 이 한계를 적어 두세요.
