# Plock MCP 서버

Claude Desktop, Claude Code 같은 MCP 클라이언트가 **내 Plock 일정을 조회하고 추가**하게 해 주는 로컬 서버입니다.
내 PC에서만 돌고(stdio), 도구는 두 개뿐입니다.

| 도구 | 하는 일 |
|---|---|
| `list_events(from, to)` | 기간과 겹치는 일정을 날짜순으로 (여러 날 일정 포함, 최대 366일) |
| `create_event(title, date, endDate?, startTime?, endTime?, category?, location?, memo?)` | 일정 하나 추가. 같은 날짜·제목·시작 시각이 이미 있으면 새로 만들지 않고 기존 것을 돌려줌 |

날짜 해석("다음 주 금요일")은 MCP 클라이언트의 LLM이 하고, 서버는 확정된 날짜·시각만 받아 형식과 범위를 검사한 뒤 앱과 같은 모양으로 저장합니다.
앱을 열어 두면 추가된 일정이 바로 나타납니다.

## 1. 준비 (한 번만)

키 파일 없이 **내 Google 로그인**으로 인증합니다(Application Default Credentials).
Firebase 프로젝트가 조직 정책으로 서비스 계정 키 생성을 막아 두었기 때문이고, 키 파일이 아예 없으니 유출될 것도 없습니다.

1. **Google Cloud CLI 설치**: https://cloud.google.com/sdk/docs/install → Windows 설치 프로그램. 설치 후 새 명령 프롬프트를 엽니다.
2. **로그인** (Plock Firebase 프로젝트 소유자인 Google 계정으로):
   ```bat
   gcloud auth application-default login
   gcloud auth application-default set-quota-project pivotal-reducer-2thv3
   ```
   브라우저에서 로그인하면 `%APPDATA%\gcloud\application_default_credentials.json`이 만들어집니다. 이 파일도 공유하지 마세요.
3. **내 계정 ID(UID)**: 로그인한 Plock에서 F12 → 콘솔 → `plock.uid()`
   (또는 Firebase 콘솔 → Authentication → 사용자 → 사용자 UID)
4. `cd D:\plock` → `git pull` → `npm install`

이 인증은 Firestore 보안 규칙을 우회하는 관리자 권한입니다. 그래서 서버는 `PLOCK_UID` 한 계정에만 접근하고, 조회·추가 두 가지만 합니다.
(서비스 계정 키를 만들 수 있는 환경이라면 `GOOGLE_APPLICATION_CREDENTIALS`에 키 경로를 넣어도 됩니다.)

## 2. Claude Desktop에 연결 (Windows)

`%APPDATA%\Claude\claude_desktop_config.json` (Claude Desktop → 설정 → 개발자 → 구성 편집)에 추가:

```json
{
  "mcpServers": {
    "plock": {
      "command": "node",
      "args": ["D:\\plock\\node_modules\\tsx\\dist\\cli.mjs", "D:\\plock\\mcp\\server.ts"],
      "env": { "PLOCK_UID": "여기에_UID" }
    }
  }
}
```

Claude Desktop을 완전히 종료했다가 다시 켜면 도구 목록에 `plock`이 보입니다.

**Claude Code**라면:
```bat
claude mcp add plock -e PLOCK_UID=여기에_UID -- node D:\plock\node_modules\tsx\dist\cli.mjs D:\plock\mcp\server.ts
```

**먼저 명령창에서 서버만 띄워 확인**하려면:
```bat
set PLOCK_UID=여기에_UID
npm run mcp
```
`plock MCP server ready`가 나오면 인증 준비 완료입니다 (Ctrl+C로 종료).

## 3. 써 보기

- "이번 주 Plock 일정 알려줘"
- "다음 주 금요일 저녁 7시에 동기 모임 Plock에 넣어줘, 카테고리는 약속"
- 같은 요청을 한 번 더 → "이미 있는 일정"이라고 답하고 중복으로 만들지 않음

## 4. 테스트 (Firestore 에뮬레이터)

```bat
npm run emulators          :: 다른 창에서
npm run mcp:test
```
실제 MCP 클라이언트로 서버를 띄워 두 도구를 호출합니다: 기간 조회(여러 날 일정 포함, 범위 밖 제외), 생성(끝 시각 기본값, 카테고리 이름 매칭),
같은 요청 반복 시 중복 없음, 잘못된 입력은 오류 결과, 저장된 문서가 앱과 같은 필드인지.
