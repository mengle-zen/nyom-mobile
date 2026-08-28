export type ReactionLite = { user_id: string; emoji: string }

/**
 * 1인 1리액션 토글 결과를 계산한다.
 * - 내가 같은 이모지를 누르면 해제
 * - 다른 이모지를 누르면 교체(내 기존 것 제거 후 추가)
 * - 남의 리액션은 그대로 둔다
 */
export function nextReactions<T extends ReactionLite>(
  reactions: T[],
  userId: string,
  emoji: string,
): (T | ReactionLite)[] {
  const mine = reactions.find((r) => r.user_id === userId)
  const others = reactions.filter((r) => r.user_id !== userId)

  if (mine && mine.emoji === emoji) return others // 해제
  return [...others, { user_id: userId, emoji }] // 추가 또는 교체
}
