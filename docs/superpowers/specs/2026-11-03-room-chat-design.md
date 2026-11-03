# 방 채팅과 기록 답장 — 설계

2026-11-03 · 상태: 사용자 검토 대기

## 왜

친구 사용자 요청(2026-11-03): 채팅 기능이 있었으면 좋겠다. 방마다 단체 채팅이 있고,
기록에 댓글을 달면 인스타 스토리 답장처럼 그 기록이 채팅에도 남는다.

시안(https://claude.ai/artifact/6m4S4UkNnMmvdGRY8pt7ae) 세 안 중 **A 스토리 답장형**을 골랐다.
상세 화면에는 입력칸만 있고, 대화는 방 채팅에서만 이어진다.

## 결정 요약

| 항목 | 결정 |
| --- | --- |
| 채팅 단위 | 방(그룹)마다 단체 채팅 하나. 정원이 4명이라 최대 4명 대화 |
| 기록 답장 | 사진 상세 아래 입력칸 「○○에게 답장…」. 보내면 그 기록을 인용한 메시지가 방 채팅에 올라간다 |
| 상세의 답장 목록 | 보여 주지 않는다(A안). 보낸 뒤 「대화방에 보냈어요」 토스트 |
| 내 기록에 답장 | 막지 않는다. 입력칸 문구만 「이 기록에 대해 말하기…」 |
| 채팅 여는 곳 | 방 화면 헤더의 말풍선 버튼. 안 읽은 메시지가 있으면 오렌지 점 |
| 인용 누르기 | 그 기록의 사진 상세로 연다(그날·그 사람 캐러셀, 그 장부터) |
| 지운 기록 | 메시지는 남고 인용 자리에 「지운 기록」. 썸네일 없음, 누를 수 없음 |
| 내 메시지 지우기 | 꾹 눌러 「지우기」 → 되돌리기 스낵바. 수정은 없다 |
| 나간 멤버 | 메시지는 남는다. 프로필을 볼 수 없으면 「나간 친구」 |
| 푸시 | 첫 버전에 넣는다. 나를 뺀 방 멤버에게, 알림 설정 「채팅」으로 끌 수 있다 |
| 웹앱 | 맞추지 않는다(시간 띠와 같은 방침). 웹에는 채팅이 없다 |

## ① 화면

### 방 화면 헤더

← · 날짜 `‹ 오늘 ›` · **말풍선** · 내 아바타. 말풍선은 `size-9` 원형 버튼(뒤로가기와 같은 모양)이고
안 읽은 메시지가 있으면 오른쪽 위에 오렌지 점. 읽기 라벨은 「대화방」 / 「대화방, 안 읽은 메시지 있음」.

### 사진 상세(`PostDetail`)

메모·리액션 아래, 화면 맨 아래에 입력칸 한 줄. 지금 보고 있는 장(캐러셀 index)의 기록에 답장한다.

- 입력칸에 포커스가 가면 키보드 위로 올라온다(iOS `padding` / Android `height`, `style={{ flex: 1 }}`).
- 보내기 성공 → 입력칸 비우고 키보드 내림, 토스트 「대화방에 보냈어요」. 실패 → 입력 내용을 남기고 「보내지 못했어요. 다시 보내 주세요」.
- 빈 내용·공백만은 보내기 버튼이 꺼진다. 최대 1000자.

### 방 채팅 화면(새 라우트 `src/app/(app)/chat.tsx`, `?group=`)

- 헤더: ← · 방 이름 · 「n명」.
- 메시지 목록: 최신이 아래(`FlatList inverted`). 처음 50개, 위로 올리면 50개씩 더.
- 말풍선: 내 것은 오른쪽 오렌지, 다른 사람은 왼쪽 아바타+이름(연속이면 생략). 날짜가 바뀌는 곳에 「오늘」·「11월 2일 (일)」 구분 줄.
- 답장 메시지: 말풍선 위에 인용 카드(썸네일 34pt + 「수진의 12:31 기록」, 내 기록이면 「내 12:31 기록」).
- 화면이 열려 있는 동안 새 메시지를 실시간으로 받는다. 열 때와 새 메시지를 받을 때 읽음 처리.
- 보드는 항상 어두운 화면이라 채팅도 `board` 토큰을 쓴다.

### 그룹 목록

카드에 안 읽은 메시지 점(숫자 없이). 시간 띠에서 비교 장치를 뺀 것과 같은 이유로 개수는 보이지 않는다.

### 접근성

- 큰 글자: 말풍선은 줄바꿈으로 늘어나고 인용 카드 문구는 두 줄까지.
- 스크린 리더: 답장 메시지는 「수진, 수진의 12시 31분 기록에 답장, 을지로 은주정」처럼 한 덩어리로 읽는다.
- 동작 줄이기: 새 메시지 등장 애니메이션 없음.

## ② 데이터(웹 저장소 마이그레이션)

```sql
create table public.room_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  post_id    uuid references public.posts on delete set null,
  is_reply   boolean not null default false,   -- post_id가 지워져도 "답장이었다"를 남긴다
  content    text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (post_id is null or is_reply)
);
create index on public.room_messages (group_id, created_at desc);

alter table public.group_members add column chat_read_at timestamptz;
alter table public.notification_settings add column chat_enabled boolean not null default true;
```

- **RLS:** select는 `is_group_member(group_id)`. insert는 본인 + 멤버 + (답장이면 그 기록의 `group_id`가 같은 방). delete는 본인 메시지만. update 없음.
  권한은 `20261023000000_push_permissions`처럼 `revoke all` 후 필요한 것만 grant.
- **기록 편집과의 관계:** 편집 RPC는 같은 행을 update하므로 답장이 유지된다. 편집에서 그 방을 빼면 그 방의 행이 지워져 답장은 「지운 기록」이 된다 — 그 방에서 기록이 사라진 것이니 맞는 동작이다.
- **읽음:** `mark_room_read(p_group_id)` RPC(security definer)가 `chat_read_at = now()`. `group_members`는 클라이언트에 update 권한을 주지 않는다.
- **안 읽음:** `room_unread(p_group_ids uuid[])` RPC가 방마다 「내 `chat_read_at` 뒤에 남이 보낸 메시지가 있나」를 boolean으로 돌려준다.
- **실시간:** `room_messages`를 `supabase_realtime` publication에 추가. Realtime은 RLS를 따르므로 멤버만 받는다.

## ③ 푸시

`room_messages` insert 트리거(security definer)가 `call_send_push`로 보낸다.

- 대상: 그 방 멤버 − 보낸 사람 − `chat_enabled = false`인 사람.
- 문구: 일반 `수진 · 점심 메이트: 을지로 은주정!`, 답장 `수진님이 내 기록에 답장: 을지로 은주정!`(기록 주인에게) / 다른 멤버에겐 일반 문구. 본문은 60자에서 자른다. 제목은 지금처럼 「뇸」.
- 딥링크: `/?group=<id>&chat=1`. 앱은 `parsePushUrl`이 `chat`을 읽어 채팅 화면으로 간다. 웹은 `chat`을 모르고 그 방 보드를 연다.
- 앱이 그 방 채팅 화면을 보고 있으면 포그라운드 배너를 띄우지 않는다(`setNotificationHandler`에서 현재 채팅 방과 비교).
- 연달아 보낸 메시지를 묶지는 않는다(첫 버전). 시끄럽다는 반응이 있으면 다음에 묶는다.

## ④ 모바일 코드 위치

- `src/entities/message/`: 모델, 쿼리(`useInfiniteQuery`)·뮤테이션(보내기·지우기), 실시간 구독 훅, 순수 로직(날짜 구분·연속 말풍선 묶기·인용 라벨) + 테스트.
- `src/shared/api/query-keys.ts`: `messages(groupId)`, `roomUnread(groupIdsKey)`.
- `src/widgets/post-detail`: 답장 입력칸.
- `src/widgets/board-header`: 말풍선 버튼과 점.
- `src/app/(app)/chat.tsx` + `src/widgets/room-chat/`: 채팅 화면.
- `src/features/notifications`: `push-url`의 `chat`, 딥링크 이동, 포그라운드 억제, 설정 토글 「채팅」.
- `src/types/database.ts`: 새 테이블·컬럼·RPC 타입.

## ⑤ 적용 순서

1. 웹 저장소에 마이그레이션 + 롤백 검증 SQL 작성, 로컬 Supabase로 확인 → main.
2. 모바일 구현 → main. 테스트·타입·린트, 시뮬레이터 확인.
3. 운영 DB 적용(`db push`)은 **따로 허락**을 받는다. 앱 출시보다 먼저 적용해야 새 빌드가 동작한다. 옛 빌드는 새 테이블을 쓰지 않아 영향이 없다.
4. 실기기 2대로 채팅·답장·푸시 확인 후 TestFlight 빌드.

## 범위 밖(첫 버전)

사진·이모지 메시지, 메시지 리액션, 메시지 수정, 읽은 사람 표시, 입력 중 표시, 푸시 묶기, 웹앱 채팅.
