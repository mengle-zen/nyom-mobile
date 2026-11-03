/**
 * 지금 화면에 떠 있는 방 채팅. 그 방의 채팅 푸시는 앱 안 배너로 띄우지 않는다 —
 * 같은 메시지가 바로 아래 목록에 실시간으로 들어오고 있기 때문이다.
 *
 * 알림 핸들러는 React 밖(전역 콜백)에서 불리므로 모듈 변수로 둔다.
 */
let activeChatGroupId: string | null = null

/** 채팅 화면이 포커스를 얻으면 방 id, 잃으면 null. */
export function setActiveChatGroup(groupId: string | null): void {
  activeChatGroupId = groupId
}

export function getActiveChatGroup(): string | null {
  return activeChatGroupId
}
