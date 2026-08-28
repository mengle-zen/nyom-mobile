-- ============================================================
-- Nyom — Expo push token 저장 (네이티브 앱)
-- ============================================================
-- ⚠️ 이 마이그레이션은 **작성만 하고 적용하지 않았다.**
--    백엔드(스키마·RPC·Edge Function)는 웹앱 저장소(nyom)에 있고, 그쪽 저장소는
--    이번 작업에서 읽기 전용이라 파일만 남긴다. 적용 전에 아래 "발송 측 불일치"를
--    반드시 함께 해결해야 한다.
--
-- ------------------------------------------------------------
-- 왜 push_subscriptions를 재사용하지 않는가
-- ------------------------------------------------------------
-- 기존 `push_subscriptions`는 W3C Web Push 구독을 담는 테이블이다:
--     endpoint text not null unique   -- 푸시 서비스의 HTTPS URL
--     p256dh   text not null          -- 구독자 공개키 (ECDH P-256)
--     auth     text not null          -- 인증 시크릿
-- 이 세 값은 VAPID 암호화 봉투를 만들기 위한 것이고, 셋이 함께 있어야 의미가 있다.
--
-- Expo push token은 `ExponentPushToken[xxxxxxxx]` 문자열 하나가 전부다.
-- 대응하는 공개키·시크릿이 없고, 발송도 URL이 아니라 Expo Push API
-- (https://exp.host/--/api/v2/push/send)로 토큰을 보내는 방식이다.
--
-- 기존 테이블에 밀어넣는 두 가지 방법을 모두 검토했고 둘 다 기각했다.
--
--   (A) endpoint = Expo 토큰, p256dh/auth = 더미 문자열
--       → NOT NULL을 만족시키려 의미 없는 값을 채우게 된다. 더 나쁜 건 발송 쪽이다.
--         `send-push` Edge Function은 이 테이블의 모든 행을 web-push 라이브러리에
--         그대로 넘기는데, endpoint가 URL이 아니면 예외가 나고 그 예외는 404/410이
--         아니라서 "만료 구독 정리" 분기에도 안 걸린다. 죽은 행이 영구히 쌓이고
--         웹 사용자에게 가는 발송까지 매번 실패 경로를 탄다.
--       → 즉 "저장은 되는데 아무도 못 받고 웹 발송까지 오염되는" 상태.
--
--   (B) push_subscriptions에 provider 컬럼 추가 + p256dh/auth를 nullable로 완화
--       → 배포된 Edge Function이 이미 읽고 있는 테이블의 NOT NULL 제약을 푸는 변경이라
--         마이그레이션 순서에 따라 웹 발송이 깨질 수 있다. 또 한 테이블이 두 프로토콜을
--         담게 되면 모든 조회에 provider 필터가 붙어야 하고, 빠뜨린 곳이 곧 버그가 된다.
--
--   (C) ✅ 채택 — 별도 테이블 `expo_push_tokens`
--       프로토콜이 다르면 테이블도 다르다. web-push 경로는 손대지 않으므로 기존
--       Edge Function·트리거가 그대로 돌고, Expo 발송은 새 경로로 따로 붙인다.
--       `notification_settings`(사용자 단위 on/off)는 두 경로가 공유한다 — 설정은
--       "사람"의 취향이지 전송 프로토콜의 속성이 아니다.
--
-- ------------------------------------------------------------
-- 발송 측 불일치 (이 마이그레이션만으로는 알림이 가지 않는다)
-- ------------------------------------------------------------
-- `supabase/functions/send-push`는 npm:web-push로 VAPID 암호화 발송만 한다.
-- Expo 토큰으로는 보낼 수 없다. 이 테이블을 실제로 쓰려면 다음이 더 필요하다:
--   1. Expo Push API로 보내는 발송 경로 (send-push 확장 또는 별도 함수).
--   2. `call_send_push`가 두 경로를 모두 태우도록 수정.
--   3. `send_daily_reminder`의 대상 조건
--        exists (select 1 from public.push_subscriptions ps where ps.user_id = gm.user_id)
--      를 expo_push_tokens까지 포함한 or 조건으로 확장. 지금 그대로 두면 네이티브
--      전용 사용자는 "구독 없음"으로 판정돼 리마인더 대상에서 조용히 빠진다.
-- 이 세 가지는 이번 작업 범위 밖이라 손대지 않았다.

create table public.expo_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  -- Expo가 발급하는 `ExponentPushToken[...]`. 기기 재설치·복원 시 값이 바뀌므로
  -- 토큰 자체를 unique 키로 두고 upsert 한다(같은 기기가 중복 행을 만들지 않게).
  token       text not null unique,
  platform    text not null check (platform in ('ios', 'android')),
  -- 앱 설치 식별자(expo-application의 installation id 등). 같은 기기에서 토큰이
  -- 갱신됐을 때 옛 행을 정리하는 데 쓴다. 못 구하면 null.
  device_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index expo_push_tokens_user_idx on public.expo_push_tokens (user_id);

alter table public.expo_push_tokens enable row level security;

-- 본인 토큰만 관리. 발송 경로는 service_role이라 RLS를 우회한다.
-- (push_subscriptions의 `push_subs_own`과 같은 형태로 맞춘다)
create policy "expo_push_tokens_own"
  on public.expo_push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
