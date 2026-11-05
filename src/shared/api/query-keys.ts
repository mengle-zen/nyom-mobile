/**
 * queryKey 팩토리 — 모든 useQuery/invalidate가 같은 키를 쓰도록 한 곳에서 관리한다.
 */
export const queryKeys = {
  groups: {
    all: ['groups'] as const,
    mine: ['groups', 'mine'] as const,
    public: ['groups', 'public'] as const,
    members: (groupId: string) => ['groups', 'members', groupId] as const,
    /** 목록 카드 집계(멤버 수 · 오늘 올린 사람 수). key는 그룹 id 집합에 의존한다. */
    stats: (groupIdsKey: string) => ['groups', 'stats', groupIdsKey] as const,
    joinRequests: (groupId: string) => ['groups', 'joinRequests', groupId] as const,
  },
  board: (groupId: string, offset: number) => ['board', groupId, offset] as const,
  /** 한 방의 모든 날 보드. 기록 올림 푸시를 눌렀을 때 새 사진을 다시 받는다. */
  boardGroup: (groupId: string) => ['board', groupId] as const,
  recordedDays: (groupId: string) => ['recordedDays', groupId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  myPosts: (userId: string) => ['myPosts', userId] as const,
  myRecordedDays: (userId: string, ym: string) =>
    ['myPosts', userId, 'month', ym] as const,
  myDayPosts: (userId: string, dayKey: string) =>
    ['myPosts', userId, 'day', dayKey] as const,
  /** 사후 편집용 batch 현재 상태. myPosts 프리픽스 → 편집 후 함께 무효화된다. */
  postBatch: (userId: string, batchKey: string) =>
    ['myPosts', userId, 'batch', batchKey] as const,
  /** 내가 최근 쓴 끼니 태그. myPosts 프리픽스 → 올리기·편집 후 함께 무효화된다. */
  myRecentTags: (userId: string) => ['myPosts', userId, 'recentTags'] as const,
  /** 방 채팅 메시지(무한 스크롤, 최신 페이지가 먼저) */
  messages: (groupId: string) => ['messages', groupId] as const,
  /** 방마다 안 읽은 메시지 여부. key는 그룹 id 집합에 의존한다. */
  roomUnread: (groupIdsKey: string) => ['roomUnread', groupIdsKey] as const,
  roomUnreadAll: ['roomUnread'] as const,
  /** 사진 상세의 댓글(그 기록에 단 답장들) */
  postReplies: (postId: string) => ['postReplies', postId] as const,
  postRepliesAll: ['postReplies'] as const,
  /** 방 멤버들의 읽음 상태(메시지마다 안 읽은 사람 수) */
  roomReads: (groupId: string) => ['roomReads', groupId] as const,
  notificationSettings: (userId: string) =>
    ['notificationSettings', userId] as const,
} as const
