import type { ReactionLite } from './toggle'

/** 타일·상세에서 고를 수 있는 이모지. 1인 1리액션이라 이 중 하나만 켜진다. */
export const REACTION_EMOJIS = ['🤤', '❤️', '🔥', '😂'] as const

/** 화면에 그릴 리액션 칩 하나. */
export type ReactionCount = {
  emoji: string
  /** 1 이상 — 카운트 0인 칩은 만들지 않는다 */
  count: number
  /** 내가 누른 이모지인가 */
  mine: boolean
}

/**
 * 리액션 목록을 이모지별 카운트로 접는다. **카운트가 0인 이모지는 넣지 않는다.**
 *
 * 웹앱은 팔레트 4개를 카운트와 무관하게 항상 렌더해 타일 하단 1/4을 빈 칩이 먹었고,
 * 1인 1리액션인데 4개가 나열돼 여러 개 고를 수 있는 것처럼 보였다
 * (docs/UX_FINDINGS.md F항). 기본은 "달린 리액션만", 팔레트는 「+」로 펼친다.
 *
 * 정렬은 카운트 내림차순 → 팔레트 순서 → 그 외(이전 버전 이모지 등)는 뒤로.
 * 같은 값에서 순서가 흔들리면 탭하려던 칩이 움직이므로 완전 결정적으로 둔다.
 */
export function summarizeReactions(
  reactions: readonly ReactionLite[],
  userId: string,
): ReactionCount[] {
  const counts = new Map<string, number>()
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)

  const mine = myReactionEmoji(reactions, userId)
  const rank = (emoji: string) => {
    const i = (REACTION_EMOJIS as readonly string[]).indexOf(emoji)
    return i === -1 ? REACTION_EMOJIS.length : i
  }

  return Array.from(counts, ([emoji, count]) => ({
    emoji,
    count,
    mine: emoji === mine,
  })).sort(
    (a, b) =>
      b.count - a.count ||
      rank(a.emoji) - rank(b.emoji) ||
      a.emoji.localeCompare(b.emoji),
  )
}

/** 내가 누른 이모지(없으면 null). 1인 1리액션이므로 최대 하나다. */
export function myReactionEmoji(
  reactions: readonly ReactionLite[],
  userId: string,
): string | null {
  return reactions.find((r) => r.user_id === userId)?.emoji ?? null
}
