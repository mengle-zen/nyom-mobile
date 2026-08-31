# 시간 밴드 스트림 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정 4끼니 타일 격자 보드를 2시간 밴드 스트림으로 바꾸고, 끼니를 사용자가 쓰는 자유 태그로 만든다.

**Architecture:** 밴드는 `recorded_at`에서 파생하는 순수 함수로 계산한다(테이블 없음). 끼니 태그는 `posts.meal_slot` 컬럼에 한국어 문자열로 저장하고, 정규화 규칙을 DB 함수와 앱 순수 함수 양쪽에 같은 내용으로 두고 테스트로 고정한다. 보드는 가로 Pan 제스처(날짜) 안에 세로 ScrollView(시각순 스트림)를 중첩해, 직접 만든 축 판정 로직을 없앤다.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / NativeWind v4 / TanStack Query / vitest / Supabase(Postgres + RPC)

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-31-time-band-stream-design.md`
- 밴드 폭은 상수 `BAND_HOURS = 2`. 하드코딩 금지 — 나중에 1시간으로 바꾸는 게 상수 하나 수정이어야 한다.
- 태그 정규화 규칙: `trim` → 연속 공백을 1칸으로 → **최대 8자** 절단 → 빈 문자열은 `null`. 앱과 DB가 **같은 결과**를 내야 한다.
- 태그는 **1개**. 복수 태그는 범위 밖.
- 밴드 헤더에 **이름을 붙이지 않는다.** 「12–14시」처럼 시각 범위만. (태그 자동값과 경계가 달라 모순으로 읽히기 때문)
- 통계 집계는 태그가 아니라 `recorded_at` 시각대에서 파생한다.
- `posts.meal_slot` **컬럼명은 바꾸지 않는다.** 의미만 「끼니 태그」로 바뀐다.
- 마이그레이션은 **`nyom`(웹) 저장소**의 `supabase/migrations/`에 쓴다. `nyom-app`에 두면 적용되지 않는다.
- 커밋 메시지는 한국어 conventional commit. 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **브랜치:** `docs/time-band-stream-spec`은 스펙·계획 **문서 전용** PR이다. 구현은 별도 브랜치에서 한다 — Task 1 시작 전에 `git checkout main && git pull && git checkout -b feat/time-band-stream`. `main` 직접 커밋 금지.
- 검증 명령: `pnpm exec vitest run` / `pnpm exec tsc --noEmit` / `pnpm lint`
- 매 태스크 끝에서 위 3개가 모두 통과해야 한다. 린트 경고는 현재 0이며 0을 유지한다.

## File Structure

### 신설 (`nyom-app`)

| 경로 | 책임 |
| --- | --- |
| `src/entities/post/time-band.ts` | 게시물 배열 → 2시간 밴드 배열. 순수 함수, 화면 무관 |
| `src/entities/post/meal-tag.ts` | 태그 정규화 · 통계 시각대 · 밴드 범위 라벨. 순수 함수 |
| `src/entities/post/recent-tags.ts` | 내 기록에서 최근 태그 상위 N개 집계. 순수 함수 |
| `src/features/post-edit/ui/MealTagField.tsx` | 태그 칩 + 최근 태그 + 자유 입력. 업로드·편집 **공용** |
| `src/widgets/meal-card/index.tsx` | 스트림 카드 1장 (아바타·시각·태그·사진·메모·리액션) |
| `src/widgets/band-header/index.tsx` | 밴드 구분선 + 「12–14시」 |
| `src/widgets/member-strip/index.tsx` | 상단 멤버 아바타 줄 (기록 수 배지 / 미기록 점선) |

### 신설 (`nyom`)

| 경로 | 책임 |
| --- | --- |
| `supabase/migrations/20260901000000_meal_tag_freeform.sql` | 제약 제거 · 값 변환 · 정규화 함수 · 트리거 · RPC/트리거 문구 수정 |

### 삭제 (Task 14에서 한 번에)

`src/widgets/slot-board/`, `src/widgets/slot-chips/`, `src/widgets/meal-tile/`,
`src/entities/post/slot-progress.ts(+test)`, `src/features/board-nav/`,
`src/entities/post/ui/MealSlotChips.tsx`

---

## Task 1: 시간 밴드 순수 함수

**Files:**
- Create: `src/entities/post/time-band.ts`
- Test: `src/entities/post/time-band.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `BAND_HOURS: 2`
  - `type BandItem<P> = { startHour: number; posts: P[] }`
  - `groupByTimeBand<P extends BandablePost>(posts: P[], bandHours?: number): BandItem<P>[]`
  - `type BandablePost = { recorded_at?: string; created_at: string }`

- [ ] **Step 1: Write the failing test**

`src/entities/post/time-band.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupByTimeBand, BAND_HOURS } from './time-band'

/** 로컬 시각으로 ISO를 만든다 — 밴드는 로컬 시각 기준이다. */
const at = (h: number, m = 0) => new Date(2026, 7, 31, h, m, 0).toISOString()

const post = (id: string, h: number, m = 0) => ({
  id,
  recorded_at: at(h, m),
  created_at: at(h, m),
})

describe('groupByTimeBand', () => {
  it('밴드 폭 기본값은 2시간이다', () => {
    expect(BAND_HOURS).toBe(2)
  })

  it('같은 2시간 구간이면 한 밴드로 묶는다', () => {
    const bands = groupByTimeBand([post('a', 12, 40), post('b', 13, 5)])
    expect(bands).toHaveLength(1)
    expect(bands[0].startHour).toBe(12)
    expect(bands[0].posts.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('경계값 — 14:00은 다음 밴드다', () => {
    const bands = groupByTimeBand([post('a', 13, 59), post('b', 14, 0)])
    expect(bands.map((b) => b.startHour)).toEqual([12, 14])
  })

  it('기록 없는 밴드는 아예 나타나지 않는다', () => {
    const bands = groupByTimeBand([post('a', 8), post('b', 20)])
    expect(bands.map((b) => b.startHour)).toEqual([8, 20])
  })

  it('밴드는 시각 오름차순, 밴드 안도 시각 오름차순', () => {
    const bands = groupByTimeBand([post('late', 20), post('b', 13, 5), post('a', 12, 40)])
    expect(bands.map((b) => b.startHour)).toEqual([12, 20])
    expect(bands[0].posts.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('같은 시각이면 created_at으로 안정 정렬한다', () => {
    const same = at(12, 0)
    const rows = [
      { id: 'second', recorded_at: same, created_at: at(12, 30) },
      { id: 'first', recorded_at: same, created_at: at(12, 10) },
    ]
    expect(groupByTimeBand(rows)[0].posts.map((p) => p.id)).toEqual(['first', 'second'])
  })

  it('recorded_at이 없으면 created_at을 쓴다', () => {
    const bands = groupByTimeBand([{ id: 'a', created_at: at(9, 0) }])
    expect(bands[0].startHour).toBe(8)
  })

  it('0시와 23시는 각각 첫·마지막 밴드다 (자정을 넘기지 않는다)', () => {
    const bands = groupByTimeBand([post('mid', 0, 30), post('night', 23, 30)])
    expect(bands.map((b) => b.startHour)).toEqual([0, 22])
  })

  it('빈 입력은 빈 배열', () => {
    expect(groupByTimeBand([])).toEqual([])
  })

  it('밴드 폭을 1시간으로 주면 12:40과 13:05가 갈라진다', () => {
    const bands = groupByTimeBand([post('a', 12, 40), post('b', 13, 5)], 1)
    expect(bands.map((b) => b.startHour)).toEqual([12, 13])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/entities/post/time-band.test.ts`
Expected: FAIL — `Failed to resolve import "./time-band"`

- [ ] **Step 3: Write minimal implementation**

`src/entities/post/time-band.ts`:

```ts
/**
 * 스트림을 묶는 시간 밴드 폭(시간). 2시간인 이유는 1시간이면 12:40과 13:05가
 * 갈라지는데, 그 둘은 사실상 같은 점심이기 때문이다. 밴드의 존재 이유가
 * 「같은 끼니를 나란히 보기」라 1시간은 그 목적을 못 이룬다.
 * 바꿀 때는 이 상수만 고친다 — 파생값이라 데이터 이관이 없다.
 */
export const BAND_HOURS = 2

export type BandablePost = {
  recorded_at?: string
  created_at: string
}

export type BandItem<P> = {
  /** 밴드 시작 시(0, 2, 4 … 22). 헤더 라벨은 bandRangeLabel이 만든다 */
  startHour: number
  posts: P[]
}

/** 정렬·버킷 계산의 기준 시각. recorded_at이 없으면 created_at. */
function keyOf(post: BandablePost): string {
  return post.recorded_at ?? post.created_at
}

/**
 * 게시물을 밴드로 묶는다. 기록이 없는 밴드는 만들지 않는다.
 *
 * 밴드는 저장하지 않고 매번 파생한다 — 참조 테이블을 두면 「경계를 누가 정하나」가
 * 생기지만, 시계가 정하면 그 논의 자체가 없다.
 */
export function groupByTimeBand<P extends BandablePost>(
  posts: P[],
  bandHours: number = BAND_HOURS,
): BandItem<P>[] {
  // 같은 시각일 때 순서가 흔들리면 스크롤 중 카드가 바뀌어 보인다.
  // recorded_at → created_at 2단 비교로 완전 결정적으로 둔다.
  const sorted = [...posts].sort(
    (a, b) => keyOf(a).localeCompare(keyOf(b)) || a.created_at.localeCompare(b.created_at),
  )

  const bands: BandItem<P>[] = []
  for (const post of sorted) {
    const hour = new Date(keyOf(post)).getHours()
    const startHour = Math.floor(hour / bandHours) * bandHours
    const last = bands[bands.length - 1]
    if (last && last.startHour === startHour) last.posts.push(post)
    else bands.push({ startHour, posts: [post] })
  }
  return bands
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/entities/post/time-band.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm exec tsc --noEmit
git add src/entities/post/time-band.ts src/entities/post/time-band.test.ts
git commit -m "$(cat <<'EOF'
feat(post): 시간 밴드 묶음 순수 로직

밴드는 recorded_at에서 파생한다 — 참조 테이블을 두면 「경계를 누가 정하나」가
생기지만 시계가 정하면 그 논의가 없다. 폭은 BAND_HOURS 상수 하나로 둬서
1시간으로 바꾸는 게 숫자 수정이 되게 했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 태그 정규화 · 통계 시각대 · 밴드 라벨

**Files:**
- Create: `src/entities/post/meal-tag.ts`
- Test: `src/entities/post/meal-tag.test.ts`

**Interfaces:**
- Consumes: `BAND_HOURS` from `./time-band`
- Produces:
  - `MEAL_TAG_MAX_LENGTH: 8`
  - `normalizeMealTag(input: string | null | undefined): string | null`
  - `bandRangeLabel(startHour: number, bandHours?: number): string`
  - `type TimeBucket = '새벽' | '아침' | '점심' | '오후' | '저녁' | '밤'`
  - `timeBucketOf(date: Date): TimeBucket`
  - `TAG_SEEDS: readonly string[]`

- [ ] **Step 1: Write the failing test**

`src/entities/post/meal-tag.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  normalizeMealTag,
  bandRangeLabel,
  timeBucketOf,
  MEAL_TAG_MAX_LENGTH,
  TAG_SEEDS,
} from './meal-tag'

describe('normalizeMealTag', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeMealTag('  점심  ')).toBe('점심')
  })

  it('연속 공백을 1칸으로 접는다', () => {
    expect(normalizeMealTag('늦은   점심')).toBe('늦은 점심')
  })

  it('탭·개행도 공백으로 본다', () => {
    expect(normalizeMealTag('늦은\t\n점심')).toBe('늦은 점심')
  })

  it(`${MEAL_TAG_MAX_LENGTH}자를 넘으면 자른다`, () => {
    expect(normalizeMealTag('가나다라마바사아자차')).toBe('가나다라마바사아')
  })

  it('공백만 있으면 null', () => {
    expect(normalizeMealTag('   ')).toBeNull()
  })

  it('빈 문자열·null·undefined는 null', () => {
    expect(normalizeMealTag('')).toBeNull()
    expect(normalizeMealTag(null)).toBeNull()
    expect(normalizeMealTag(undefined)).toBeNull()
  })

  it('이모지가 섞여도 길이를 세고 자른다', () => {
    // 코드포인트 단위로 세므로 이모지가 반쪽으로 잘리지 않는다
    expect(normalizeMealTag('🍜🍜🍜🍜🍜🍜🍜🍜🍜')).toBe('🍜🍜🍜🍜🍜🍜🍜🍜')
  })

  it('이미 정규화된 값은 그대로', () => {
    expect(normalizeMealTag('해장')).toBe('해장')
  })
})

describe('bandRangeLabel', () => {
  it('밴드 시작시로 시각 범위를 만든다 — 이름은 붙이지 않는다', () => {
    expect(bandRangeLabel(12)).toBe('12–14시')
    expect(bandRangeLabel(8)).toBe('8–10시')
    expect(bandRangeLabel(0)).toBe('0–2시')
  })

  it('마지막 밴드는 24시로 끝난다', () => {
    expect(bandRangeLabel(22)).toBe('22–24시')
  })

  it('밴드 폭 1시간이면 단일 시각 범위', () => {
    expect(bandRangeLabel(13, 1)).toBe('13–14시')
  })
})

