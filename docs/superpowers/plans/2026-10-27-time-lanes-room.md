# 방 화면 시간 띠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 끼니 보드를 멤버별 시간 띠(TimeLanes)로 바꾸고, 앱에서 끼니 개념을 걷어내 시각 + 선택 태그만 남긴다.

**Architecture:** 배치는 순수 함수 `timeLanesLayout`(entities/post/time-lanes.ts)이 계산하고, 새 위젯 `widgets/time-lanes`가 그 결과를 그린다. 끼니 관련 모듈(board.ts·slot-progress·slot-board·slot-chips)은 지우고 태그 로직은 `entities/post/meal-tag.ts`로 옮긴다. 서버는 웹 저장소 마이그레이션 하나(정원 4명, 태그 지우기, 기본 끼니 이름 태그 허용).

**Tech Stack:** Expo SDK 57 · React Native 0.86 · NativeWind v4 · TanStack Query · Supabase · Vitest · Maestro

**Spec:** `docs/superpowers/specs/2026-10-27-time-lanes-room-design.md` · 디자인: https://claude.ai/artifact/EaWNoqjG4Mi4gn8mjLGXrx

---

## File Structure

| 파일 | 할 일 | 책임 |
| --- | --- | --- |
| `~/github/hyorish03/nyom/supabase/migrations/20261027000000_time_lanes.sql` | 새로 | 정원 4, 태그 지우기, 태그 이름 제약 완화 |
| `src/entities/post/meal-tag.ts` (+test) | 새로 | 태그 입력 해석, 시각·태그 라벨 |
| `src/entities/post/time-lanes.ts` (+test) | 새로 | 배치 계산, 띠 순서, 사람별 그날 사진 |
| `src/widgets/time-lanes/index.tsx` | 새로 | 시간 띠 그리기 + 뼈대 |
| `src/entities/post/ui/MealTagPicker.tsx` | `MealSlotChips.tsx`를 바꿔 새 이름으로 | 태그 붙이기·고치기·빼기 |
| `src/entities/post/{board,slot-progress}.ts` (+tests) | 삭제 | — |
| `src/widgets/{slot-board,slot-chips}/` | 삭제 | — |
| `src/entities/post/{deeplink,edit,model,queries,index}.ts` | 수정 | 끼니 제거, 태그만 |
| `src/app/(app)/board.tsx` | 수정 | TimeLanes로 교체, 세로 제스처 제거 |
| `src/widgets/post-detail/index.tsx` | 수정 | `initialIndex`, 라벨 |
| `src/features/upload/ui/ShotEditor.tsx`, `src/app/upload.tsx` | 수정 | 시각 입력 + 태그 |
| `src/shared/ui/TimeField.tsx` | 수정 | `variant: 'onDark'` |
| `src/features/post-edit/ui/PostEditSheet.tsx` | 수정 | 끼니 칩 제거, 태그 빼기 |
| `src/app/(app)/profile.tsx`, `src/features/calendar/ui/DayTimeline.tsx`, `src/features/profile/api.ts` | 수정 | 라벨 |
| `src/features/notifications/{lib/push-url.ts,ui/NotificationDeepLinks.tsx}`, `src/shared/lib/board-href.ts` | 수정 | 날짜만 |
| `src/features/group/lib/join-error.ts`, `src/features/group/ui/GroupSettingsSheet.tsx` | 수정 | 정원 4, 수락 막기 |
| `.maestro/flows/03-board.yaml`, `05-upload.yaml` | 수정 | 새 화면 |
| `AGENTS.md` | 수정 | 끼니 개편 문장 갱신 |

---

### Task 1: 서버 마이그레이션 (웹 저장소)

**Files:**
- Create: `~/github/hyorish03/nyom/supabase/migrations/20261027000000_time_lanes.sql`

- [ ] **Step 1: 최신 정의 위에 마이그레이션 작성**

`20261023010000_group_post_access.sql`의 `join_group_by_code`·`approve_join_request`·`update_post_batch`
정의를 그대로 복사해 아래만 바꾼다(그 파일이 세 함수의 최신 정의다).

1. 두 가입 함수: `if v_count >= 8 then` → `if v_count >= 4 then`.
2. `update_post_batch`의 끼니 블록을 다음으로 교체(변수 선언에 `v_clear boolean;` 추가):

```sql
  if p_meal_slot is not null and p_meal_tag is not null then
    raise exception 'INVALID_MEAL';
  end if;
  if p_meal_slot is not null
     and p_meal_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'INVALID_MEAL_SLOT';
  end if;
  -- 빈 태그('' 또는 공백) = 끼니·태그 둘 다 비우기 (2026-10-27 시간 띠 개편)
  v_tag := nullif(btrim(coalesce(p_meal_tag, '')), '');
  v_clear := p_meal_tag is not null and v_tag is null;
  if v_tag is not null and char_length(v_tag) > 10 then
    raise exception 'INVALID_MEAL_TAG';
  end if;
  v_change := p_meal_slot is not null or p_meal_tag is not null;

  if v_change then
    v_slot := p_meal_slot;   -- 태그를 붙이거나 지우면 끼니는 null
  else
    v_slot := v_rep.meal_slot;
    v_tag  := v_rep.meal_tag;
  end if;
```

3. 파일 앞에 태그 이름 제약 완화:

```sql
-- 앱에서 끼니 칸이 없어져 '점심' 같은 이름도 그냥 태그다.
alter table public.posts drop constraint posts_meal_tag_check;
alter table public.posts add constraint posts_meal_tag_check
  check (meal_tag = btrim(meal_tag) and char_length(meal_tag) between 1 and 10);
```

