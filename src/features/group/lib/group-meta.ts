import type { GroupStats } from '@/entities/group'

export type GroupMeta = {
  /** '3명' */
  members: string
  /** '오늘 2명 올림' / '오늘 아직 없어요' */
  today: string
  /** 오늘 올린 사람이 있으면 true — 카드가 이 부분을 강조한다 */
  hasToday: boolean
}

/**
 * 그룹 카드 두 번째 줄의 조각들.
 *
 * 이 앱의 동기는 "친구들이 오늘 뭐 먹었나"인데 카드에 이름과 공개 여부만 있으면
 * 그걸 알려면 그룹마다 들어가 봐야 한다. 멤버 수와 오늘 올린 사람 수를 목록에
 * 노출하고, "오늘" 쪽만 색으로 띄워 스캔할 때 눈이 먼저 걸리게 한다.
 *
 * 0명일 때 '오늘 0명'이라고 쓰지 않는 이유: 숫자 0은 지표가 고장 난 것처럼
 * 읽힌다. "아직 없어요"는 같은 정보를 주면서 들어가 볼 이유도 남긴다.
 */
export function groupMeta(stats: GroupStats | undefined): GroupMeta | null {
  if (!stats) return null
  const hasToday = stats.todayPosterCount > 0
  return {
    members: `${stats.memberCount}명`,
    today: hasToday ? `오늘 ${stats.todayPosterCount}명 올림` : '오늘 아직 없어요',
    hasToday,
  }
}

/** 스크린리더·접근성 라벨용 한 줄 — '3명 · 오늘 2명 올림'. */
export function groupMetaLabel(stats: GroupStats | undefined): string | null {
  const meta = groupMeta(stats)
  return meta ? `${meta.members} · ${meta.today}` : null
}
