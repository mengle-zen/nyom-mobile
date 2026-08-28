import type { Group } from '@/types/database'

/**
 * 낙관적 그룹 행 — 서버 응답을 기다리는 동안 목록에 먼저 앉히는 자리표시.
 *
 * 생성·참여는 왕복이 눈에 보이는 동작이라(RPC + invalidate + refetch) 버튼을
 * 누른 뒤 목록이 몇백 ms 멈춰 있으면 "먹혔나?" 하고 한 번 더 누르게 된다.
 * 자리표시를 먼저 넣어 두면 목록이 즉시 반응하고, 실패하면 조용히 걷어낸다.
 *
 * id에 프리픽스를 박아 두는 이유: 이 행은 아직 서버에 없어 보드 진입·초대코드
 * 복사·설정이 모두 무의미하다. 카드가 프리픽스를 보고 동작을 잠근다.
 */
const PREFIX = 'optimistic:'

export function makeOptimisticGroup(
  name: string,
  userId: string,
  now: Date = new Date(),
): Group {
  return {
    id: `${PREFIX}${now.getTime()}`,
    name,
    invite_code: '',
    created_by: userId,
    is_public: false,
    created_at: now.toISOString(),
  }
}

export function isOptimisticGroup(group: { id: string }): boolean {
  return group.id.startsWith(PREFIX)
}