머리말 주석에 배경(시간 띠 개편, 정원 4명, 빈 태그 규칙, 예전 빌드 호환)을 적는다.
`grant execute`는 세 함수 시그니처 그대로 다시 준다.

- [ ] **Step 2: 로컬에서 처음부터 적용**

Run: `cd ~/github/hyorish03/nyom && pnpm dlx supabase start -x studio,logflare,vector,imgproxy,edge-runtime,realtime,mailpit && pnpm dlx supabase db reset`
Expected: `Applying migration 20261027000000_time_lanes.sql...` 오류 없음

- [ ] **Step 3: SQL로 동작 확인** (`docker exec -i supabase_db_kpsaehcsiyvbvxgtaghk psql -U postgres`)

사용자 2명·그룹·게시물을 넣고 `set role authenticated; select set_config('request.jwt.claims', '{"sub":"<me>","role":"authenticated"}', false);` 뒤:
- `update_post_batch(id, groups, null, null, null, '야식')` → 태그 '야식', 끼니 null
- `update_post_batch(id, groups, null, null, null, '  ')` → 태그·끼니 null
- `update_post_batch(id, groups, null, null, null, '점심')` → 태그 '점심' (이제 허용)
- 인자 5개 호출(`p_meal_slot => 'dinner'`) → 끼니 dinner (예전 클라이언트 호환)
- 다섯 번째 사용자 `join_group_by_code` → `GROUP_FULL`

- [ ] **Step 4: 커밋 (push·운영 적용은 하지 않는다)**

```bash
cd ~/github/hyorish03/nyom && git add supabase/migrations/20261027000000_time_lanes.sql
git commit -m "feat(db): 방 정원 4명, 편집 RPC 빈 태그로 끼니·태그 지우기"
```

---

### Task 2: 태그·라벨 순수 로직

**Files:**
- Create: `src/entities/post/meal-tag.ts`, `src/entities/post/meal-tag.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { MEAL_TAG_MAX, parseMealTag, postTimeLabel } from './meal-tag'

describe('parseMealTag', () => {
  it('공백을 다듬는다', () => {
    expect(parseMealTag('  늦은   야식 ')).toEqual({ ok: true, tag: '늦은 야식' })
  })
  it('예전 기본 끼니 이름도 그냥 태그', () => {
    expect(parseMealTag('점심')).toEqual({ ok: true, tag: '점심' })
  })
  it('비었거나 10자를 넘으면 거절', () => {
    expect(parseMealTag('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseMealTag('가'.repeat(MEAL_TAG_MAX)).ok).toBe(true)
    expect(parseMealTag('가'.repeat(MEAL_TAG_MAX + 1))).toEqual({ ok: false, reason: 'too_long' })
  })
  it('글자 수는 코드 포인트(DB char_length와 같게)', () => {
    expect(parseMealTag('🍜'.repeat(10)).ok).toBe(true)
  })
})

describe('postTimeLabel', () => {
  const at = new Date(2026, 9, 27, 23, 40).toISOString()
  it('태그가 없으면 시각만', () => expect(postTimeLabel(at, null)).toBe('23:40'))
  it('태그 · 시각', () => expect(postTimeLabel(at, '야식')).toBe('야식 · 23:40'))
  it('시각을 못 읽으면 태그만, 둘 다 없으면 빈 문자열', () => {
    expect(postTimeLabel('nope', '야식')).toBe('야식')
    expect(postTimeLabel(null, null)).toBe('')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm exec vitest run src/entities/post/meal-tag.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
import { hhmmFromDate } from './date-range'

/** 사용자 태그 최대 글자 수. DB `posts_meal_tag_check`와 같아야 한다. */
export const MEAL_TAG_MAX = 10

export type MealTagInput = { ok: true; tag: string } | { ok: false; reason: 'empty' | 'too_long' }

/**
 * 사용자가 입력한 태그 이름 정리 — 앞뒤 공백 제거, 안쪽 연속 공백은 하나로.
 * 글자 수는 코드 포인트로 센다(Postgres `char_length`와 같은 기준).
 * 2026-10-27 시간 띠 개편으로 끼니 칸이 없어져 '점심'도 그냥 태그다.
 */
export function parseMealTag(raw: string): MealTagInput {
  const tag = raw.trim().replace(/\s+/g, ' ')
  if (!tag) return { ok: false, reason: 'empty' }
  if ([...tag].length > MEAL_TAG_MAX) return { ok: false, reason: 'too_long' }
  return { ok: true, tag }
}

/** 「야식 · 23:40」 / 「23:40」 — 그리드 오버레이·상세 머리처럼 좁은 자리용. */
export function postTimeLabel(recordedAt: string | null | undefined, tag: string | null | undefined): string {
  const date = recordedAt ? new Date(recordedAt) : null
  const time = date && !Number.isNaN(date.getTime()) ? hhmmFromDate(date) : ''
  if (tag && time) return `${tag} · ${time}`
  return tag || time
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋** — `git add src/entities/post/meal-tag* && git commit -m "feat(post): 태그 해석·시각 라벨을 끼니와 분리"`

---

### Task 3: 시간 띠 배치 함수

**Files:**
- Create: `src/entities/post/time-lanes.ts`, `src/entities/post/time-lanes.test.ts`

- [ ] **Step 1: 실패하는 테스트** (사진 60pt → 30분=60pt, 1분=2pt)

```ts
import { describe, expect, it } from 'vitest'
import { FOLD_HEIGHT, LANE_GAP, laneMembers, postsByMember, timeLanesLayout } from './time-lanes'

