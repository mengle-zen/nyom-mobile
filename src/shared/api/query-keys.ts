/**
 * queryKey 팩토리 — 모든 useQuery/invalidate가 같은 키를 쓰도록 한 곳에서 관리한다.
 */
export const queryKeys = {
  groups: {
    all: ['groups'] as const,
    mine: ['groups', 'mine'] as const,
    public: ['groups', 'public'] as const,
    members: (groupId: string) => ['groups', 'members', groupId] as const,
    joinRequests: (groupId: string) => ['groups', 'joinRequests', groupId] as const,
  },
  board: (groupId: string, offset: number) => ['board', groupId, offset] as const,
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
  notificationSettings: (userId: string) =>
    ['notificationSettings', userId] as const,
} as const