describe('timeBucketOf', () => {
  const at = (h: number) => new Date(2026, 7, 31, h, 0, 0)

  it('6구간 경계', () => {
    expect(timeBucketOf(at(0))).toBe('새벽')
    expect(timeBucketOf(at(4))).toBe('새벽')
    expect(timeBucketOf(at(5))).toBe('아침')
    expect(timeBucketOf(at(10))).toBe('아침')
    expect(timeBucketOf(at(11))).toBe('점심')
    expect(timeBucketOf(at(13))).toBe('점심')
    expect(timeBucketOf(at(14))).toBe('오후')
    expect(timeBucketOf(at(16))).toBe('오후')
    expect(timeBucketOf(at(17))).toBe('저녁')
    expect(timeBucketOf(at(20))).toBe('저녁')
    expect(timeBucketOf(at(21))).toBe('밤')
    expect(timeBucketOf(at(23))).toBe('밤')
  })
})

describe('TAG_SEEDS', () => {
  it('기록이 없는 신규 사용자에게 보여줄 씨앗 목록', () => {
    expect(TAG_SEEDS).toEqual(['아침', '점심', '저녁', '야식', '간식'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/entities/post/meal-tag.test.ts`
Expected: FAIL — `Failed to resolve import "./meal-tag"`

- [ ] **Step 3: Write minimal implementation**

`src/entities/post/meal-tag.ts`:

```ts
import { BAND_HOURS } from './time-band'

/**
 * 태그 최대 길이.
 *
 * 짧은 이유가 UI 때문만은 아니다 — 이 값이 그대로 **다른 멤버의 푸시 알림 본문**에
 * 실린다(notify_group_on_post가 「효린님이 점심을 남겼어요」를 만든다). 길이 제한이
 * 방어선이라 DB 트리거에도 같은 규칙이 걸려 있다.
 */
export const MEAL_TAG_MAX_LENGTH = 8

/** 기록이 없는 신규 사용자에게 최근 태그 대신 보여줄 목록. */
export const TAG_SEEDS = ['아침', '점심', '저녁', '야식', '간식'] as const

/**
 * 끼니 태그 정규화. **DB의 `public.normalize_meal_tag`와 결과가 같아야 한다** —
 * 어긋나면 앱에서 8자로 보이던 태그가 DB에서 다른 값이 되어 조용히 갈라진다.
 *
 * 규칙: trim → 연속 공백 1칸 → 8자 절단 → 빈 문자열은 null.
 * 절단은 코드포인트 단위다(`[...s]`) — UTF-16 인덱스로 자르면 이모지가 반쪽이 된다.
 */
export function normalizeMealTag(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null
  const collapsed = input.trim().replace(/\s+/g, ' ')
  if (collapsed === '') return null
  return [...collapsed].slice(0, MEAL_TAG_MAX_LENGTH).join('')
}

/**
 * 밴드 헤더 라벨 — 「12–14시」처럼 **시각 범위만**.
 *
 * 이름(「점심」·「오후」)을 붙이지 않는다. 붙이면 15:20 기록이 태그는 「점심」인데
 * 헤더는 「오후」가 되어 사용자에게 모순으로 읽힌다. 밴드·태그 자동값·통계 시각대는
 * 경계가 서로 다르고, 그건 의도된 것이다(스펙 「세 가지 시간 구간」 참고).
 */
export function bandRangeLabel(startHour: number, bandHours: number = BAND_HOURS): string {
  return `${startHour}–${startHour + bandHours}시`
}

/** 통계 집계용 시각대. 태그와 무관하게 `recorded_at`에서만 나온다. */
export type TimeBucket = '새벽' | '아침' | '점심' | '오후' | '저녁' | '밤'

/**
 * 통계 버킷. 자유 태그는 집계 키로 쓸 수 없어서(「간식」과 「간식 」이 다른 값)
 * 돌아보기·프로필 통계는 이 6구간으로 센다.
 */
export function timeBucketOf(date: Date): TimeBucket {
  const h = date.getHours()
  if (h < 5) return '새벽'
  if (h < 11) return '아침'
  if (h < 14) return '점심'
  if (h < 17) return '오후'
  if (h < 21) return '저녁'
  return '밤'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/entities/post/meal-tag.test.ts`
Expected: PASS — 15 tests

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm exec tsc --noEmit
git add src/entities/post/meal-tag.ts src/entities/post/meal-tag.test.ts
git commit -m "$(cat <<'EOF'
feat(post): 끼니 태그 정규화·통계 시각대·밴드 라벨

정규화는 DB의 normalize_meal_tag와 같은 결과를 내야 한다. 절단을 코드포인트
단위로 하는 건 UTF-16 인덱스로 자르면 이모지가 반쪽이 되기 때문이다.

밴드 라벨에 이름을 붙이지 않는다 — 15:20 기록이 태그는 「점심」, 헤더는 「오후」가
되는 모순이 생긴다. 밴드·태그 자동값·통계 시각대는 경계가 일부러 다르다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 최근 태그 집계

**Files:**
- Create: `src/entities/post/recent-tags.ts`
- Test: `src/entities/post/recent-tags.test.ts`

**Interfaces:**
- Consumes: `TAG_SEEDS` from `./meal-tag`
- Produces: `recentTags(rows: TaggedRow[], limit?: number): string[]`, `type TaggedRow = { meal_slot: string | null; recorded_at?: string; created_at: string }`, `RECENT_TAGS_LIMIT: 6`

- [ ] **Step 1: Write the failing test**

`src/entities/post/recent-tags.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { recentTags, RECENT_TAGS_LIMIT } from './recent-tags'
import { TAG_SEEDS } from './meal-tag'

const row = (tag: string | null, iso: string) => ({
  meal_slot: tag,
  recorded_at: iso,
  created_at: iso,
})

describe('recentTags', () => {
  it('빈도 내림차순으로 정렬한다', () => {
    const rows = [
      row('점심', '2026-08-31T03:00:00.000Z'),
      row('점심', '2026-08-30T03:00:00.000Z'),
      row('야식', '2026-08-29T03:00:00.000Z'),
    ]
    expect(recentTags(rows)).toEqual(['점심', '야식'])
  })

  it('빈도가 같으면 최신순', () => {
    const rows = [
      row('해장', '2026-08-29T03:00:00.000Z'),
      row('간식', '2026-08-31T03:00:00.000Z'),
    ]
    expect(recentTags(rows)).toEqual(['간식', '해장'])
  })

  it(`상위 ${RECENT_TAGS_LIMIT}개까지만`, () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((t, i) =>
      row(t, `2026-08-${String(20 + i).padStart(2, '0')}T03:00:00.000Z`),
    )
    expect(recentTags(rows)).toHaveLength(RECENT_TAGS_LIMIT)
  })

  it('limit을 직접 줄 수 있다', () => {
    const rows = [
      row('점심', '2026-08-31T03:00:00.000Z'),
      row('야식', '2026-08-30T03:00:00.000Z'),
    ]
    expect(recentTags(rows, 1)).toEqual(['점심'])
  })

  it('태그 없는 행(null)은 세지 않는다', () => {
    const rows = [row(null, '2026-08-31T03:00:00.000Z'), row('점심', '2026-08-30T03:00:00.000Z')]
    expect(recentTags(rows)).toEqual(['점심'])
  })

  it('정규화되지 않은 값도 접어서 센다', () => {
    const rows = [
      row(' 점심 ', '2026-08-31T03:00:00.000Z'),
      row('점심', '2026-08-30T03:00:00.000Z'),
    ]
    expect(recentTags(rows)).toEqual(['점심'])
  })

  it('기록이 없으면 씨앗 목록을 돌려준다', () => {
    expect(recentTags([])).toEqual([...TAG_SEEDS])
  })

  it('태그가 하나도 없는 기록만 있어도 씨앗 목록', () => {
    expect(recentTags([row(null, '2026-08-31T03:00:00.000Z')])).toEqual([...TAG_SEEDS])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/entities/post/recent-tags.test.ts`
Expected: FAIL — `Failed to resolve import "./recent-tags"`

- [ ] **Step 3: Write minimal implementation**

`src/entities/post/recent-tags.ts`:

```ts
import { normalizeMealTag, TAG_SEEDS } from './meal-tag'

/** 태그 칩으로 보여줄 최대 개수. 한 줄에 들어가는 수를 넘기지 않는다. */
export const RECENT_TAGS_LIMIT = 6

export type TaggedRow = {
  meal_slot: string | null
  recorded_at?: string
  created_at: string
}

/**
 * 내 기록에서 자주·최근에 쓴 태그를 뽑는다.
 *
 * 태그 관리 화면을 만들지 않는 이유가 이것이다 — 사용자가 쓴 것이 곧 목록이라
 * 따로 관리할 게 없다. 빈도를 1순위로 두는 건 「점심」처럼 매일 쓰는 태그가
 * 한 번 써본 「해장」보다 위에 있어야 원탭 재사용이 성립하기 때문이다.
 *
 * 기록이 없는 신규 사용자에게는 씨앗 목록을 준다. 빈 칩 줄을 보여주면
 * 「직접 입력」밖에 길이 없어 첫 기록의 비용이 올라간다.
 */
export function recentTags(rows: TaggedRow[], limit: number = RECENT_TAGS_LIMIT): string[] {
  const stat = new Map<string, { count: number; latest: string }>()

  for (const r of rows) {
    const tag = normalizeMealTag(r.meal_slot)
    if (tag === null) continue
    const when = r.recorded_at ?? r.created_at
    const prev = stat.get(tag)
    if (prev) {
      prev.count += 1
      if (when > prev.latest) prev.latest = when
    } else {
      stat.set(tag, { count: 1, latest: when })
    }
  }

  if (stat.size === 0) return [...TAG_SEEDS]

  return Array.from(stat, ([tag, s]) => ({ tag, ...s }))
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
    .slice(0, limit)
    .map((s) => s.tag)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/entities/post/recent-tags.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm exec tsc --noEmit
git add src/entities/post/recent-tags.ts src/entities/post/recent-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(post): 내 기록에서 최근 끼니 태그 집계

태그 관리 화면을 만들지 않는다 — 사용자가 쓴 것이 곧 목록이다. 빈도를 1순위로
두는 건 매일 쓰는 「점심」이 한 번 써본 「해장」보다 위에 있어야 원탭 재사용이
성립하기 때문이다. 기록이 없으면 씨앗 목록을 준다(빈 칩 줄은 첫 기록 비용을 올린다).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: DB 마이그레이션 (`nyom` 저장소)

**Files:**
- Create: `~/github/nyom/supabase/migrations/20260901000000_meal_tag_freeform.sql`
- Reference: `~/github/nyom/supabase/migrations/20260828050000_post_batch_meal_slot.sql` (현재 `update_post_batch` 정의)
- Reference: `~/github/nyom/supabase/migrations/20260828020000_post_edit_after_upload.sql` (현재 `notify_group_on_post` 정의)

**Interfaces:**
- Consumes: 없음 (앱 코드와 독립)
- Produces: `public.normalize_meal_tag(text) returns text`, `posts_normalize_meal_tag` 트리거. `update_post_batch`의 `p_meal_slot` 검증이 정규화로 교체됨. 푸시 딥링크 파라미터가 `&slot=`에서 `&post=`로 바뀜.

> **주의:** 이 태스크는 **다른 저장소**에서 작업한다. `nyom-app`에 마이그레이션을 두면 적용되지 않고 방치된다.

- [ ] **Step 1: 현재 함수 정의를 읽는다**

```bash
cd ~/github/nyom
sed -n '1,140p' supabase/migrations/20260828050000_post_batch_meal_slot.sql
sed -n '183,280p' supabase/migrations/20260828020000_post_edit_after_upload.sql
```

기대: `update_post_batch`가 `p_meal_slot not in ('breakfast','lunch','dinner','late_snack')`로 검증하고,
`notify_group_on_post`가 `case s.meal_slot when 'breakfast' then '아침' …`으로 한국어를 만들고
`'&slot=' || rep.meal_slot`으로 딥링크를 만드는 것을 확인한다.

- [ ] **Step 2: 브랜치를 만든다**

```bash
cd ~/github/nyom
git checkout -b feat/meal-tag-freeform
```

- [ ] **Step 3: 마이그레이션 파일을 쓴다**

`~/github/nyom/supabase/migrations/20260901000000_meal_tag_freeform.sql`:

```sql
-- Nyom — 끼니를 고정 4값에서 자유 태그로
--
-- 배경: 보드가 「슬롯 × 멤버 타일」에서 「2시간 밴드 스트림」으로 바뀐다.
--   칸이 사라지므로 meal_slot은 배치를 정하는 키가 아니라 사용자가 쓰는 이름이 된다.
--   스펙: nyom-app/docs/superpowers/specs/2026-08-31-time-band-stream-design.md
--
-- ⚠️ 값 변환은 되돌릴 수 없다. 'breakfast' → '아침' 이후에는 그 '아침'이 원래
--   breakfast였는지 사용자가 직접 쓴 것인지 구분할 수 없다. 롤백 계획은
--   「제약을 다시 걸지 않는다」이고, 문제가 생기면 앱을 이전 버전으로 되돌린다.
--
-- ⚠️ 이 마이그레이션은 구버전 앱의 끼니 표시를 깨뜨린다(MealSlotKey 유니온에
--   '아침'이 없어 라벨이 빈 문자열이 된다). 크래시는 아니고 표시 누락이며,
--   실사용자가 없는 시점을 전제로 한 순서다.

-- ── 1. 정규화 함수 ─────────────────────────────────────────
-- 앱의 normalizeMealTag()와 **같은 결과**를 내야 한다. 어긋나면 앱에서 8자로 보이던
-- 태그가 DB에서 다른 값이 되어 조용히 갈라진다.
-- 규칙: trim → 연속 공백 1칸 → 8자 절단 → 빈 문자열은 null.
-- left()는 문자(코드포인트) 단위로 세므로 이모지가 반쪽으로 잘리지 않는다.
create or replace function public.normalize_meal_tag(p_input text)
returns text
language sql
immutable
as $$
  select nullif(left(regexp_replace(btrim(p_input), '\s+', ' ', 'g'), 8), '')
$$;

comment on function public.normalize_meal_tag(text) is
  '끼니 태그 정규화. 앱의 normalizeMealTag()와 결과가 같아야 한다.';

-- ── 2. 제약 제거와 기존 값 변환 ────────────────────────────
alter table public.posts drop constraint if exists posts_meal_slot_check;

update public.posts set meal_slot = case meal_slot
  when 'breakfast'  then '아침'
  when 'lunch'      then '점심'
  when 'dinner'     then '저녁'
  when 'late_snack' then '야식'
  else meal_slot
end
where meal_slot in ('breakfast', 'lunch', 'dinner', 'late_snack');

comment on column public.posts.meal_slot is
  '끼니 태그(사용자 자유 입력, 최대 8자). 컬럼명은 과거 「슬롯」 모델의 잔재다.';

-- ── 3. 게시 경로 방어선 ────────────────────────────────────
-- 앱이 RPC를 거치지 않고 직접 insert하는 경로가 있다(createPostToGroups).
-- 앱만 믿으면 우회한 값이 그대로 들어오고, 그 값은 다른 멤버의 푸시 알림
-- 본문에 실린다. 정규화를 DB에서 강제한다.
create or replace function public.posts_normalize_meal_tag()
returns trigger
language plpgsql
as $$
begin
  new.meal_slot := public.normalize_meal_tag(new.meal_slot);
  return new;
end;
$$;

drop trigger if exists posts_normalize_meal_tag on public.posts;
create trigger posts_normalize_meal_tag
  before insert or update of meal_slot on public.posts
  for each row execute function public.posts_normalize_meal_tag();
```

- [ ] **Step 4: `update_post_batch`의 검증을 정규화로 교체한다**

같은 파일에 이어서 쓴다. **`20260828050000_post_batch_meal_slot.sql`의 함수 본문을 그대로 복사해 오고, 아래 두 곳만 바꾼다.** 시그니처(5-arg)는 유지한다 — 4-arg 오버로드가 남으면 호출이 모호해진다.

```sql
-- ── 4. update_post_batch — 고정값 검증을 정규화로 교체 ──────
-- 바뀌는 곳은 두 군데뿐이다:
--   (a) p_meal_slot not in ('breakfast', …) 검증 블록을 삭제
--   (b) v_slot := coalesce(p_meal_slot, v_rep.meal_slot)
--       → v_slot := coalesce(public.normalize_meal_tag(p_meal_slot), v_rep.meal_slot)
-- p_meal_slot이 null = 「태그 변경 없음」이라는 기존 의미는 유지한다.
--
-- 나머지 본문(권한 검사·그룹 diff·insert/delete)은
-- 20260828050000_post_batch_meal_slot.sql에서 그대로 옮겨 온다.
```

- [ ] **Step 5: `notify_group_on_post`의 문구와 딥링크를 고친다**

```sql
-- ── 5. notify_group_on_post — 한국어 매핑 삭제, 딥링크 교체 ──
-- (a) case s.meal_slot when 'breakfast' then '아침' … end → s.meal_slot 그대로
--     (이제 값 자체가 한국어다. 8자 제한과 trim이 트리거에서 이미 걸렸다)
-- (b) '&slot=' || rep.meal_slot → '&post=' || rep.post_id
--     슬롯 인덱스로 보드 위치를 잡던 방식이 스트림에서는 의미가 없다.
--     알림을 누르면 그 카드로 스크롤한다.
-- (c) group by에서 slot_ko를 정리한다.
--
-- 본문은 20260828020000_post_edit_after_upload.sql의 정의에서 옮겨 온다.
```

- [ ] **Step 6: 로컬 스택에 적용해 검증한다**

```bash
cd ~/github/nyom
pnpm dlx supabase start
pnpm dlx supabase db reset
```

Expected: 마이그레이션 전체가 에러 없이 적용된다.

- [ ] **Step 7: 정규화가 앱과 같은 결과를 내는지 SQL로 확인한다**

앱 테스트(Task 2)와 **같은 입력**으로 검증한다. 두 구현이 어긋나면 여기서 잡힌다.

```bash
cd ~/github/nyom
pnpm dlx supabase db query "
  select
    public.normalize_meal_tag('  점심  ')            as trimmed,
    public.normalize_meal_tag('늦은   점심')          as collapsed,
    public.normalize_meal_tag(E'늦은\t\n점심')        as whitespace,
    public.normalize_meal_tag('가나다라마바사아자차') as truncated,
    public.normalize_meal_tag('   ')                  as blank,
    public.normalize_meal_tag('')                     as empty,
    public.normalize_meal_tag(null)                   as nulled,
    public.normalize_meal_tag('🍜🍜🍜🍜🍜🍜🍜🍜🍜')  as emoji;
"
```

Expected:
| 컬럼 | 값 |
| --- | --- |
| trimmed | `점심` |
| collapsed | `늦은 점심` |
| whitespace | `늦은 점심` |
| truncated | `가나다라마바사아` |
| blank | `(null)` |
| empty | `(null)` |
| nulled | `(null)` |
| emoji | `🍜🍜🍜🍜🍜🍜🍜🍜` |

**하나라도 다르면 앱의 `normalizeMealTag`와 SQL 중 어느 쪽이 틀렸는지 판단해 맞춘다.** 그냥 넘기면 안 된다.

- [ ] **Step 8: 트리거가 우회 insert를 막는지 확인한다**

```bash
cd ~/github/nyom
pnpm dlx supabase db query "
  insert into public.posts (user_id, image_url, meal_slot, group_id)
  select user_id, 'test/x.jpg', '  아주긴태그가여기있다  ', group_id
  from public.posts limit 1
  returning meal_slot;
"
```

Expected: `아주긴태그가여기` (8자로 절단, 공백 제거). 그 뒤 정리:

```bash
pnpm dlx supabase db query "delete from public.posts where image_url = 'test/x.jpg';"
```

- [ ] **Step 9: 커밋하고 PR을 올린다**

```bash
cd ~/github/nyom
git add supabase/migrations/20260901000000_meal_tag_freeform.sql
git commit -m "$(cat <<'EOF'
feat(db): 끼니를 고정 4값에서 자유 태그로

보드가 슬롯 격자에서 시간 밴드 스트림으로 바뀌면서 meal_slot이 배치 키가 아니라
사용자가 쓰는 이름이 된다. check 제약을 없애고 기존 값을 한국어로 변환한다.

값 변환은 되돌릴 수 없다 — '아침'이 원래 breakfast였는지 사용자가 쓴 것인지
구분할 수 없다. 실사용자가 없는 시점을 전제로 한 순서다.

정규화를 트리거로 강제하는 건 앱이 RPC를 거치지 않고 직접 insert하는 경로가 있고,
그 값이 다른 멤버의 푸시 알림 본문에 그대로 실리기 때문이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
gh pr create --title "feat(db): 끼니를 고정 4값에서 자유 태그로" --body "$(cat <<'EOF'
`nyom-app`의 보드 재설계(시간 밴드 스트림)에 필요한 백엔드 변경입니다.

스펙: `nyom-app/docs/superpowers/specs/2026-08-31-time-band-stream-design.md`

## 변경

- `posts_meal_slot_check` 제약 제거
- 기존 값 변환 (`breakfast` → `아침` 등) — **되돌릴 수 없음**
- `normalize_meal_tag(text)` 신설 + `posts` before insert/update 트리거
- `update_post_batch`의 고정값 검증을 정규화로 교체
- `notify_group_on_post`의 한국어 매핑 삭제, 딥링크 `&slot=` → `&post=`

## 확인한 것

- 로컬 스택 `db reset` 통과
- `normalize_meal_tag`가 앱 `normalizeMealTag`와 같은 결과 (8케이스 대조)
- 트리거가 RPC 우회 insert를 정규화하는 것

## 주의

이 PR을 머지하면 **웹앱과 구버전 모바일 앱의 끼니 표시가 빈 문자열이 됩니다**
(`MealSlotKey` 유니온에 「아침」이 없음). 웹앱은 사용하지 않기로 했고,
모바일은 이어지는 앱 배포로 해소됩니다.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 5: 타입을 자유 태그로 넓히기 (컴파일 유지)

**목적:** `MealSlotKey`를 `string` 별칭으로 바꿔 **기존 코드가 그대로 컴파일되게** 한 뒤, 이후 태스크에서 소비자를 하나씩 옮긴다. 이 태스크만으로 앱 동작은 바뀌지 않는다.

**Files:**
- Modify: `src/entities/post/board.ts` (타입 정의부)
- Modify: `src/types/database.ts` (`meal_slot` 타입)
- Modify: `src/entities/post/index.ts` (배럴에 신규 모듈 추가)
- Test: 기존 테스트가 계속 통과하는 것으로 검증

**Interfaces:**
- Consumes: Task 1~3의 모듈
- Produces: `type MealTag = string`, `MealSlotKey = MealTag`(deprecated 별칭). 배럴에서 `groupByTimeBand`·`BAND_HOURS`·`BandItem`·`normalizeMealTag`·`bandRangeLabel`·`timeBucketOf`·`MEAL_TAG_MAX_LENGTH`·`TAG_SEEDS`·`recentTags`·`RECENT_TAGS_LIMIT` 노출.

- [ ] **Step 1: `board.ts`의 타입을 넓힌다**

`src/entities/post/board.ts` 상단의

```ts
export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'late_snack'
```

를 다음으로 교체한다:

```ts
/** 끼니 태그 — 사용자 자유 입력 문자열. 정규화는 normalizeMealTag가 맡는다. */
export type MealTag = string

/**
 * @deprecated `MealTag`를 쓸 것. 고정 4값이던 시절의 이름이라 남겨 둔 별칭이고,
 * 소비자를 모두 옮긴 뒤 삭제한다(Task 14).
 */
export type MealSlotKey = MealTag
```

`MEAL_SLOTS`·`slotLabel`·`buildSlotBoard`는 **이 태스크에서 건드리지 않는다** — Task 14에서 삭제한다.

- [ ] **Step 2: `defaultSlotForHour`의 반환값을 한국어 라벨로 바꾼다**

`src/entities/post/board.ts`의 `defaultSlotForHour`를 교체한다. 시그니처는 `(hour: number) => MealTag`로 넓어지고 반환값이 키에서 라벨로 바뀐다:

```ts
/**
 * 섭취 시각으로 기본 끼니 태그를 추정한다(업로드 칩 기본값용).
 *
 * 하루 경계를 자정이 아니라 생활 리듬에 맞춘다 — 새벽 0~4시에 먹는 건 아침이 아니라
 * 전날에서 이어지는 야식이다. 웹앱 초기 구현은 `hour < 11`을 통째로 아침으로 잡아
 * 새벽 1시 라면이 「아침」으로 기록됐고 고칠 수도 없었다(UX_FINDINGS C항).
 *
 * 통계 시각대(`timeBucketOf`)와 경계가 다르다. 일부러 다르다 — 이건 "사용자가 보통
 * 뭐라고 부를까"의 추측이고, 저건 집계 버킷이다.
 */
export function defaultSlotForHour(hour: number): MealTag {
  if (hour < 5) return '야식'
  if (hour < 11) return '아침'
  if (hour < 16) return '점심'
  if (hour < 21) return '저녁'
  return '야식'
}
```

- [ ] **Step 3: 기존 `board.test.ts`의 `defaultSlotForHour` 케이스를 한국어로 고친다**

`src/entities/post/board.test.ts`에서 `defaultSlotForHour` describe 블록의 기대값만 바꾼다. **타일 격자 케이스는 Task 14에서 삭제하므로 지금 건드리지 않는다.**

```ts
describe('defaultSlotForHour', () => {
  it('새벽 0~4시는 아침이 아니라 야식이다', () => {
    // 전날에서 이어지는 시간대. 초기 구현은 여기를 아침으로 잡았다.
    for (const h of [0, 1, 2, 3, 4]) {
      expect(defaultSlotForHour(h)).toBe('야식')
    }
  })

  it('아침·점심·저녁 경계', () => {
    expect(defaultSlotForHour(5)).toBe('아침')
    expect(defaultSlotForHour(10)).toBe('아침')
    expect(defaultSlotForHour(11)).toBe('점심')
    expect(defaultSlotForHour(15)).toBe('점심')
    expect(defaultSlotForHour(16)).toBe('저녁')
    expect(defaultSlotForHour(20)).toBe('저녁')
    expect(defaultSlotForHour(21)).toBe('야식')
    expect(defaultSlotForHour(23)).toBe('야식')
  })
})
```

- [ ] **Step 4: `types/database.ts`의 `meal_slot` 타입을 넓힌다**

```bash
grep -n "meal_slot" src/types/database.ts
```

찾은 모든 `meal_slot` 필드 타입을 `string | null`로 바꾼다(`'breakfast' | 'lunch' | ...` 유니온이 있으면 제거).

- [ ] **Step 5: 배럴에 신규 모듈을 노출한다**

`src/entities/post/index.ts`에 추가한다(기존 export는 유지):

```ts
export {
  MEAL_SLOTS,
  slotLabel,
  mealTimeLabel,
  defaultSlotForHour,
  buildSlotBoard,
  type MealTag,
  type MealSlotKey,
} from './board'
export { BAND_HOURS, groupByTimeBand, type BandItem } from './time-band'
export {
  normalizeMealTag,
  bandRangeLabel,
  timeBucketOf,
  MEAL_TAG_MAX_LENGTH,
  TAG_SEEDS,
  type TimeBucket,
} from './meal-tag'
export { recentTags, RECENT_TAGS_LIMIT, type TaggedRow } from './recent-tags'
```

- [ ] **Step 6: 전체 테스트·타입·린트를 돌린다**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm lint
```

Expected: 전부 통과. `MealSlotKey`가 `string`이 되어도 기존 코드는 컴파일된다 — 이게 이 태스크의 요점이다.

- [ ] **Step 7: Commit**

```bash
git add src/entities/post/board.ts src/entities/post/board.test.ts src/entities/post/index.ts src/types/database.ts
git commit -m "$(cat <<'EOF'
refactor(post): 끼니 타입을 자유 문자열로 넓힘

MealSlotKey를 string 별칭으로 두고 MealTag를 도입한다. 소비자를 한 번에 옮기지
않고 별칭을 남기는 이유는 각 커밋이 컴파일되는 상태를 유지하기 위해서다.
MEAL_SLOTS·buildSlotBoard 삭제는 소비자를 다 옮긴 뒤에 한다.

defaultSlotForHour는 키가 아니라 한국어 라벨을 돌려준다 — 이제 그 값이 그대로
사용자에게 보이는 태그다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 딥링크를 postId로 전환

**Files:**
- Modify: `src/entities/post/deeplink.ts`
- Modify: `src/entities/post/deeplink.test.ts`

**Interfaces:**
- Consumes: `offsetFromDate` from `./date-range`
- Produces: `type DeeplinkTarget = { dateOffset: number; postId: string | null }`, `deeplinkTarget(params: { date?: string; post?: string }, now: Date, maxOffset: number): DeeplinkTarget`

- [ ] **Step 1: Write the failing test**

`src/entities/post/deeplink.test.ts`의 `deeplinkTarget` describe 블록을 다음으로 교체한다(`parseLocalDate` 블록은 그대로 둔다):

```ts
describe('deeplinkTarget', () => {
  const now = new Date(2026, 7, 31, 12, 0, 0)

  it('date를 오프셋으로 바꾼다', () => {
    expect(deeplinkTarget({ date: '2026-08-30' }, now, 13).dateOffset).toBe(1)
  })

  it('post 파라미터를 그대로 postId로 넘긴다', () => {
    expect(deeplinkTarget({ date: '2026-08-31', post: 'p1' }, now, 13)).toEqual({
      dateOffset: 0,
      postId: 'p1',
    })
  })

  it('post가 없으면 postId는 null', () => {
    expect(deeplinkTarget({ date: '2026-08-31' }, now, 13).postId).toBeNull()
  })

  it('빈 문자열 post는 null로 본다', () => {
    expect(deeplinkTarget({ date: '2026-08-31', post: '' }, now, 13).postId).toBeNull()
  })

  it('date가 범위를 넘으면 오늘로 폴백한다', () => {
    expect(deeplinkTarget({ date: '2026-01-01' }, now, 13).dateOffset).toBe(0)
  })

  it('date가 미래면 오늘로 폴백한다', () => {
    expect(deeplinkTarget({ date: '2026-09-05' }, now, 13).dateOffset).toBe(0)
  })

  it('date가 없거나 형식이 틀리면 오늘로 폴백한다', () => {
    expect(deeplinkTarget({}, now, 13).dateOffset).toBe(0)
    expect(deeplinkTarget({ date: 'nope' }, now, 13).dateOffset).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/entities/post/deeplink.test.ts`
Expected: FAIL — `postId`가 존재하지 않고 `slotIdx`가 반환된다

- [ ] **Step 3: Write implementation**

`src/entities/post/deeplink.ts`에서 `MEAL_SLOTS` import를 제거하고 `deeplinkTarget`을 교체한다:

```ts
import { offsetFromDate } from './date-range'

/** 푸시 알림 딥링크가 가리키는 보드 위치. */
export type DeeplinkTarget = {
  dateOffset: number
  /** 스트림에서 스크롤해 보여줄 카드. 없으면 맨 위 */
  postId: string | null
}

// … parseLocalDate는 그대로 …

/**
 * 알림 딥링크의 date/post 파라미터 → 보드 초기 위치.
 *
 * 슬롯 인덱스를 쓰던 시절에는 「몇 번째 끼니 칸」이 위치였다. 스트림에는 칸이 없으니
 * 위치는 「어느 카드」다. 값이 없거나 미래·범위 초과면 오늘 맨 위로 폴백한다.
 * 없는 postId는 스트림 쪽에서 못 찾으면 그냥 맨 위에 머문다(에러 아님).
 */
export function deeplinkTarget(
  params: { date?: string; post?: string },
  now: Date,
  maxOffset: number,
): DeeplinkTarget {
  const date = parseLocalDate(params.date)
  const offset = date === null ? -1 : offsetFromDate(date, now)
  return {
    dateOffset: offset >= 0 && offset <= maxOffset ? offset : 0,
    postId: params.post ? params.post : null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/entities/post/deeplink.test.ts`
Expected: PASS

- [ ] **Step 5: 딥링크 URL 파서의 slot 참조를 정리한다**

```bash
grep -rn "slot" src/features/notifications/lib/push-url.ts src/features/notifications/ui/NotificationDeepLinks.tsx
```

`slot` 파라미터를 읽어 넘기던 곳을 `post`로 바꾼다. `push-url.test.ts`의 기대값도 함께 고친다.

- [ ] **Step 6: 전체 검증 후 커밋**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
git add src/entities/post/deeplink.ts src/entities/post/deeplink.test.ts src/features/notifications
git commit -m "$(cat <<'EOF'
feat(post): 알림 딥링크를 슬롯 인덱스에서 게시물 id로

슬롯 인덱스를 쓰던 시절에는 「몇 번째 끼니 칸」이 위치였다. 스트림에는 칸이 없으니
위치는 「어느 카드」다. 없는 postId는 에러가 아니라 맨 위에 머문다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: MealTagField — 태그 입력 컴포넌트

**Files:**
- Create: `src/features/post-edit/ui/MealTagField.tsx`
- Modify: `src/features/post-edit/index.ts` (export 추가)

**Interfaces:**
- Consumes: `normalizeMealTag`, `MEAL_TAG_MAX_LENGTH` from `@/entities/post`
- Produces:
  ```ts
  type MealTagFieldProps = {
    value: string | null
    onChange: (next: string | null) => void
    /** 원탭 재사용용 최근 태그. 호출자가 recentTags()로 만들어 넘긴다 */
    suggestions: string[]
  }
  export function MealTagField(props: MealTagFieldProps): JSX.Element
  ```

- [ ] **Step 1: 컴포넌트를 쓴다**

`src/features/post-edit/ui/MealTagField.tsx`:

```tsx
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import { normalizeMealTag, MEAL_TAG_MAX_LENGTH } from '@/entities/post'
import { PressableScale } from '@/shared/ui/press'

type MealTagFieldProps = {
  value: string | null
  onChange: (next: string | null) => void
  /** 원탭 재사용용 최근 태그. 호출자가 recentTags()로 만들어 넘긴다 */
  suggestions: string[]
}

/**
 * 끼니 태그 입력 — 업로드와 사후 편집이 함께 쓴다.
 *
 * **기본 경로에서 탭이 늘지 않아야 한다.** 섭취 시각으로 추정한 값이 이미 칩에
 * 들어가 있어 그대로 게시하면 끝이다. 제품 원칙이 「사진 1장 5초 기록」이라
 * 태그를 매번 입력하게 만들면 그 원칙과 정면으로 부딪힌다.
 *
 * 칩을 탭하면 최근 태그가 펼쳐진다. 자유 입력을 먼저 보여주지 않는 이유는
 * 대부분의 기록이 「점심」·「간식」처럼 이미 써본 태그의 반복이기 때문이다 —
 * 타이핑은 마지막 수단이다.
 */
export function MealTagField({ value, onChange, suggestions }: MealTagFieldProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const commitDraft = () => {
    const next = normalizeMealTag(draft)
    if (next !== null) onChange(next)
    setDraft('')
    setOpen(false)
  }

  if (!open) {
    return (
      <PressableScale
        onPress={() => setOpen(true)}
        hapticKind={null}
        accessibilityRole="button"
        accessibilityLabel={`끼니 태그 ${value ?? '없음'}, 탭해서 변경`}
        className="flex-row items-center gap-1 self-start rounded-full border border-border px-3 py-1.5"
      >
        <Text className="text-sm font-semibold text-foreground">{value ?? '끼니 고르기'}</Text>
        <Ionicons name="chevron-down" size={13} color="#9CA3AF" />
      </PressableScale>
    )
  }

  return (
    <View className="gap-2 rounded-2xl border border-border p-3">
      <View className="flex-row flex-wrap gap-1.5">
        {suggestions.map((tag) => (
          <PressableScale
            key={tag}
            onPress={() => {
              onChange(tag)
              setOpen(false)
            }}
            hapticKind="light"
            accessibilityRole="button"
            accessibilityState={{ selected: tag === value }}
            accessibilityLabel={`끼니 ${tag}`}
            className={`rounded-full px-3 py-1.5 ${
              tag === value ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                tag === value ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              {tag}
            </Text>
          </PressableScale>
        ))}
      </View>

      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commitDraft}
          placeholder="직접 입력"
          placeholderTextColor="#9CA3AF"
          maxLength={MEAL_TAG_MAX_LENGTH}
          returnKeyType="done"
          accessibilityLabel="끼니 직접 입력"
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-foreground"
        />
        <PressableScale
          onPress={commitDraft}
          hapticKind="light"
          accessibilityRole="button"
          accessibilityLabel="입력한 끼니 적용"
          className="rounded-xl bg-primary px-3 py-2"
        >
          <Text className="text-sm font-bold text-primary-foreground">확인</Text>
        </PressableScale>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: export를 추가한다**

`src/features/post-edit/index.ts`에 추가:

```ts
export { MealTagField } from './ui/MealTagField'
```

- [ ] **Step 3: 타입·린트를 돌린다**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Expected: 통과. 실패하면 `PressableScale`의 prop 이름과 NativeWind 클래스명을
`src/widgets/meal-tile/index.tsx`의 사용례와 대조해 맞춘다.

- [ ] **Step 4: Commit**

```bash
git add src/features/post-edit/ui/MealTagField.tsx src/features/post-edit/index.ts
git commit -m "$(cat <<'EOF'
feat(post-edit): 끼니 태그 입력 필드 (업로드·편집 공용)

기본 경로에서 탭이 늘지 않아야 한다 — 섭취 시각으로 추정한 값이 이미 칩에 들어가
있어 그대로 게시하면 끝이다. 「사진 1장 5초 기록」 원칙과 자유 입력을 함께 만족시키는
지점이 여기다.

자유 입력보다 최근 태그를 먼저 보여준다. 대부분의 기록이 이미 써본 태그의
반복이라 타이핑은 마지막 수단이어야 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 업로드 화면에 MealTagField 연결

**Files:**
- Modify: `src/app/upload.tsx`
- Modify: `src/features/upload/ui/ShotEditor.tsx`
- Modify: `src/entities/post/queries.ts` (내 최근 태그 쿼리 추가)
- Modify: `src/entities/post/model.ts` (`fetchMyRecentTagRows` 추가)
- Modify: `src/shared/api/query-keys.ts` (키 추가)

**Interfaces:**
- Consumes: `MealTagField` from `@/features/post-edit`, `recentTags` from `@/entities/post`
- Produces: `useMyRecentTags(userId: string | undefined)` → `{ data: string[] }`. `ShotEditor`의 `slot`/`onSlotChange` prop이 `tag: string | null` / `onTagChange: (next: string | null) => void`로 바뀐다.

- [ ] **Step 1: 최근 태그 조회 함수를 추가한다**

`src/entities/post/model.ts` 끝에 추가:

```ts
/**
 * 최근 태그 칩용 원본 행 — 내 기록의 태그와 시각만.
 * 60일로 자르는 건 「최근에 쓰던 말」을 보여주려는 것이라 오래된 태그가
 * 빈도로 상위에 올라오면 안 되기 때문이다.
 */
export async function fetchMyRecentTagRows(
  userId: string,
  now: Date = new Date(),
  sinceDays = 60,
): Promise<{ meal_slot: string | null; recorded_at: string; created_at: string }[]> {
  const since = new Date(now)
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - sinceDays)

  const { data, error } = await supabase
    .from('posts')
    .select('meal_slot, recorded_at, created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())

  if (error) throw error
  return (data ?? []) as unknown as {
    meal_slot: string | null
    recorded_at: string
    created_at: string
  }[]
}
```

- [ ] **Step 2: 쿼리 키를 추가한다**

`src/shared/api/query-keys.ts`의 `queryKeys` 객체에 추가한다. **`myPosts(userId)` 프리픽스 아래에 두어야** 사후 편집 후 무효화(`invalidateAfterPostEdit`)에 자동으로 걸린다:

```ts
  myRecentTags: (userId: string) => [...queryKeys.myPosts(userId), 'recentTags'] as const,
```

`myPosts`의 실제 형태를 먼저 확인한다:

```bash
grep -n "myPosts" src/shared/api/query-keys.ts
```

- [ ] **Step 3: 훅을 추가한다**

`src/entities/post/queries.ts`에 추가(`fetchMyRecentTagRows`와 `recentTags` import 필요):

```ts
/** 태그 칩용 내 최근 태그. userId가 없으면 씨앗 목록이 나온다. */
export function useMyRecentTags(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myRecentTags(userId ?? ''),
    queryFn: async () => recentTags(await fetchMyRecentTagRows(userId as string)),
    enabled: !!userId,
  })
}
```

- [ ] **Step 4: `ShotEditor`의 끼니 prop을 태그로 바꾼다**

```bash
grep -n "slot\|MealSlot\|MEAL_SLOTS" src/features/upload/ui/ShotEditor.tsx
```

고정 4칩을 렌더하던 부분을 `MealTagField`로 교체한다. prop 이름을 `slot` → `tag`, `onSlotChange` → `onTagChange`로 바꾸고 `suggestions: string[]`를 새로 받는다.

- [ ] **Step 5: `upload.tsx`를 연결한다**

`src/app/upload.tsx`에서:

```ts
// 기존
const [slot, setSlot] = useState<MealSlotKey>(() =>
  defaultSlotForHour(new Date().getHours()),
)

// 교체
const [tag, setTag] = useState<string | null>(() =>
  defaultSlotForHour(new Date().getHours()),
)
const { data: suggestions = [] } = useMyRecentTags(user?.id)
```

`createPostToGroups` 호출의 `mealSlot: slot` → `mealSlot: tag ?? ''`로 바꾼다.
`ShotEditor`에 `tag={tag} onTagChange={setTag} suggestions={suggestions}`를 넘긴다.

**섭취 시각을 바꿀 때 태그를 자동으로 다시 추정하지 않는다** — 사용자가 태그를 손으로
바꿨는데 시각을 조정하면 되돌아가 버린다. 자동 추정은 초기값에서만 쓴다.

- [ ] **Step 6: 검증 후 커밋**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm lint
git add src/app/upload.tsx src/features/upload/ui/ShotEditor.tsx src/entities/post/queries.ts src/entities/post/model.ts src/shared/api/query-keys.ts
git commit -m "$(cat <<'EOF'
feat(upload): 끼니 고정 칩을 자유 태그 입력으로

섭취 시각을 조정할 때 태그를 다시 추정하지 않는다 — 사용자가 손으로 바꾼 태그가
시각 조정에 되돌아가면 안 된다. 자동 추정은 초기값에서만 쓴다.

최근 태그 쿼리 키를 myPosts 프리픽스 아래에 둬서 사후 편집 후 무효화에 자동으로
걸리게 했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 사후 편집 시트에 MealTagField 연결

**Files:**
- Modify: `src/features/post-edit/ui/PostEditSheet.tsx`
- Modify: `src/entities/post/edit.ts`
- Modify: `src/entities/post/edit.test.ts`

**Interfaces:**
- Consumes: `MealTagField`, `normalizeMealTag`, `useMyRecentTags`
- Produces: `edit.ts`의 끼니 diff가 문자열 비교로 동작

- [ ] **Step 1: `edit.ts`의 끼니 diff를 확인하고 문자열 비교로 고친다**

```bash
grep -n "mealSlot\|MealSlot" src/entities/post/edit.ts
```

`mealSlotChange`(또는 동명 함수)가 고정 키를 비교하고 있으면 정규화 후 비교로 바꾼다:

```ts
/**
 * 편집 후 넘길 끼니 태그. **null = 변경 없음**이라는 RPC 규약을 지킨다.
 * 정규화해서 비교하는 이유는 사용자가 「점심 」처럼 공백을 붙여도 변경으로
 * 보이면 안 되기 때문이다(DB 트리거가 어차피 같은 값으로 접는다).
 */
export function mealTagChange(original: string | null, next: string | null): string | null {
  const a = normalizeMealTag(original)
  const b = normalizeMealTag(next)
  return a === b ? null : b
}
```

- [ ] **Step 2: `edit.test.ts`에 케이스를 추가한다**

```ts
describe('mealTagChange', () => {
  it('같으면 null(변경 없음)', () => {
    expect(mealTagChange('점심', '점심')).toBeNull()
  })

  it('공백 차이는 변경으로 보지 않는다', () => {
    expect(mealTagChange('점심', ' 점심 ')).toBeNull()
  })

  it('다르면 새 값을 돌려준다', () => {
    expect(mealTagChange('점심', '야식')).toBe('야식')
  })

  it('없던 태그를 새로 붙이면 새 값', () => {
    expect(mealTagChange(null, '해장')).toBe('해장')
  })

  it('8자를 넘으면 잘린 값으로 비교한다', () => {
    expect(mealTagChange('가나다라마바사아', '가나다라마바사아자')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails, then implement**

Run: `pnpm exec vitest run src/entities/post/edit.test.ts`
Expected: FAIL → Step 1의 구현을 넣고 PASS

- [ ] **Step 4: `PostEditSheet`의 끼니 칩을 교체한다**

```bash
grep -n "MealSlotChips\|MEAL_SLOTS\|mealSlot" src/features/post-edit/ui/PostEditSheet.tsx
```

`MealSlotChips` 렌더를 `MealTagField`로 바꾸고, `useMyRecentTags`로 `suggestions`를 채운다.
`useUpdatePostBatch`에 넘기는 `mealSlot`은 `mealTagChange(original, draft)`의 결과를 쓴다.

- [ ] **Step 5: 검증 후 커밋**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm lint
git add src/features/post-edit src/entities/post/edit.ts src/entities/post/edit.test.ts
git commit -m "$(cat <<'EOF'
feat(post-edit): 사후 편집의 끼니를 자유 태그로

공백 차이를 변경으로 보지 않는다 — DB 트리거가 어차피 같은 값으로 접으니
불필요한 batch 업데이트와 푸시 보정이 돌 이유가 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: meal-card 위젯

**Files:**
- Create: `src/widgets/meal-card/index.tsx`

**Interfaces:**
- Consumes: `BoardPost` from `@/entities/post/model`, `GroupMemberProfile` from `@/entities/group`, `hhmmFromDate` from `@/entities/post`, `ReactionBar` (아래 Step 1에서 이동)
- Produces:
  ```ts
  type MealCardProps = {
    post: BoardPost
    member: GroupMemberProfile | null
    isMe: boolean
    currentUserId: string
    onReact: (postId: string, emoji: string) => void
    onOpen: () => void
  }
  export function MealCard(props: MealCardProps): JSX.Element
  export function MealCardSkeleton(): JSX.Element
  ```

- [ ] **Step 1: `ReactionBar`를 공용 위치로 옮긴다**

`ReactionBar`·`Chip`·`useCountPop`은 지금 `src/widgets/meal-tile/index.tsx`에 있고
`widgets/post-detail`도 그걸 쓴다. `meal-tile`은 Task 14에서 삭제되므로 먼저 옮긴다.

```bash
grep -rn "ReactionBar" src
```

`src/widgets/reaction-bar/index.tsx`를 새로 만들고 `meal-tile/index.tsx`의
`ReactionBar` / `Chip` / `useCountPop`을 **그대로** 옮긴다(로직 변경 없음).
`meal-tile`과 `post-detail`의 import를 새 경로로 바꾼다.

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/widgets/reaction-bar src/widgets/meal-tile src/widgets/post-detail
git commit -m "$(cat <<'EOF'
refactor(widgets): ReactionBar를 meal-tile에서 분리

meal-tile은 스트림 전환으로 삭제되는데 ReactionBar는 post-detail과 새 meal-card가
계속 쓴다. 로직은 그대로 두고 위치만 옮겼다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: `MealCard`를 쓴다**

`src/widgets/meal-card/index.tsx`:

```tsx
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'

import type { GroupMemberProfile } from '@/entities/group'
import { hhmmFromDate } from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import { ReactionBar } from '@/widgets/reaction-bar'
import { PressableScale } from '@/shared/ui/press'
import { Skeleton } from '@/shared/ui/skeleton'

type MealCardProps = {
  post: BoardPost
  member: GroupMemberProfile | null
  isMe: boolean
  currentUserId: string
  onReact: (postId: string, emoji: string) => void
  onOpen: () => void
}

/**
 * 스트림 카드 1장.
 *
 * 타일 격자를 버리고 얻은 것이 이 카드의 **폭**이다. 2열 타일에서는 사진이
 * 화면 절반이었고 음식이 잘 안 보였다 — 음식 사진 앱에서 그건 재미의 손실이다.
 * 정사각으로 두는 건 업로드 크롭과 맞추기 위해서다.
 *
 * 리액션 칩은 사진 위에 얹지 않고 아래로 내렸다. 폭이 넓어져 사진 위 오버레이가
 * 정보보다 방해가 되고, 스트림에서는 세로 공간이 타일만큼 아깝지 않다.
 */
export function MealCard({
  post,
  member,
  isMe,
  currentUserId,
  onReact,
  onOpen,
}: MealCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const time = hhmmFromDate(new Date(post.recorded_at))
  const name = isMe ? '나' : (member?.nickname ?? '알 수 없음')

  return (
    <View className="gap-2 py-2">
      <View className="flex-row items-center gap-2">
        <Avatar url={member?.avatar_url ?? null} initial={name[0] ?? '?'} />
        <Text className="text-sm font-bold text-white">{name}</Text>
        <Text className="text-xs text-white/55">{time}</Text>
        {post.meal_slot ? (
          <View className="rounded-full border border-white/25 px-2 py-0.5">
            <Text className="text-[11px] font-semibold text-white/80">{post.meal_slot}</Text>
          </View>
        ) : null}
      </View>

      <PressableScale
        onPress={onOpen}
        // 카드 위에서 시작한 가로 스와이프로 상세가 열리면 안 된다.
        swipeSafe
        // 상세로 넘어가는 건 화면 이동이다 — 햅틱을 주지 않는다.
        hapticKind={null}
        accessibilityRole="button"
        accessibilityLabel={`${name}의 기록 자세히 보기, ${time}`}
        className="aspect-square w-full overflow-hidden rounded-xl bg-board-tile"
      >
        {post.signedImageUrl && !imgFailed && (
          <Image
            source={{ uri: post.signedImageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={120}
            onError={() => setImgFailed(true)}
          />
        )}
      </PressableScale>

      {post.caption ? (
        <Text className="text-sm leading-snug text-white/90">{post.caption}</Text>
      ) : null}

      <ReactionBar
        postId={post.id}
        reactions={post.reactions}
        currentUserId={currentUserId}
        onReact={onReact}
      />
    </View>
  )
}

function Avatar({ url, initial }: { url: string | null; initial: string }) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: 26, height: 26, borderRadius: 13 }}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <View className="size-[26px] items-center justify-center rounded-full bg-white/15">
      <Text className="text-[11px] font-bold text-white/80">{initial}</Text>
    </View>
  )
}

/** 첫 로드 자리 잡기 — 카드 2장 높이만 잡아 둔다. */
export function MealCardSkeleton() {
  return (
    <View className="gap-4 py-2">
      {[0, 1].map((i) => (
        <View key={i} className="gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="aspect-square w-full rounded-xl" />
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 3: `Skeleton`의 실제 API를 확인해 맞춘다**

```bash
sed -n 1,40p src/shared/ui/skeleton.tsx
```

`className`을 받지 않으면 그 컴포넌트의 prop 형태에 맞춰 `MealCardSkeleton`을 고친다.

- [ ] **Step 4: 검증 후 커밋**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/widgets/meal-card
git commit -m "$(cat <<'EOF'
feat(widgets): 스트림 카드 위젯

타일 격자를 버리고 얻은 것이 카드의 폭이다. 2열 타일에서는 사진이 화면 절반이라
음식이 잘 안 보였다 — 음식 사진 앱에서 그건 재미의 손실이다.

리액션 칩을 사진 위 오버레이에서 아래로 내렸다. 폭이 넓어지니 오버레이가 정보보다
방해가 되고, 스트림에서는 세로 공간이 타일만큼 아깝지 않다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: band-header · member-strip 위젯

**Files:**
- Create: `src/widgets/band-header/index.tsx`
- Create: `src/widgets/member-strip/index.tsx`
- Create: `src/widgets/member-strip/counts.ts`
- Test: `src/widgets/member-strip/counts.test.ts`

**Interfaces:**
- Consumes: `bandRangeLabel` from `@/entities/post`, `GroupMemberProfile`
- Produces:
  - `BandHeader({ startHour }: { startHour: number })`
  - `memberPostCounts(members, posts)` → `{ member: GroupMemberProfile; count: number }[]`
  - `MemberStrip({ members, posts, currentUserId })`

- [ ] **Step 1: Write the failing test**

`src/widgets/member-strip/counts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { memberPostCounts } from './counts'

const member = (id: string, nickname: string) => ({
  user_id: id,
  nickname,
  avatar_url: null,
})

describe('memberPostCounts', () => {
  it('멤버별 기록 수를 센다', () => {
    const result = memberPostCounts(
      [member('u1', '효린'), member('u2', '지훈')],
      [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }],
    )
    expect(result.map((r) => [r.member.user_id, r.count])).toEqual([
      ['u1', 2],
      ['u2', 1],
    ])
  })

  it('안 올린 멤버는 0으로 남는다 — 목록에서 빠지지 않는다', () => {
    const result = memberPostCounts([member('u1', '효린'), member('u2', '수민')], [])
    expect(result.map((r) => r.count)).toEqual([0, 0])
  })

  it('멤버 순서를 보존한다', () => {
    const result = memberPostCounts(
      [member('u2', '지훈'), member('u1', '효린')],
      [{ user_id: 'u1' }],
    )
    expect(result.map((r) => r.member.user_id)).toEqual(['u2', 'u1'])
  })

  it('멤버가 아닌 사람의 기록은 무시한다', () => {
    const result = memberPostCounts([member('u1', '효린')], [{ user_id: 'ghost' }])
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/widgets/member-strip/counts.test.ts`
Expected: FAIL — `Failed to resolve import "./counts"`

- [ ] **Step 3: 구현한다**

`src/widgets/member-strip/counts.ts`:

```ts
type MemberLike = { user_id: string; nickname: string; avatar_url: string | null }
type PostLike = { user_id: string }

export type MemberCount<M extends MemberLike> = {
  member: M
  /** 그날 이 멤버의 기록 수. 0이면 미기록 */
  count: number
}

/**
 * 멤버별 그날 기록 수.
 *
 * **안 올린 멤버를 목록에서 빼지 않는 것**이 이 함수의 요점이다. 스트림으로
 * 바뀌면서 「아직이에요」 빈 타일이 사라졌는데, 셋로그에서 「빈 시간이 보이는 것」이
 * 하는 일 — 하루의 리듬과 가벼운 압박 — 을 이 줄이 대신한다.
 */
export function memberPostCounts<M extends MemberLike, P extends PostLike>(
  members: M[],
  posts: P[],
): MemberCount<M>[] {
  const counts = new Map<string, number>()
  for (const p of posts) counts.set(p.user_id, (counts.get(p.user_id) ?? 0) + 1)
  return members.map((member) => ({ member, count: counts.get(member.user_id) ?? 0 }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/widgets/member-strip/counts.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: `BandHeader`를 쓴다**

`src/widgets/band-header/index.tsx`:

```tsx
import { Text, View } from 'react-native'
import { bandRangeLabel } from '@/entities/post'

/**
 * 밴드 구분선 + 시각 범위.
 *
 * **이름을 붙이지 않는다.** 「점심 12–14시」처럼 쓰면 15:20 기록이 태그는 「점심」인데
 * 헤더는 「오후」가 되어 모순으로 읽힌다. 밴드·태그 자동값·통계 시각대는 경계가
 * 일부러 다르고, 헤더를 시각 범위만으로 두면 그 충돌이 생기지 않는다.
 */
export function BandHeader({ startHour }: { startHour: number }) {
  return (
    <View className="flex-row items-center gap-2 pb-1 pt-4">
      <Text className="text-[11px] font-semibold tracking-wide text-white/45">
        {bandRangeLabel(startHour)}
      </Text>
      <View className="h-px flex-1 bg-white/12" />
    </View>
  )
}
```

- [ ] **Step 6: `MemberStrip`을 쓴다**

`src/widgets/member-strip/index.tsx`:

```tsx
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'

import type { GroupMemberProfile } from '@/entities/group'
import { memberPostCounts } from './counts'

type MemberStripProps = {
  members: GroupMemberProfile[]
  posts: { user_id: string }[]
  currentUserId: string
}

/**
 * 상단 멤버 줄 — 누가 몇 개 올렸고 누가 아직 안 올렸는지.
 *
 * 스트림으로 바뀌며 사라진 「아직이에요」 빈 타일의 역할을 한 줄로 대신한다.
 * 셋로그가 「빈 시간」으로 만드는 리듬이 뇸에서는 이 줄이다.
 */
export function MemberStrip({ members, posts, currentUserId }: MemberStripProps) {
  const counts = memberPostCounts(members, posts)
  const posted = counts.filter((c) => c.count > 0).length

  return (
    <View className="flex-row items-center gap-2 px-4 pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, alignItems: 'center' }}
      >
        {counts.map(({ member, count }) => (
          <MemberDot
            key={member.user_id}
            nickname={member.user_id === currentUserId ? '나' : member.nickname}
            avatarUrl={member.avatar_url}
            count={count}
          />
        ))}
      </ScrollView>
      <Text className="text-[11px] text-white/45">
        {posted}/{members.length}명
      </Text>
    </View>
  )
}

function MemberDot({
  nickname,
  avatarUrl,
  count,
}: {
  nickname: string
  avatarUrl: string | null
  count: number
}) {
  const [failed, setFailed] = useState(false)
  const empty = count === 0

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        empty ? `${nickname} 아직 안 올렸어요` : `${nickname} ${count}개 올렸어요`
      }
      className="relative"
    >
      {avatarUrl && !failed ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 30, height: 30, borderRadius: 15, opacity: empty ? 0.4 : 1 }}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View
          className={`size-[30px] items-center justify-center rounded-full ${
            empty ? 'border border-dashed border-white/35' : 'bg-white/15'
          }`}
        >
          <Text className={`text-[11px] font-bold ${empty ? 'text-white/40' : 'text-white/80'}`}>
            {nickname[0] ?? '?'}
          </Text>
        </View>
      )}
      {count > 0 && (
        <View className="absolute -right-0.5 -top-0.5 size-4 items-center justify-center rounded-full bg-primary">
          <Text className="text-[9px] font-bold text-white">{count}</Text>
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 7: 검증 후 커밋**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm lint
git add src/widgets/band-header src/widgets/member-strip
git commit -m "$(cat <<'EOF'
feat(widgets): 밴드 헤더 + 멤버 줄

멤버 줄이 스트림에서 사라진 「아직이에요」의 역할을 대신한다. 셋로그가 「빈 시간」으로
만드는 리듬이 뇸에서는 이 줄이다 — 안 올린 멤버를 목록에서 빼지 않는 게 요점이다.

밴드 헤더에 이름을 붙이지 않는다. 「점심 12–14시」로 쓰면 15:20 기록이 태그는
「점심」, 헤더는 「오후」가 되어 모순으로 읽힌다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 보드 화면 재작성

**Files:**
- Modify: `src/app/(app)/board.tsx` (전면 교체)

**Interfaces:**
- Consumes: `groupByTimeBand`, `deeplinkTarget`, `MealCard`, `MealCardSkeleton`, `BandHeader`, `MemberStrip`, 기존 `BoardHeader`·`DayPicker`·`PostDetail`
- Produces: 없음 (화면)

- [ ] **Step 1: 가로 제스처를 RNGH 옵션으로 바꾸는 이유를 이해한다**

지금은 `decideAxis(translationX, translationY, threshold)`로 축을 직접 판정한다.
세로가 ScrollView가 되면 그 판정이 스크롤과 싸운다. RNGH가 이미 제공하는
`activeOffsetX` / `failOffsetY`로 대체한다 — 가로로 20px 이상 움직이면 활성화되고,
세로로 15px 이상 움직이면 실패해서 ScrollView에 양보한다.

- [ ] **Step 2: `board.tsx`를 교체한다**

`src/app/(app)/board.tsx` 전체를 다음으로 바꾼다:

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { useAuth } from '@/features/auth'
import { useMyProfile } from '@/features/profile'
import { useMyGroups, useGroupMembers, type GroupMemberProfile } from '@/entities/group'
import {
  groupByTimeBand,
  dateHeading,
  dateFromOffset,
  offsetFromDate,
  deeplinkTarget,
} from '@/entities/post'
import type { BoardPost } from '@/entities/post/model'
import {
  useBoardPosts,
  useToggleReaction,
  useGroupRecordedDays,
} from '@/entities/post/queries'
import { BoardHeader } from '@/widgets/board-header'
import { MemberStrip } from '@/widgets/member-strip'
import { BandHeader } from '@/widgets/band-header'
import { MealCard, MealCardSkeleton } from '@/widgets/meal-card'
import { DayPicker } from '@/widgets/day-picker'
import { PostDetail } from '@/widgets/post-detail'
import { ErrorState } from '@/shared/ui/error-state'
import { PressableScale, haptic } from '@/shared/ui/press'

/** 최근 2주. 보드 화살표·스와이프·달력이 모두 이 범위를 공유한다. */
const MAX_OFFSET = 13

/** 가로 스와이프가 커밋되는 비율(화면 폭 대비). */
const COMMIT_RATIO = 0.28

/**
 * upload·profile 라우트는 다른 작업으로 추가되는 중이라 typedRoutes 목록에
 * 아직 없을 수 있다. 경로가 생기면 이 헬퍼만 지우면 된다.
 */
function href(path: string): Href {
  return path as unknown as Href
}

/** useLocalSearchParams는 같은 키가 여러 번 오면 배열을 준다. 첫 값만 쓴다. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const clampOffset = (n: number) => Math.min(MAX_OFFSET, Math.max(0, n))

export default function BoardScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { profile } = useMyProfile()
  const userId = user?.id ?? ''

  const params = useLocalSearchParams()
  const groupIdParam = one(params.group)

  // 푸시 딥링크(?date=&post=)는 "초기 위치"만 정한다. 이후 스와이프·달력 조작을
  // URL이 되돌리면 안 되므로 lazy initializer로 첫 렌더에서만 읽는다.
  const [initialTarget] = useState(() =>
    deeplinkTarget(
      { date: one(params.date), post: one(params.post) },
      new Date(),
      MAX_OFFSET,
    ),
  )
  const [dateOffset, setDateOffset] = useState(initialTarget.dateOffset)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailPostId, setDetailPostId] = useState<string | null>(
    initialTarget.postId,
  )

  const { data: groups, error: groupsError, isLoading: groupsLoading } = useMyGroups()
  const activeGroupId = useMemo(() => {
    if (!groups) return null
    return groups.find((g) => g.id === groupIdParam)?.id ?? groups[0]?.id ?? null
  }, [groups, groupIdParam])

  const { data: members = [], error: membersError } = useGroupMembers(activeGroupId)
  const {
    data: posts = [],
    error: postsError,
    isLoading: postsLoading,
  } = useBoardPosts(activeGroupId, dateOffset)
  const { data: recordedDays } = useGroupRecordedDays(activeGroupId)

  const react = useToggleReaction(activeGroupId, dateOffset, userId)
  const error = groupsError ?? membersError ?? postsError

  /** 스트림의 뼈대. 기록이 없는 밴드는 나타나지 않는다. */
  const bands = useMemo(() => groupByTimeBand(posts), [posts])

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  )

  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(
    () => dateFromOffset(dateOffset, today),
    [dateOffset, today],
  )
  const heading = useMemo(() => dateHeading(dateOffset, today), [dateOffset, today])

  const changeDate = useCallback((next: number) => {
    setDateOffset(clampOffset(next))
  }, [])

  const goUpload = useCallback(() => {
    router.push(href(`/upload${activeGroupId ? `?group=${activeGroupId}` : ''}`))
  }, [activeGroupId])

  const handlePickDate = useCallback(
    (date: Date) => {
      const offset = offsetFromDate(date, new Date())
      if (offset < 0 || offset > MAX_OFFSET) return // 피커에서 이미 비활성
      changeDate(offset)
      setPickerOpen(false)
    },
    [changeDate],
  )

  // ── 제스처 ────────────────────────────────────────────────
  // 가로 = 날짜. **세로는 ScrollView가 가진다.**
  //
  // 예전에는 세로가 끼니 이동이라 두 축을 직접 판정해야 했고(`decideAxis`),
  // 그 판정이 사진 탭과 겹쳐 친구 사진을 누르면 끼니가 넘어갔다(UX_FINDINGS B항).
  // 칸이 없어지면서 세로가 순수 스크롤이 됐으니, 축 판정을 RNGH에 맡긴다 —
  // activeOffsetX로 "가로로 이만큼 움직였을 때만" 활성화하고, failOffsetY로
  // 세로가 먼저 움직이면 스크롤에 양보한다. 직접 만든 축 로직이 필요 없다.
  //
  // 가로 방향은 iOS 캘린더·사진과 같은 관례를 따른다:
  //   오른쪽으로 밀기 = 과거, 왼쪽으로 밀기 = 미래
  const [stageWidth, setStageWidth] = useState(0)
  const dragX = useState(() => new Animated.Value(0))[0]
  const contentOpacity = useState(() => new Animated.Value(1))[0]

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    setStageWidth(e.nativeEvent.layout.width)
  }, [])

  /** 날짜가 실제로 넘어간 순간의 짧은 밝기 딥 — 내용이 갈렸다는 걸 눈에 찍는다. */
  const flashContent = useCallback(() => {
    Animated.sequence([
      Animated.timing(contentOpacity, {
        toValue: 0.4,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start()
  }, [contentOpacity])

  const scrollRef = useRef<ScrollView>(null)

  const commitDateSwipe = useCallback(
    (next: number) => {
      const clamped = clampOffset(next)
      if (clamped === dateOffset) return
      void haptic('light')
      flashContent()
      setDateOffset(clamped)
      // 날짜가 갈렸으면 스트림을 맨 위로 — 어제의 스크롤 위치를 물려받으면
      // 카드 수가 달라 엉뚱한 지점에 착지한다.
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    },
    [dateOffset, flashContent],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        // 가로로 20px 이상 움직여야 활성화. 세로로 15px 먼저 움직이면 실패 →
        // 중첩된 ScrollView가 제스처를 가져간다.
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .onUpdate((e) => {
          // 양 끝에서는 고무줄 저항. 오늘에서 더 갈 곳은 미래 = 왼쪽 드래그,
          // 13일 전에서 더 갈 곳은 과거 = 오른쪽 드래그다.
          const atNewest = dateOffset === 0 && e.translationX < 0
          const atOldest = dateOffset === MAX_OFFSET && e.translationX > 0
          dragX.setValue(atNewest || atOldest ? e.translationX * 0.3 : e.translationX)
        })
        .onEnd((e) => {
          const w = stageWidth || 360
          if (e.translationX > w * COMMIT_RATIO) commitDateSwipe(dateOffset + 1)
          else if (e.translationX < -w * COMMIT_RATIO) commitDateSwipe(dateOffset - 1)
        })
        .onFinalize(() => {
          Animated.spring(dragX, {
            toValue: 0,
            speed: 20,
            bounciness: 3,
            // 드래그 중 setValue로 값을 밀어 넣으므로 JS 드라이버로 둔다.
            useNativeDriver: false,
          }).start()
        }),
    [dateOffset, stageWidth, dragX, commitDateSwipe],
  )

  // ── 상세 ──────────────────────────────────────────────────
  // 게시물 id만 들고 있고 본문은 매 렌더 캐시에서 다시 찾는다 —
  // 리액션 낙관적 업데이트가 상세 화면에도 그대로 반영되도록.
  const detailPost = useMemo<BoardPost | null>(
    () => posts.find((p) => p.id === detailPostId) ?? null,
    [posts, detailPostId],
  )
  const detailMember = useMemo<GroupMemberProfile | null>(
    () => memberById.get(detailPost?.user_id ?? '') ?? null,
    [memberById, detailPost],
  )

  // ── 렌더 ──────────────────────────────────────────────────
  if (error) {
    return (
      <View className="flex-1 bg-board-bg" style={{ paddingTop: insets.top }}>
        <ErrorState
          message="보드를 불러오지 못했어요"
          onRetry={() => router.replace(href('/groups'))}
        />
      </View>
    )
  }

  if (groupsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-board-bg">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  if (groups && groups.length === 0) {
    return <NoGroupEmpty />
  }

  return (
    <View className="flex-1 bg-board-bg" style={{ paddingTop: insets.top }}>
      <BoardHeader
        dateLabelText={heading.primary}
        dateCaption={heading.secondary}
        canGoOlder={dateOffset < MAX_OFFSET}
        canGoNewer={dateOffset > 0}
        onOlder={() => changeDate(dateOffset + 1)}
        onNewer={() => changeDate(dateOffset - 1)}
        onDatePress={() => setPickerOpen(true)}
        onBack={() => router.replace(href('/groups'))}
        onProfile={() => router.push(href('/profile'))}
        avatarInitial={profile?.nickname?.[0] ?? '나'}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <MemberStrip members={members} posts={posts} currentUserId={userId} />

      <GestureDetector gesture={pan}>
        {/* NativeWind가 Animated.View까지 감싸지는 않으므로 style로 직접 쓴다 */}
        <Animated.View
          onLayout={onStageLayout}
          style={{ flex: 1, transform: [{ translateX: dragX }] }}
        >
          <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {postsLoading ? (
                <MealCardSkeleton />
              ) : bands.length === 0 ? (
                <NoRecordEmpty onUpload={goUpload} />
              ) : (
                bands.map((band) => (
                  <View key={band.startHour}>
                    <BandHeader startHour={band.startHour} />
                    {band.posts.map((post) => (
                      <MealCard
                        key={post.id}
                        post={post}
                        member={memberById.get(post.user_id) ?? null}
                        isMe={post.user_id === userId}
                        currentUserId={userId}
                        onReact={react}
                        onOpen={() => setDetailPostId(post.id)}
                      />
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/*
        하단 촬영 버튼은 보드의 상시 진입점이다. 스트림이 비었을 때도, 과거 날짜를
        보고 있을 때도 여기서만 기록을 시작할 수 있다.
      */}
      <View
        className="items-center pt-1"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <PressableScale
          onPress={goUpload}
          hapticKind={null}
          accessibilityRole="button"
          accessibilityLabel="오늘의 한 끼 기록하기"
          accessibilityHint="사진을 찍어 오늘 날짜로 기록해요"
          className="size-16 items-center justify-center rounded-full bg-primary"
        >
          <Ionicons name="camera" size={30} color="#fff" />
        </PressableScale>
      </View>

      <DayPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={selectedDate}
        onSelect={handlePickDate}
        markedDays={recordedDays}
        maxDate={today}
        minDate={dateFromOffset(MAX_OFFSET, today)}
      />

      <PostDetail
        post={detailPost}
        member={detailMember}
        isMe={detailPost?.user_id === userId}
        currentUserId={userId}
        onReact={react}
        onClose={() => setDetailPostId(null)}
      />
    </View>
  )
}

/** 아직 어느 그룹에도 속하지 않았을 때. */
function NoGroupEmpty() {
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background px-8">
      <View className="size-[120px] items-center justify-center rounded-full bg-primary-100">
        <Text className="text-5xl">👥</Text>
      </View>
      <Text className="text-2xl font-bold text-foreground">먼저 그룹을 만들어요</Text>
      <Text className="text-center text-sm leading-relaxed text-muted-foreground">
        친구들과 끼니를 공유할 그룹을 만들거나{'\n'}초대코드로 참여해 보세요
      </Text>
      <PressableScale
        onPress={() => router.replace(href('/groups'))}
        hapticKind={null}
        accessibilityRole="button"
        className="rounded-full bg-primary px-6 py-3"
      >
        <Text className="text-sm font-bold text-primary-foreground">
          그룹 만들기 / 참여하기
        </Text>
      </PressableScale>
    </View>
  )
}

/**
 * 그날 아무도 안 올렸을 때.
 *
 * 스트림에는 「내 빈 칸」이 없으니 이 화면이 유일한 빈 상태다. 상단 멤버 줄이
 * 이미 「0/4명」을 말하고 있으므로 여기서는 압박 없이 시작만 권한다.
 */
function NoRecordEmpty({ onUpload }: { onUpload: () => void }) {
  return (
    <View className="items-center justify-center gap-4 py-24">
      <Text className="text-5xl">🍽</Text>
      <Text className="text-lg font-bold text-white">이 날은 아무도 안 올렸어요</Text>
      <PressableScale
        onPress={onUpload}
        hapticKind={null}
        accessibilityRole="button"
        className="rounded-full bg-primary px-6 py-3"
      >
        <Text className="text-sm font-bold text-primary-foreground">지금 올리기</Text>
      </PressableScale>
    </View>
  )
}
```

- [ ] **Step 3: 타입·린트를 돌린다**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Expected: 통과. `BoardHeader`의 prop 이름이 다르면 `src/widgets/board-header/index.tsx`를 보고 맞춘다.

- [ ] **Step 4: 시뮬레이터에서 실제로 확인한다**

```bash
pnpm ios
```

확인할 것 — **하나라도 안 되면 다음 태스크로 넘어가지 않는다:**

| 확인 | 기대 |
| --- | --- |
| 스트림이 시각순으로 뜬다 | 밴드 헤더가 「12–14시」 형태, 기록 없는 밴드는 없음 |
| 세로 스크롤 | 부드럽게 스크롤되고 날짜가 넘어가지 않는다 |
| 가로 스와이프 | 날짜가 넘어가고 스트림이 맨 위로 돌아간다 |
| 사진 탭 | 상세가 열린다. **날짜가 넘어가지 않는다** (UX_FINDINGS B항 회귀 확인) |
| 카드 위 가로 스와이프 | 날짜가 넘어가고 상세가 열리지 않는다 |
| 리액션 칩 탭 | 카운트가 즉시 바뀐다 |
| 멤버 줄 | 올린 사람은 배지 숫자, 안 올린 사람은 점선 |
| 빈 날 | 「이 날은 아무도 안 올렸어요」 + 「지금 올리기」 |

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/board.tsx"
git commit -m "$(cat <<'EOF'
feat(board): 슬롯 격자를 시간 밴드 스트림으로 재작성

축 판정을 직접 하지 않고 RNGH의 activeOffsetX·failOffsetY에 맡긴다. 세로가
끼니 이동이던 시절에는 두 축을 직접 갈라야 했고 그 판정이 사진 탭과 겹쳐 친구
사진을 누르면 끼니가 넘어갔다(UX_FINDINGS B항). 세로가 순수 스크롤이 되면서
그 로직이 필요 없어졌다.

날짜가 갈리면 스트림을 맨 위로 돌린다 — 카드 수가 달라 어제의 스크롤 위치를
물려받으면 엉뚱한 지점에 착지한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: 프로필 · 캘린더 · 상세의 끼니 표시 정리

**Files:**
- Modify: `src/app/(app)/profile.tsx`
- Modify: `src/features/calendar/ui/DayTimeline.tsx`
- Modify: `src/widgets/post-detail/index.tsx`
- Modify: `src/entities/post/board.ts` (`mealTimeLabel`)

**Interfaces:**
- Consumes: `mealTimeLabel`, `MealTag`
- Produces: `mealTimeLabel(recordedAt, tag: string | null)` — `slotLabel` 경유를 없애고 태그를 그대로 쓴다

- [ ] **Step 1: `mealTimeLabel`이 태그를 그대로 쓰게 한다**

`src/entities/post/board.ts`의 `mealTimeLabel`을 교체한다:

```ts
/**
 * 끼니 태그 + 섭취 시각 한 줄 라벨 — 「점심 · 12:34」.
 * 프로필 그리드 오버레이 칩처럼 좁은 자리에 쓰므로 짧게 유지한다.
 * 태그가 없으면 시각만, 시각을 못 읽으면 태그만(둘 다 없으면 빈 문자열).
 *
 * 예전에는 `slotLabel(key)`로 고정 4값을 한국어로 바꿨다. 이제 값 자체가
 * 사용자가 쓴 한국어라 변환이 없다.
 */
export function mealTimeLabel(
  recordedAt: string | null | undefined,
  mealTag: string | null | undefined,
): string {
  const tag = mealTag ?? ''
  const date = recordedAt ? new Date(recordedAt) : null
  if (!date || Number.isNaN(date.getTime())) return tag

  const time = hhmmFromDate(date)
  return tag ? `${tag} · ${time}` : time
}
```

- [ ] **Step 2: `slotLabel` 호출부를 찾아 없앤다**

```bash
grep -rn "slotLabel\|MEAL_SLOTS\|MealSlotChips" src
```

각 호출부에서 `slotLabel(post.meal_slot)` → `post.meal_slot ?? ''`로 바꾼다.
`MealSlotChips`를 쓰는 곳은 Task 9에서 이미 `MealTagField`로 바뀌었어야 한다 —
남아 있으면 지금 바꾼다.

- [ ] **Step 3: 검증 후 커밋**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm lint
git add src/entities/post/board.ts "src/app/(app)/profile.tsx" src/features/calendar src/widgets/post-detail
git commit -m "$(cat <<'EOF'
refactor(post): 끼니 표시에서 고정값 변환 제거

값 자체가 사용자가 쓴 한국어라 slotLabel 변환이 필요 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: 슬롯 코드 삭제 + 최종 검증 + PR

**Files:**
- Delete: `src/widgets/slot-board/` (`index.tsx`, `layout.ts`, `layout.test.ts`)
- Delete: `src/widgets/slot-chips/`
- Delete: `src/widgets/meal-tile/`
- Delete: `src/entities/post/slot-progress.ts`, `src/entities/post/slot-progress.test.ts`
- Delete: `src/features/board-nav/` (`axis.ts`, `axis.test.ts`, `index.ts`)
- Delete: `src/entities/post/ui/MealSlotChips.tsx`
- Modify: `src/entities/post/board.ts` (`MEAL_SLOTS`·`slotLabel`·`buildSlotBoard`·`Tile`·`SlotBoard`·`MealSlotKey` 제거)
- Modify: `src/entities/post/board.test.ts` (타일 격자 테스트 삭제)
- Modify: `src/entities/post/index.ts` (배럴 정리)

**Interfaces:**
- Consumes: Task 5~13이 모든 소비자를 옮겨 놓은 상태
- Produces: 없음 (삭제)

- [ ] **Step 1: 남은 참조가 없는지 확인한다**

```bash
cd ~/github/nyom-app
grep -rn "slot-board\|slot-chips\|meal-tile\|slot-progress\|board-nav\|MealSlotChips\|buildSlotBoard\|MEAL_SLOTS\|slotLabel\|MealSlotKey\|clampSlotIdx\|decideAxis" src
```

Expected: 삭제 대상 파일 **자기 자신 안의 참조만** 남는다. `src/app`·`src/widgets`(삭제 대상 제외)·`src/features`에서 나오면 그 소비자를 먼저 옮긴다.

- [ ] **Step 2: 파일을 삭제한다**

```bash
cd ~/github/nyom-app
git rm -r src/widgets/slot-board src/widgets/slot-chips src/widgets/meal-tile src/features/board-nav
git rm src/entities/post/slot-progress.ts src/entities/post/slot-progress.test.ts
git rm src/entities/post/ui/MealSlotChips.tsx
```

`src/entities/post/ui/`가 비었으면 디렉터리도 사라진다 — 확인만 하고 넘어간다.

- [ ] **Step 3: `board.ts`에서 죽은 코드를 지운다**

`src/entities/post/board.ts`에서 다음을 **삭제**한다:
- `MEAL_SLOTS`
- `slotLabel`
- `buildSlotBoard`
- `type Tile`, `type SlotBoard`, `type MemberLike`, `type PostLike`
- `type MealSlotKey`(deprecated 별칭)

**남기는 것:** `type MealTag`, `mealTimeLabel`, `defaultSlotForHour`.

파일이 3개 함수만 남으므로 상단 주석을 갱신한다:

```ts
import { hhmmFromDate } from './date-range'

/** 끼니 태그 — 사용자 자유 입력 문자열. 정규화는 normalizeMealTag가 맡는다. */
export type MealTag = string
```

- [ ] **Step 4: `board.test.ts`에서 타일 격자 테스트를 지운다**

`buildSlotBoard`를 검증하는 describe 블록 전체를 삭제한다. `defaultSlotForHour`와
`mealTimeLabel` 블록만 남긴다. 대상 코드가 없어졌으므로 남기면 거짓 신호가 된다.

- [ ] **Step 5: 배럴을 정리한다**

`src/entities/post/index.ts`:

```ts
export { mealTimeLabel, defaultSlotForHour, type MealTag } from './board'
export { BAND_HOURS, groupByTimeBand, type BandItem } from './time-band'
export {
  normalizeMealTag,
  bandRangeLabel,
  timeBucketOf,
  MEAL_TAG_MAX_LENGTH,
  TAG_SEEDS,
  type TimeBucket,
} from './meal-tag'
export { recentTags, RECENT_TAGS_LIMIT, type TaggedRow } from './recent-tags'
export {
  dayRangeFromOffset,
  dateFromOffset,
  offsetFromDate,
  dateLabel,
  localDayKey,
  hhmmFromDate,
} from './date-range'
export { dateHeading, type DateHeading } from './date-heading'
export { dedupeByBatch } from './dedupe'
export { parseLocalDate, deeplinkTarget, type DeeplinkTarget } from './deeplink'
```

- [ ] **Step 6: 전체 검증**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm lint
```

Expected:
- vitest: 전부 통과. 삭제된 테스트만큼 개수가 줄고 신규 37개가 늘어난다
- tsc: 에러 0
- lint: 에러 0, **경고 0**

- [ ] **Step 7: 시뮬레이터 최종 확인**

```bash
pnpm ios
```

Task 12 Step 4의 표를 다시 돌리고, 추가로:

| 확인 | 기대 |
| --- | --- |
| 업로드 → 태그 자동값 | 시각에 맞는 태그가 이미 채워져 있고 그대로 게시된다 |
| 업로드 → 태그 칩 탭 | 최근 태그가 뜨고, 원탭으로 바뀐다 |
| 업로드 → 직접 입력 | 8자까지 입력되고 저장된다 |
| 새 태그로 게시 후 재업로드 | 방금 쓴 태그가 최근 목록에 나타난다 |
| 사후 편집 → 태그 변경 | 스트림 카드의 태그 칩이 바뀐다 |
| 프로필 그리드 | 태그 · 시각 칩이 정상 표시 |
| 돌아보기 타임라인 | 태그가 정상 표시 |

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: 슬롯 격자 코드 삭제

소비자를 모두 스트림으로 옮긴 뒤의 정리다. slot-board·slot-chips·meal-tile·
slot-progress·board-nav와 board.ts의 MEAL_SLOTS·buildSlotBoard·MealSlotKey를
지운다.

타일 격자 테스트도 함께 지운다 — 대상 코드가 없는 테스트는 거짓 신호다.

board-nav는 세로가 끼니 이동이라 필요했던 축 판정이었다. 세로가 순수 스크롤이
되면서 RNGH 옵션으로 대체됐다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: PR을 올린다**

```bash
cd ~/github/nyom-app
git push -u origin feat/time-band-stream
gh pr create --title "feat(board): 시간 밴드 스트림 + 자유 끼니 태그" --body "$(cat <<'EOF'
고정 4끼니 타일 격자 보드를 2시간 밴드 스트림으로 바꾸고, 끼니를 사용자가 쓰는
자유 태그로 만듭니다.

- 스펙: `docs/superpowers/specs/2026-08-31-time-band-stream-design.md`
- 계획: `docs/superpowers/plans/2026-08-31-time-band-stream.md`

## 왜

1. **칸이 부족했다.** 점심과 저녁 사이에 간식을 3번 먹으면 「점심」 칸 하나에
   대표 1장 + `+2`로 묶여 3번 먹은 사실이 사라졌다.
2. **칸이 제스처를 망가뜨렸다.** 세로=끼니 / 가로=날짜 두 축을 직접 판정하느라
   사진 탭이 끼니를 넘겼다(`docs/UX_FINDINGS.md` B항 — 웹앱에서 실측된 문제).

## 무엇이 바뀌나

- 보드가 시각순 카드 스트림. **사진이 화면 폭을 다 쓴다**
- 2시간 밴드로 묶음. 밴드는 `recorded_at`에서 파생 — 테이블 없음, `BAND_HOURS` 상수 하나
- 끼니는 자유 태그(최대 8자). 섭취 시각으로 자동 채워지고 탭하면 최근 태그 원탭 재사용
- 상단 멤버 줄이 「누가 몇 개 올렸나 / 누가 안 올렸나」를 대신한다
- 알림 딥링크가 슬롯 인덱스 → 게시물 id
- 축 판정 로직(`board-nav`)·슬롯 위젯 3개·`slot-progress` 삭제

## 통계는 태그가 아니라 시각대로

자유 문자열은 집계 키로 쓸 수 없다(「간식」과 「간식 」이 다른 값). 돌아보기·프로필
통계는 `recorded_at`의 6구간 시각대에서 파생한다.

## 밴드 헤더에 이름을 붙이지 않은 이유

「점심 12–14시」로 쓰면 15:20 기록이 태그는 「점심」인데 헤더는 「오후」가 되어
모순으로 읽힌다. 밴드·태그 자동값·통계 시각대는 경계가 일부러 다르다.

## 백엔드

`hyorish03/nyom`의 `feat/meal-tag-freeform` PR이 **먼저 머지돼야 합니다.**
`normalize_meal_tag` 함수와 `posts` 정규화 트리거가 거기 있습니다.

## 확인한 것

- 유닛 테스트 전부 통과 / `tsc --noEmit` 클린 / 린트 에러 0 · 경고 0
- 앱 `normalizeMealTag`와 DB `normalize_meal_tag`가 같은 결과 (8케이스 대조)
- 시뮬레이터: 사진 탭이 날짜를 넘기지 않음(B항 회귀), 세로 스크롤/가로 스와이프 분리,
  태그 자동값·최근 태그·직접 입력, 사후 편집 반영

## 알려진 제약

- 스트림이 길어질 때(4명 × 3회 = 카드 12장) 페이지네이션은 넣지 않았습니다.
  실사용 후 판단합니다.
- 「안 올린 사람 점선」이 압박으로 읽히는지는 써보고 판단합니다.
- `meal_slot` 컬럼명은 의미가 「태그」로 바뀌었지만 그대로 뒀습니다(부채).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 항목 | 태스크 |
| --- | --- |
| 결정 1 (통합 스트림) | Task 12 |
| 결정 2 (2시간 밴드, `BAND_HOURS`) | Task 1, 12 |
| 결정 3 (자유 문자열 태그) | Task 4, 5 |
| 결정 4 (자동 채움 + 탭해서 고침) | Task 7, 8 |
| 결정 5 (1개, 8자) | Task 2, 4 |
| 결정 6 (통계는 시각대) | Task 2 (`timeBucketOf`) |
| 결정 7 (멤버 아바타 줄) | Task 11 |
| 결정 8 (웹 미동기화) | 명시적 비작업 — Task 4 PR 본문에 영향 기재 |
| 데이터 모델 (제약·정규화·정렬) | Task 4, 5 |
| 세 가지 시간 구간 구분 | Task 2 (`bandRangeLabel` 주석), Task 11 |
| 화면 — 보드/빈 상태/태그 입력 | Task 12, 7 |
| 백엔드 6단계 | Task 4 |
| 보안 (DB 트리거 정규화) | Task 4 Step 3, 8 |
| 앱 변경 신설 7 / 삭제 6 / 수정 9 | Task 7·10·11 / Task 14 / Task 5·6·8·9·12·13 |
| 테스트 (삭제 + 신규) | Task 14 Step 4 / Task 1·2·3·6·9·11 |
| 마이그레이션 순서 | Task 4 → Task 14 PR 순서로 강제 |

빠진 항목 없음.

**2. 플레이스홀더 스캔**

Task 4 Step 4·5가 「기존 함수 본문을 옮겨 온다」로 되어 있다. 이건 플레이스홀더가
아니라 **의도된 지시**다 — `update_post_batch`는 100줄이 넘고 이 스펙이 바꾸는 건
두 줄이라, 전체를 여기 복사하면 원본과 갈라질 위험이 더 크다. 바꿀 지점을
정확히 지정했고(Step 1에서 원본을 먼저 읽게 한다) 검증 방법도 있다(Step 6~8).

**3. 타입 일관성**

- `MealTag = string`이 Task 5에서 정의되고 Task 7·10·13에서 쓰인다 ✓
- `deeplinkTarget`이 Task 6에서 `{ dateOffset, postId }`로 바뀌고 Task 12가 `initialTarget.postId`를 쓴다 ✓
- `groupByTimeBand`가 `BandItem<P>[]`(`startHour`, `posts`)를 돌려주고 Task 12가 `band.startHour`·`band.posts`로 쓴다 ✓
- `ReactionBar`가 Task 10 Step 1에서 `widgets/reaction-bar`로 옮겨지고 Task 10 Step 2가 그 경로로 import한다 ✓
- `memberPostCounts`가 Task 11에서 `{ member, count }[]`를 돌려주고 같은 태스크의 `MemberStrip`이 쓴다 ✓
- `recentTags`가 `string[]`을 돌려주고 Task 8의 `useMyRecentTags` → Task 7의 `suggestions: string[]`로 흐른다 ✓
- `normalizeMealTag`가 Task 2에서 정의되고 Task 4(SQL 대조)·7·9에서 쓰인다 ✓
- `mealTagChange`가 Task 9에서 정의되고 같은 태스크의 `PostEditSheet`가 쓴다 ✓

**4. 커밋마다 컴파일되나**

Task 5가 `MealSlotKey`를 `string` 별칭으로 남기는 것이 이 계획의 핵심 장치다.
그래서 Task 5~13의 어느 커밋에서도 슬롯 코드와 태그 코드가 공존하며 컴파일된다.
삭제는 소비자를 다 옮긴 Task 14에서만 일어난다.