const at = (h: number, m: number) => new Date(2026, 9, 27, h, m).toISOString()
const P = 60
const run = (lanes: [string, number, number][][], now: Date | null = null) =>
  timeLanesLayout({ lanes: lanes.map((l) => l.map(([id, h, m]) => ({ id, at: at(h, m) }))), photo: P, now })
const yOf = (r: ReturnType<typeof run>, id: string) => r.items.find((i) => i.postId === id)!.y

describe('timeLanesLayout', () => {
  it('사진이 없으면 빈 결과', () => {
    expect(run([[], []])).toEqual({ height: 0, items: [], marks: [], nowY: null })
  })

  it('한 장이면 맨 위, 높이는 사진 한 변', () => {
    const r = run([[['a', 12, 0]]])
    expect(r.items).toEqual([{ postId: 'a', lane: 0, y: 0 }])
    expect(r.height).toBe(P)
  })

  it('같은 띠에서 겹치면 앞 사진 아래로 민다', () => {
    const r = run([[['a', 12, 20], ['b', 12, 31]]])
    expect(yOf(r, 'a')).toBe(0)
    expect(yOf(r, 'b')).toBe(P + LANE_GAP)
  })

  it('다른 띠는 서로 밀지 않는다', () => {
    const r = run([[['a', 12, 0]], [['b', 12, 10]]])
    expect(yOf(r, 'b')).toBe(20)
  })

  it('1시간 넘게 비면 접힌 줄, 다음 구간은 그 아래', () => {
    const r = run([[['a', 8, 0]], [['b', 10, 0]]])
    expect(r.marks).toContainEqual({ kind: 'fold', y: P + LANE_GAP, from: '08:30', to: '10:00' })
    expect(yOf(r, 'b')).toBe(P + LANE_GAP + FOLD_HEIGHT + LANE_GAP)
  })

  it('딱 1시간 비면 접지 않는다', () => {
    const r = run([[['a', 8, 0]], [['b', 9, 30]]])
    expect(r.marks.some((m) => m.kind === 'fold')).toBe(false)
    expect(yOf(r, 'b')).toBe(90 * 2)
  })

  it('밀려서 길어진 띠 다음 구간은 그 끝보다 아래에서 시작', () => {
    const r = run([[['a', 12, 0], ['b', 12, 5], ['c', 12, 10]], [['d', 13, 0], ['e', 15, 0]]])
    const cBottom = yOf(r, 'c') + P
    expect(yOf(r, 'e')).toBeGreaterThanOrEqual(cBottom + LANE_GAP + FOLD_HEIGHT + LANE_GAP)
  })

  it('띠 안 순서 = 시각 순서, 겹침 없음', () => {
    const r = run([[['a', 9, 0], ['b', 9, 1], ['c', 9, 2], ['d', 14, 0], ['e', 14, 20]]])
    const ys = ['a', 'b', 'c', 'd', 'e'].map((id) => yOf(r, id))
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] + P + LANE_GAP)
  })

  it('구간 안 정시마다 눈금', () => {
    const r = run([[['a', 11, 50], ['b', 12, 31]]])
    expect(r.marks.filter((m) => m.kind === 'tick')).toEqual([
      { kind: 'tick', y: 20, label: '12:00' },
      { kind: 'tick', y: 140, label: '13:00' },
    ])
  })

  it('지금 선 — 구간 안 / 조금 뒤 / 한참 뒤', () => {
    expect(run([[['a', 12, 0]]], new Date(2026, 9, 27, 12, 10)).nowY).toBe(20)
    const soon = run([[['a', 12, 0]]], new Date(2026, 9, 27, 12, 50))
    expect(soon.nowY).toBe(100)
    expect(soon.height).toBeGreaterThanOrEqual(100)
    const late = run([[['a', 12, 0]]], new Date(2026, 9, 27, 15, 0))
    expect(late.marks).toContainEqual({ kind: 'fold', y: P + LANE_GAP, from: '12:30', to: '15:00' })
    expect(late.nowY).toBe(P + LANE_GAP + FOLD_HEIGHT + LANE_GAP)
  })
})

describe('laneMembers', () => {
  it('나를 맨 앞으로, 나머지는 원래 순서', () => {
    const ms = [{ user_id: 'a' }, { user_id: 'me' }, { user_id: 'b' }]
    expect(laneMembers(ms, 'me').map((m) => m.user_id)).toEqual(['me', 'a', 'b'])
  })
})

