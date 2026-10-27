import type { JoinGroupError } from '@/entities/group'

/** 초대코드 참여 실패 코드 → 사용자용 메시지 */
export const JOIN_ERROR_MSG: Record<JoinGroupError, string> = {
  RATE_LIMITED: '시도 횟수를 초과했어요. 한 시간 후 다시 시도해 주세요',
  NOT_FOUND: '코드를 다시 확인해 주세요',
  ALREADY_MEMBER: '이미 참여 중인 그룹이에요',
  FULL: '이 그룹은 정원이 찼어요',
  BANNED: '이 그룹에 참여할 수 없어요',
  UNKNOWN: '잠시 후 다시 시도해 주세요',
}

/**
 * 그룹 정원. 방 화면 시간 띠가 네 열까지 읽혀 4명으로 줄였다(2026-10-27).
 * 서버 join_group_by_code·approve_join_request의 GROUP_FULL 기준과 같아야 한다
 * (웹 20261027000000_time_lanes.sql). 웹앱 상수는 아직 8이다.
 */
export const MAX_MEMBERS = 4
