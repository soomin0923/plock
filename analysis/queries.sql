-- Plock 분석 쿼리 (MySQL 8 / MariaDB 10.5+)
-- 먼저 콘솔에서 받은 덤프를 적재:  mysql -u root -p plock < plock-YYYYMMDD.sql
SET NAMES utf8mb4;
-- 날짜·시각 컬럼은 DATE/TIME, created_at 은 UTC 입니다.

-- =====================================================================
-- A. 데이터 품질 (가져오기 결과 점검)
-- =====================================================================

-- A1. 중복 일정: 제목·시작일·시작 시각이 같은 묶음
SELECT title, start_date, start_time, COUNT(*) AS n,
       MIN(created_at) AS first_created, MAX(created_at) AS last_created
FROM events
GROUP BY title, start_date, start_time
HAVING COUNT(*) > 1
ORDER BY n DESC, start_date;

-- A2. 중복이 몇 행인지 (지우면 몇 건이 남는지)
SELECT COUNT(*) AS total_rows,
       COUNT(DISTINCT title, start_date, start_time) AS distinct_rows,
       COUNT(*) - COUNT(DISTINCT title, start_date, start_time) AS duplicate_rows
FROM events;

-- A3. 가져오기 배치 추정: 같은 분(minute)에 만들어진 일정 묶음
SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS batch_minute, COUNT(*) AS n
FROM events
GROUP BY batch_minute
HAVING COUNT(*) >= 20
ORDER BY batch_minute;

-- A4. 고아 참조: 카테고리 목록에 없는 category_id
SELECT e.category_id, COUNT(*) AS n
FROM events e
LEFT JOIN categories c ON c.id = e.category_id
WHERE c.id IS NULL
GROUP BY e.category_id
ORDER BY n DESC;

-- A5. 기간 일정인데 시각이 붙은 일정 (가져오기 시 종일 → 09:00 변환 의심)
SELECT start_time, COUNT(*) AS n,
       SUM(end_date > start_date) AS multi_day
FROM events
WHERE start_time IS NOT NULL
GROUP BY start_time
ORDER BY n DESC
LIMIT 10;

-- A6. 같은 날 끝나는데 종료 시각이 시작보다 빠른 일정
SELECT id, title, start_date, start_time, end_time
FROM events
WHERE end_date = start_date AND end_time IS NOT NULL AND end_time < start_time;

-- =====================================================================
-- B. 자연어 일정 파서 평가 (parse_logs)
--    pred_* = 파서가 낸 값, final_* = 사용자가 실제로 저장한 값(정답 라벨)
--    outcome: saved(저장) / cancelled(취소) / undone(되돌림) / pending(창을 닫지 않음)
-- =====================================================================

-- B1. 전체 규모: 경로·방식별 입력 수와 저장률
SELECT surface, mode, COUNT(*) AS inputs,
       SUM(outcome = 'saved') AS saved,
       ROUND(AVG(outcome = 'saved') * 100, 1) AS save_rate_pct,
       ROUND(AVG(latency_ms)) AS avg_latency_ms
FROM parse_logs
WHERE task = 'plan'
GROUP BY surface, mode
ORDER BY inputs DESC;

-- B2. 필드별 정확도 (저장된 건만, NULL 끼리도 같음으로 처리: <=>)
SELECT mode,
       COUNT(*) AS n,
       ROUND(AVG(pred_kind       <=> final_kind)       * 100, 1) AS kind_acc,
       ROUND(AVG(pred_date       <=> final_date)       * 100, 1) AS date_acc,
       ROUND(AVG(pred_start_time <=> final_start_time) * 100, 1) AS time_acc,
       ROUND(AVG(pred_title      <=> final_title)      * 100, 1) AS title_acc,
       ROUND(AVG(pred_category_id <=> final_category_id) * 100, 1) AS category_acc,
       ROUND(AVG(changed IS NULL OR changed = '') * 100, 1) AS exact_match_pct
FROM parse_logs
WHERE task = 'plan' AND outcome = 'saved'
GROUP BY mode;

-- B3. 날짜를 틀린 사례 목록 (오답 분석용)
SELECT created_at, ref_date, input, pred_date, final_date,
       DATEDIFF(final_date, pred_date) AS off_by_days
FROM parse_logs
WHERE task = 'plan' AND outcome = 'saved' AND NOT (pred_date <=> final_date)
ORDER BY created_at;

-- B4. 표현 유형별 날짜 정확도
SELECT CASE
         WHEN input REGEXP '다다음 ?주|다음 ?주|담주|이번 ?주' THEN '주 단위'
         WHEN input REGEXP '[월화수목금토일]요일'              THEN '요일'
         WHEN input REGEXP '[0-9]+ ?월 ?[0-9]+ ?일|[0-9]+/[0-9]+' THEN '절대 날짜'
         WHEN input REGEXP '오늘|내일|모레|글피'                THEN '상대 날짜'
         WHEN input REGEXP '[0-9]+ ?(일|주) ?(뒤|후)'            THEN 'N일/주 후'
         ELSE '날짜 표현 없음'
       END AS expr_type,
       COUNT(*) AS n,
       ROUND(AVG(pred_date <=> final_date) * 100, 1) AS date_acc
FROM parse_logs
WHERE task = 'plan' AND outcome = 'saved'
GROUP BY expr_type
ORDER BY n DESC;

-- B5. 사용자가 가장 자주 고친 필드
WITH RECURSIVE nums AS (SELECT 1 AS k UNION ALL SELECT k + 1 FROM nums WHERE k < 10)
SELECT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.changed, ',', nums.k), ',', -1)) AS field,
       COUNT(*) AS times_corrected
FROM parse_logs p
JOIN nums ON nums.k <= 1 + LENGTH(p.changed) - LENGTH(REPLACE(p.changed, ',', ''))
WHERE p.outcome = 'saved' AND p.changed <> ''
GROUP BY field
ORDER BY times_corrected DESC;

-- B6. AI 실패 후 기본 분석으로 대신한 건 (오류 메시지별)
SELECT error, COUNT(*) AS n
FROM parse_logs
WHERE mode = 'local_fallback'
GROUP BY error
ORDER BY n DESC;

-- B7. 가계부 문장: 금액 정확도 (첫 번째 항목 기준)
SELECT mode, COUNT(*) AS n,
       ROUND(AVG(JSON_EXTRACT(pred_entries, '$[0].amount') = JSON_EXTRACT(final_entries, '$[0].amount')) * 100, 1) AS amount_acc,
       ROUND(AVG(JSON_LENGTH(pred_entries) = JSON_LENGTH(final_entries)) * 100, 1) AS count_acc
FROM parse_logs
WHERE task = 'ledger' AND outcome = 'saved'
GROUP BY mode;
