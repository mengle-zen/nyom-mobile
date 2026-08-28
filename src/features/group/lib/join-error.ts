import type { JoinGroupError } from '@/entities/group'

/** 초대코드 참여 실패 코드 → 사용자용 메시지 */
export const JOIN_ERROR_MSG: Record<JoinGroupError, string> = {
  NOT_FOUND: '코드를 다시 확인해 주세요',
  ALREADY_MEMBER: '이미 참여 중인 그룹이에요',
  FULL: '이 그룹은 정원이 찼어요',
  BANNED: '이 그룹에 참여할 수 없어요',
  UNKNOWN: '잠시 후 다시 시도해 주세요',
}

/** 그룹 정원 — 웹앱과 동일한 상수 */
export const MAX_MEMBERS = 8