describe('postsByMember', () => {
  it('그 사람 기록만 시각순', () => {
    const ps = [
      { id: '2', user_id: 'a', recorded_at: at(12, 0) },
      { id: 'x', user_id: 'b', recorded_at: at(9, 0) },
      { id: '1', user_id: 'a', recorded_at: at(8, 0) },
    ]
    expect(postsByMember(ps, 'a').map((p) => p.id)).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm exec vitest run src/entities/post/time-lanes.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
/**
 * 방 화면 시간 띠의 배치 계산(2026-10-27 설계 ②).
 * - 사진이 있는 구간은 30분 = 사진 한 변.
 * - 사진 한 장은 그 시각부터 30분을 차지하고, 모든 띠의 자리를 합친 구간 사이가
 *   1시간 넘게 비면 접힌 줄 하나로 바꾼다.
 * - 같은 띠에서 겹치면 아래로 민다. 순서는 정확, 간격은 대략(각인 시각은 늘 정확).
 */
export const LANE_GAP = 4
export const FOLD_HEIGHT = 24
const SLOT_MIN = 30
const FOLD_AFTER_MIN = 60

export type LanePost = { id: string; at: string }
export type LaneItem = { postId: string; lane: number; y: number }
export type LaneMark =
  | { kind: 'tick'; y: number; label: string }
  | { kind: 'fold'; y: number; from: string; to: string }
export type LanesLayout = { height: number; items: LaneItem[]; marks: LaneMark[]; nowY: number | null }

const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

type Entry = { id: string; lane: number; min: number }
type Window = { start: number; end: number; entries: Entry[] }

export function timeLanesLayout(input: {
  lanes: LanePost[][]
  photo: number
  now: Date | null
}): LanesLayout {
  const { photo } = input
  const scale = photo / SLOT_MIN
  const entries: Entry[] = input.lanes
    .flatMap((posts, lane) => posts.map((p) => ({ id: p.id, lane, min: minuteOf(new Date(p.at)) })))
    .sort((a, b) => a.min - b.min)
  if (entries.length === 0) return { height: 0, items: [], marks: [], nowY: null }

  const windows: Window[] = []
  for (const e of entries) {
    const last = windows[windows.length - 1]
    if (last && e.min - last.end <= FOLD_AFTER_MIN) {
      last.entries.push(e)
      last.end = Math.max(last.end, e.min + SLOT_MIN)
    } else {
      windows.push({ start: e.min, end: e.min + SLOT_MIN, entries: [e] })
    }
  }

  const items: LaneItem[] = []
  const marks: LaneMark[] = []
  const laneBottom = new Map<number, number>()
  const tops: number[] = []
  let top = 0
  let bottom = 0

  windows.forEach((w, wi) => {
    if (wi > 0) {
      const foldY = bottom + LANE_GAP
      marks.push({ kind: 'fold', y: foldY, from: hhmm(windows[wi - 1].end), to: hhmm(w.start) })
      top = foldY + FOLD_HEIGHT + LANE_GAP
    }
    tops.push(top)
    let windowBottom = top + (w.end - w.start) * scale
    for (const e of w.entries) {
      const base = top + (e.min - w.start) * scale
      const prev = laneBottom.get(e.lane)
      const y = prev === undefined ? base : Math.max(base, prev + LANE_GAP)
      items.push({ postId: e.id, lane: e.lane, y })
      laneBottom.set(e.lane, y + photo)
      windowBottom = Math.max(windowBottom, y + photo)
    }
    for (let h = Math.floor(w.start / 60) + 1; h * 60 <= w.end; h++) {
      marks.push({ kind: 'tick', y: top + (h * 60 - w.start) * scale, label: hhmm(h * 60) })
    }
    bottom = windowBottom
  })

  let nowY: number | null = null
  if (input.now) {
    const n = minuteOf(input.now)
    const last = windows[windows.length - 1]
    const inside = windows.findIndex((w) => n >= w.start && n <= w.end)
    if (inside >= 0) {
      nowY = tops[inside] + (n - windows[inside].start) * scale
    } else if (n > last.end) {
      if (n - last.end > FOLD_AFTER_MIN) {
        const foldY = bottom + LANE_GAP
        marks.push({ kind: 'fold', y: foldY, from: hhmm(last.end), to: hhmm(n) })
        nowY = foldY + FOLD_HEIGHT + LANE_GAP
      } else {
        nowY = tops[tops.length - 1] + (n - last.start) * scale
      }
    } else if (n < windows[0].start) {
      nowY = 0
    } else {
      const fold = marks.find(
        (m): m is Extract<LaneMark, { kind: 'fold' }> => m.kind === 'fold' && hhmm(n) >= m.from && hhmm(n) <= m.to,
      )
      nowY = fold ? fold.y + FOLD_HEIGHT / 2 : null
    }
  }

  return { height: Math.max(bottom, (nowY ?? 0) + 2), items, marks, nowY }
}

/** 띠 순서 — 나를 맨 앞으로, 나머지는 받은 순서(멤버 조회가 이미 들어온 순). */
export function laneMembers<M extends { user_id: string }>(members: M[], me: string): M[] {
  return [...members.filter((m) => m.user_id === me), ...members.filter((m) => m.user_id !== me)]
}

/** 그 사람의 그날 기록, 시각순 — 띠와 상세 캐러셀이 같이 쓴다. */
export function postsByMember<P extends { user_id: string; recorded_at: string }>(posts: P[], userId: string): P[] {
  return posts.filter((p) => p.user_id === userId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
}
```

`height` 기대값: 한 장 테스트는 `max(60, 0+2)=60`, 지금 선 없으면 `nowY ?? 0`이 0이라 `bottom`이 그대로 나온다.

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋** — `git add src/entities/post/time-lanes* && git commit -m "feat(post): 시간 띠 배치 계산"`

---

### Task 4: 데이터 계층에서 끼니 걷어내기

**Files:**
- Delete: `src/entities/post/board.ts`, `board.test.ts`, `slot-progress.ts`, `slot-progress.test.ts`
- Modify: `src/entities/post/{index,deeplink,deeplink.test,edit,edit.test,model,queries}.ts`, `src/features/profile/api.ts`

- [ ] **Step 1: `edit.ts` 테스트부터 고친다** — `PostBatchDraft.meal` → `tag: string | null`, `mealChange` → `tagChange`:

```ts
describe('tagChange', () => {
  it('안 바뀌면 null(변경 없음)', () => expect(tagChange('야식', '야식')).toBeNull())
  it('바뀌면 새 태그', () => expect(tagChange(null, '술')).toBe('술'))
  it('지우면 빈 문자열', () => expect(tagChange('야식', null)).toBe(''))
  it('없던 걸 그대로 두면 null', () => expect(tagChange(null, null)).toBeNull())
})
```
`hasPostBatchChanges` 테스트의 끼니 케이스는 `{ ...base, tag: '야식' }`로 바꾼다. `postEditErrorMessage('INVALID_MEAL_TAG')` 기대 문구는 `'10자'` 포함.

- [ ] **Step 2: `edit.ts` 구현**

```ts
export type PostBatchDraft = { groupIds: string[]; caption: string; recordedTime: string; tag: string | null }
// hasPostBatchChanges: if (before.tag !== after.tag) return true
/** RPC에 보낼 태그. 안 바뀌면 null(변경 없음), 지우면 ''(서버가 끼니·태그를 비운다). */
export function tagChange(before: string | null, after: string | null): string | null {
  if (before === after) return null
  return after ?? ''
}
// postEditErrorMessage: INVALID_MEAL_TAG → '태그는 10자까지 쓸 수 있어요', INVALID_MEAL·INVALID_MEAL_SLOT 줄은 지운다
```

- [ ] **Step 3: `deeplink.ts` — 날짜만**

```ts
export type DeeplinkTarget = { dateOffset: number }
export function deeplinkTarget(params: { date?: string }, now: Date, maxOffset: number): DeeplinkTarget {
  const date = parseLocalDate(params.date)
  const offset = date === null ? -1 : offsetFromDate(date, now)
  return { dateOffset: offset >= 0 && offset <= maxOffset ? offset : 0 }
}
```
테스트는 `pageKey` 기대값을 모두 지우고 `{ dateOffset }`만 비교한다(slot·tag 케이스 삭제).

- [ ] **Step 4: `model.ts`**
  - `BoardPost`·`DayPost`의 `meal_slot` 타입을 `string | null`로 바꾸고 `./board` import를 지운다(`MealSlotKey` 제거).
  - `CreatePostParams.meal: Meal` → `tag: string | null`; insert 행 `meal_slot: null, meal_tag: tag`.
  - `PostBatch.meal` → `tag: string | null` (`tag: rep.meal_tag`).
  - `UpdatePostBatchParams.meal` → `tag: string | null`; RPC 인자 `p_meal_tag: tag` (p_meal_slot은 보내지 않는다). 주석에 "빈 문자열 = 지우기(20261027000000)".
  - `queries.ts` `useUpdatePostBatch` vars `meal` → `tag`.
  - `features/profile/api.ts` `MyPost.meal_slot` 타입 `string | null`, `MealSlotKey` import 제거.
- [ ] **Step 5: `index.ts` 재수출 정리**

```ts
export { MEAL_TAG_MAX, parseMealTag, postTimeLabel, type MealTagInput } from './meal-tag'
export { timeLanesLayout, laneMembers, postsByMember, LANE_GAP, FOLD_HEIGHT, type LanesLayout, type LaneMark } from './time-lanes'
// date-range · date-heading · dedupe · image-source · deeplink 재수출은 그대로
```
`board.ts`·`slot-progress.ts`와 두 테스트 파일을 삭제한다.

- [ ] **Step 6: 확인** — `pnpm exec vitest run src/entities` → PASS. `pnpm exec tsc --noEmit`은 화면 쪽 오류가 남는다(다음 작업에서 고친다).
- [ ] **Step 7: 커밋** — `git commit -am "refactor(post): 끼니 모델을 걷어내고 태그만 남김"`

---

### Task 5: 시간 띠 위젯

**Files:**
- Create: `src/widgets/time-lanes/index.tsx`

- [ ] **Step 1: 구현**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native'
import { Image } from 'expo-image'
import { FOLD_HEIGHT, hhmmFromDate, postImageSource, timeLanesLayout } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import type { GroupMemberProfile } from '@/entities/group'
import { PressableScale } from '@/shared/ui/press'
import { Skeleton } from '@/shared/ui/skeleton'

const GUTTER = 40
const PAD = 12
const GAP = 6
const VISIBLE = 4
const HEADER_H = 56
const STAMP_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' })
const AVATAR = ['#FFA56A', '#9FD18B', '#8EC5FF', '#F7A8C4', '#C7B6F2', '#F5D06F']

type Props = {
  members: GroupMemberProfile[]      // laneMembers로 이미 정렬
  posts: BoardPost[]
  currentUserId: string
  now: Date | null                   // 오늘만
  /** 오늘이면 가장 최근 사진으로, 지난날이면 맨 위로 처음 스크롤 */
  startAtLatest: boolean
  onOpenPost: (post: BoardPost) => void
}

/** 2026-10-27 설계 ① — 멤버별 세로 띠, 같은 시간축. 배치는 `timeLanesLayout`. */
export function TimeLanes({ members, posts, currentUserId, now, startAtLatest, onOpenPost }: Props) {
  const [width, setWidth] = useState(0)
  const [viewH, setViewH] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
    setViewH(e.nativeEvent.layout.height)
  }, [])

  const shown = Math.min(Math.max(members.length, 1), VISIBLE)
  const photo = width > 0 ? Math.floor((width - GUTTER - PAD * 2 - GAP * (shown - 1)) / shown) : 0
  const lanesW = GUTTER + PAD * 2 + members.length * photo + GAP * Math.max(members.length - 1, 0)

  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts])
  const layout = useMemo(
    () =>
      timeLanesLayout({
        lanes: members.map((m) =>
          posts.filter((p) => p.user_id === m.user_id).map((p) => ({ id: p.id, at: p.recorded_at })),
        ),
        photo: photo || 1,
        now,
      }),
    [members, posts, photo, now],
  )

  const latestY = layout.items.reduce((max, i) => Math.max(max, i.y), 0)
  useEffect(() => {
    if (!photo || !viewH) return
    const y = startAtLatest ? Math.max(0, latestY + photo - viewH + HEADER_H + 24) : 0
    scrollRef.current?.scrollTo({ y, animated: false })
  }, [startAtLatest, latestY, photo, viewH])

  const laneX = (lane: number) => GUTTER + PAD + lane * (photo + GAP)

  return (
    <View className="flex-1" onLayout={onLayout}>
      {photo > 0 && (
        <ScrollView horizontal scrollEnabled={members.length > VISIBLE} showsHorizontalScrollIndicator={false}>
          <View style={{ width: Math.max(lanesW, width), flex: 1 }}>
            <View className="flex-row border-b border-white/10" style={{ height: HEADER_H, paddingLeft: GUTTER + PAD, gap: GAP }}>
              {members.map((m, i) => (
                <View key={m.user_id} style={{ width: photo }} className="items-center justify-center gap-0.5">
                  <View className="size-7 items-center justify-center rounded-full" style={{ backgroundColor: AVATAR[i % AVATAR.length] }}>
                    <Text className="text-xs font-extrabold text-neutral-900">{(m.user_id === currentUserId ? '나' : m.nickname)[0]}</Text>
                  </View>
                  <Text numberOfLines={1} className="text-[11.5px] font-bold text-white">
                    {m.user_id === currentUserId ? '나' : m.nickname}
                  </Text>
                </View>
              ))}
            </View>
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}>
              <View style={{ height: layout.height }}>
                {layout.marks.map((mark, i) =>
                  mark.kind === 'tick' ? (
                    <View key={`t${i}`} pointerEvents="none" style={{ position: 'absolute', left: PAD, right: PAD, top: mark.y }}>
                      <View className="h-px bg-white/5" />
                      <Text style={{ fontFamily: STAMP_FONT }} className="mt-0.5 text-[10.5px] text-white/55">{mark.label}</Text>
                    </View>
                  ) : (
                    <View key={`f${i}`} pointerEvents="none" className="flex-row items-center gap-2"
                      style={{ position: 'absolute', left: PAD, right: PAD, top: mark.y, height: FOLD_HEIGHT }}
                      accessibilityLabel={`${mark.from}부터 ${mark.to}까지 기록 없음`}>
                      <View className="h-0 flex-1 border-t border-dashed border-white/20" />
                      <Text style={{ fontFamily: STAMP_FONT }} className="text-[10.5px] text-white/60">{mark.from} ─ {mark.to}</Text>
                      <View className="h-0 flex-1 border-t border-dashed border-white/20" />
                    </View>
                  ),
                )}
                {layout.items.map((item) => {
                  const post = byId.get(item.postId)!
                  const who = members[item.lane]
                  const time = hhmmFromDate(new Date(post.recorded_at))
                  return (
                    <PressableScale
                      key={item.postId}
                      onPress={() => onOpenPost(post)}
                      swipeSafe
                      hapticKind={null}
                      accessibilityRole="button"
                      accessibilityLabel={`${who.user_id === currentUserId ? '나' : who.nickname} ${post.meal_tag ? `${post.meal_tag} ` : ''}${time} 사진 보기`}
                      style={{ position: 'absolute', left: laneX(item.lane), top: item.y, width: photo, height: photo }}
                      className="overflow-hidden rounded-[10px] bg-board-tile"
                    >
                      {post.signedImageUrl && (
                        <Image source={postImageSource(post)} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      )}
                      {post.meal_tag ? (
                        <Text numberOfLines={1} className="absolute left-1 top-1 rounded-full bg-black/50 px-1.5 text-[10px] font-extrabold text-white">
                          {post.meal_tag}
                        </Text>
                      ) : null}
                      <Text
                        style={{ fontFamily: STAMP_FONT, textShadowColor: 'rgba(255,120,30,0.75)', textShadowRadius: 4 }}
                        className="absolute bottom-1 right-1.5 text-xs text-[#FF9A3D]"
                      >
                        {time}
                      </Text>
                    </PressableScale>
                  )
                })}
                {layout.nowY !== null && (
                  <View pointerEvents="none" style={{ position: 'absolute', left: 6, right: PAD, top: layout.nowY - 8 }} className="flex-row items-center">
                    <Text className="rounded-full bg-primary px-1.5 text-[10px] font-extrabold text-neutral-900">지금</Text>
                    <View className="h-0.5 flex-1 rounded-full bg-primary" />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

/** 도착 전 뼈대 — 같은 머리줄 + 띠마다 회색 칸 두 개. */
export function TimeLanesSkeleton({ memberCount }: { memberCount: number }) {
  const n = Math.min(Math.max(memberCount, 1), VISIBLE)
  return (
    <View className="flex-1 flex-row pt-16" style={{ paddingLeft: GUTTER + PAD, paddingRight: PAD, gap: GAP }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} className="flex-1 gap-24" style={{ opacity: 0.09 }}>
          <Skeleton style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }} />
          <Skeleton style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }} />
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 2: 확인** — `pnpm exec tsc --noEmit` 에서 이 파일 관련 오류 없음(board.tsx 오류는 다음 작업)
- [ ] **Step 3: 커밋** — `git add src/widgets/time-lanes && git commit -m "feat(board): 시간 띠 위젯"`

---

### Task 6: 보드 화면 교체 + 상세 시작 위치

**Files:**
- Modify: `src/app/(app)/board.tsx`, `src/widgets/post-detail/index.tsx`, `src/widgets/board-header/index.tsx`(주석)
- Delete: `src/widgets/slot-board/`, `src/widgets/slot-chips/`

- [ ] **Step 1: `board.tsx`**
  - import에서 `clampSlotIdx, pageIndex, sameMeal, mealOf, slotProgress`, `SlotChips`, `SlotBoard, SlotBoardSkeleton` 제거. `laneMembers, postsByMember` 와 `TimeLanes, TimeLanesSkeleton`, `MAX_MEMBERS`(`@/features/group`) 추가.
  - `deeplinkTarget({ date: one(params.date) }, new Date(), MAX_OFFSET)`; `pageKey`·`slots`·`slotIdx`·`changeSlot`·`commitSlotSwipe` 삭제.
  - 팬 제스처: `Gesture.Pan().activeOffsetX([-20, 20]).failOffsetY([-12, 12]).enabled(members.length <= MAX_MEMBERS)` 를 붙이고 `onEnd`의 `axis === 'v'` 분기 삭제. `decideAxis`는 가로 판정에 그대로 쓴다.
  - 본문:

```tsx
const laneOrder = useMemo(() => laneMembers(members, userId), [members, userId])
const now = dateOffset === 0 ? new Date() : null
// …
<TimeLanes
  members={laneOrder}
  posts={posts}
  currentUserId={userId}
  now={now}
  startAtLatest={dateOffset === 0 || pushedDate === dateOffset}
  onOpenPost={openPost}
/>
```
  `pushedDate`는 알림으로 연 날(지난날이어도 그날 가장 최근 사진으로 간다):
  `const [pushedDate] = useState(() => (one(params.date) ? initialTarget.dateOffset : null))`.
  - 뼈대: `<TimeLanesSkeleton memberCount={members.length} />`.
  - 상세:

```tsx
const detailPosts = useMemo<BoardPost[]>(() => {
  const opened = posts.find((p) => p.id === detailPostId)
  return opened ? postsByMember(posts, opened.user_id) : []
}, [posts, detailPostId])
const detailIndex = Math.max(0, detailPosts.findIndex((p) => p.id === detailPostId))
// <PostDetail key={detailPostId ?? 'closed'} posts={detailPosts} initialIndex={detailIndex} … />
```
  주석: 캐러셀 범위가 "같은 끼니"에서 "그 사람의 그날 사진 전체"로 바뀌었다.
- [ ] **Step 2: `post-detail`** — props에 `initialIndex: number` 추가, `useState(initialIndex)`, 가로 `ScrollView`에 `contentOffset={{ x: initialIndex * width, y: 0 }}`. 머리 라벨은 `postTimeLabel(post.recorded_at, post.meal_tag)`. 문서 주석의 "같은 사람·같은 끼니"를 "그 사람의 그날 사진"으로.
- [ ] **Step 3: 삭제** — `git rm -r src/widgets/slot-board src/widgets/slot-chips`. board-header 주석의 SlotChips 언급을 "시간 띠"로.
- [ ] **Step 4: 확인** — `pnpm exec tsc --noEmit` 에 board/post-detail 오류 없음
- [ ] **Step 5: 커밋** — `git commit -am "feat(board): 끼니 보드를 시간 띠로 교체"`

---

### Task 7: 태그 고르기 컴포넌트 + 올리기

**Files:**
- Rename/Modify: `src/entities/post/ui/MealSlotChips.tsx` → `MealTagPicker.tsx`
- Modify: `src/shared/ui/TimeField.tsx`, `src/features/upload/ui/ShotEditor.tsx`, `src/app/upload.tsx`, `src/shared/lib/board-href.ts`

- [ ] **Step 1: `MealTagPicker`** — `git mv`, 기본 끼니 칩 넷을 지운다. 값 `value: string | null`, `onChange: (tag: string | null) => void`.
  - 평소: 값이 없으면 `＋ 태그` 칩, 있으면 `야식 ✎` 칩(누르면 고쳐 쓰기).
  - 입력 중: 기존 입력 칸·글자 수·붙이기·최근 칩·취소 그대로, 값이 있으면 「태그 빼기」(`onChange(null)`)를 취소 옆에.
  - `apply`는 `parseMealTag` 결과 `result.tag`로 `onChange`.
- [ ] **Step 2: `TimeField` 어두운 모양** — `variant?: 'onLight' | 'onDark'` (기본 onLight). onDark: 라벨 `text-white/65`, 숫자 `text-white`, 포커스 배경 `bg-white/10`, 오류 `text-primary-300`, 버튼 색 `#FFA56A`/꺼짐 `rgba(255,255,255,0.3)`.
- [ ] **Step 3: `ShotEditor`** — props `slot/onSlotChange` → `tag/onTagChange/recentTags`, `time/originalTime/maxTime/onTimeChange(hhmm|null)`. 끼니 알약과 끼니 `DarkSheet`를 지우고 첫 줄을:

```tsx
<TimeField label="시각" value={time} original={originalTime} max={maxTime} current={maxTime}
  onChange={onTimeChange} disabled={sending} variant="onDark" />
<MealTagPicker value={tag} onChange={onTagChange} recentTags={recentTags} disabled={sending} />
```
- [ ] **Step 4: `upload.tsx`** — `meal` state → `tag` (`search.restoreTag ?? null`), `RestoreParams.restoreMeal` → `restoreTag`, `defaultSlotForHour` 사용 제거. 시각: `const [time, setTime] = useState(hhmmFromDate(capturedAt))`, `const [timeValid, setTimeValid] = useState(true)`, `acceptShot`에서 `setTime(hhmmFromDate(takenAt))`. 보낼 때 `recordedAt = recordedAtOnSameDay(capturedAt.toISOString(), time, now)`. `canSend`에 `timeValid` 추가. `createPostToGroups({ …, tag })`, `router.replace(boardHref(destination))`.
- [ ] **Step 5: `board-href.ts`** — `extra?: { date?: string }`만 남긴다.
- [ ] **Step 6: 확인** — `pnpm exec tsc --noEmit` 에 upload 쪽 오류 없음
- [ ] **Step 7: 커밋** — `git commit -am "feat(upload): 끼니 대신 시각 입력과 선택 태그"`

---

### Task 8: 기록 편집

**Files:**
- Modify: `src/features/post-edit/ui/PostEditSheet.tsx`

- [ ] **Step 1:** `original.meal` → `original.tag = batch.tag`, state `tag`, 끼니 칩 영역을 「태그」 라벨 + `<MealTagPicker variant="onLight" value={tag} onChange={setTag} recentTags={recentTags} disabled={busy} />`로. 저장 vars `tag: tagChange(original.tag, tag)`. `slotMeal`·`mealChange` import 제거.
- [ ] **Step 2: 확인·커밋** — `pnpm exec tsc --noEmit`; `git commit -am "feat(post-edit): 끼니 칩을 빼고 태그 빼기 추가"`

---

### Task 9: 라벨 · 알림 · 정원

**Files:**
- Modify: `src/app/(app)/profile.tsx`, `src/features/calendar/ui/DayTimeline.tsx`, `src/features/notifications/lib/push-url.ts` (+test), `src/features/notifications/ui/NotificationDeepLinks.tsx`, `src/features/group/lib/join-error.ts`, `src/features/group/ui/GroupSettingsSheet.tsx`

- [ ] **Step 1: 라벨** — profile의 `mealTimeLabel(post.recorded_at, mealOf(post))` 두 곳 → `postTimeLabel(post.recorded_at, post.meal_tag)`; `DetailPost`에서 `meal_slot` 필드 삭제. DayTimeline은 `mealOf/mealLabel` 대신 `post.meal_tag`가 있으면 태그 글자, 접근성 라벨은 `postTimeLabel(...)`.
- [ ] **Step 2: 알림** — `PushLinkParams`에서 `slot`·`tag` 삭제, `normalizePushTarget` 반환 `{ group, date }`. 테스트에서 slot·tag·meal 기대값 삭제(날짜 폴백 테스트는 유지). `NotificationDeepLinks`는 `boardHref(target.group, { date: target.date })`.
- [ ] **Step 3: 정원** — `MAX_MEMBERS = 4` (주석: 시간 띠 4열, 서버 `GROUP_FULL`과 같아야 함). 설정 시트 수락 버튼 `disabled={pending.has(req.id) || members.length >= MAX_MEMBERS}`, 정원이면 요청 목록 위에 `방은 ${MAX_MEMBERS}명까지예요` 한 줄.
- [ ] **Step 4: 확인** — `pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm lint` → 모두 통과
- [ ] **Step 5: 커밋** — `git commit -am "feat: 끼니 라벨·알림 끼니 제거, 방 정원 4명"`

---

### Task 10: 시뮬레이터 확인 (로컬 서버)

- [ ] **Step 1:** 로컬 Supabase에 예시 방(4명: 나·민지·준호·서연)과 오늘·어제 기록을 넣는다 — 가까운 시각(12:20·12:31), 긴 빈 구간, 태그(디저트·회식), 서연은 오늘 없음. 대체 이미지는 `docs/readme/` 스크린샷용으로 만든 그림을 재사용.
- [ ] **Step 2:** `.env.local`을 로컬 값으로 바꾸고 Expo Go(iOS 18.3 iPhone 16 Pro)로 확인: 처음 위치(오늘=최근), 세로 스크롤, 좌우 날짜 넘기기, 사진 탭 → 상세가 누른 사진부터, 올리기(시각 고치기·태그)→ 보드가 새 사진으로 스크롤, 편집(태그 빼기 → DB에서 `meal_tag` null 확인), 5번째 가입 시 정원 문구.
- [ ] **Step 3:** 확인이 끝나면 `.env.local`을 운영 값으로 되돌리고 로컬 Supabase를 멈춘다.

---

### Task 11: Maestro · 문서 · 올리기

- [ ] **Step 1:** `.maestro/flows/03-board.yaml`에서 끼니 칩(`아침 .* 올림`, `저녁 .* 올림`) 단계를 지우고 `나` 머리줄이 보이는지 확인으로 바꾼다. `05-upload.yaml`의 `아침 .* 올림` 대기도 같게. 
- [ ] **Step 2:** `AGENTS.md` "백엔드와 웹앱"의 끼니 개편 문장을 "2026-10-27 시간 띠 개편으로 앱에서 끼니 칸을 없앴다. 새 기록은 `meal_slot = null`, 태그는 선택. 웹은 맞추지 않는다."로.
- [ ] **Step 3:** 웹 마이그레이션 운영 적용을 **사용자에게 확인받은 뒤** `supabase db push`(dry-run 먼저), 웹·모바일 `main` push.
- [ ] **Step 4:** 빌드 13 TestFlight (AGENTS.md 「실서버 테스트와 릴리스」 순서), iOS 27 시뮬레이터에서 Release 빌드 실행 확인.
