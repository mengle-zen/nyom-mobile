import type { NotificationSettingsRow } from '@/types/database'

/** 알림 종류 키 — DB 컬럼명(`*_enabled`)에서 접미사를 뗀 값과 1:1 대응한다. */
export type NotificationKind = 'post' | 'reaction' | 'reminder'

/** 종류별 on/off. 화면과 mutation이 공통으로 쓰는 형태. */
export type NotificationSettings = Record<NotificationKind, boolean>

/**
 * 기본값은 전부 true.
 * DB 쪽도 default true + `coalesce(..., true)`이므로, 설정 화면에 한 번도
 * 들어오지 않은 사용자는 프론트/백엔드 모두 "전부 수신"으로 일치한다.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  post: true,
  reaction: true,
  reminder: true,
}

/** 토글 목록 렌더 순서·라벨·설명. 화면과 테스트가 같은 출처를 쓴다. */
export const NOTIFICATION_KIND_META: ReadonlyArray<{
  kind: NotificationKind
  label: string
  description: string
}> = [
  {
    kind: 'post',
    label: '게시 알림',
    description: '그룹 멤버가 끼니를 올렸을 때 알려드려요',
  },
  {
    kind: 'reaction',
    label: '반응 알림',
    description: '내 기록에 반응이 달렸을 때 알려드려요',
  },
  {
    kind: 'reminder',
    label: '리마인더',
    description: '저녁에 오늘 기록이 없으면 한 번만 알려드려요',
  },
]

/**
 * DB row → 화면 형태. row가 없으면(=설정 화면에 들어온 적 없는 사용자)
 * 기본값 전부 true. null/undefined 컬럼도 기본값으로 메운다.
 */
export function toNotificationSettings(
  row: Partial<NotificationSettingsRow> | null | undefined,
): NotificationSettings {
  if (!row) return { ...DEFAULT_NOTIFICATION_SETTINGS }
  return {
    post: row.post_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.post,
    reaction: row.reaction_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.reaction,
    reminder: row.reminder_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.reminder,
  }
}

/** 화면 형태 → DB 컬럼 형태(upsert payload에 사용) */
export function toSettingsColumns(
  settings: NotificationSettings,
): Pick<
  NotificationSettingsRow,
  'post_enabled' | 'reaction_enabled' | 'reminder_enabled'
> {
  return {
    post_enabled: settings.post,
    reaction_enabled: settings.reaction,
    reminder_enabled: settings.reminder,
  }
}

/** 한 종류만 바꾼 새 설정(불변). 낙관적 업데이트에서 캐시 갱신용. */
export function withKind(
  settings: NotificationSettings,
  kind: NotificationKind,
  enabled: boolean,
): NotificationSettings {
  return { ...settings, [kind]: enabled }
}

