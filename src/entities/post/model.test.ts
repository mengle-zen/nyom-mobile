import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPostBatch } from './model'

const { from, reply } = vi.hoisted(() => ({
  from: vi.fn(),
  reply: { data: [] as Record<string, unknown>[], error: null as Error | null },
}))
vi.mock('@/shared/api/supabase', () => ({ supabase: { from } }))
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn() }))
vi.mock('expo-file-system/legacy', () => ({ readAsStringAsync: vi.fn() }))

const departed = {
  id: 'departed', group_id: 'old-group', groups: null,
  caption: 'old caption', recorded_at: '2026-10-23T10:00:00Z', meal_slot: 'lunch', meal_tag: null,
}
const current = {
  id: 'current', group_id: 'current-group', groups: { id: 'current-group' },
  caption: 'saved caption', recorded_at: '2026-10-23T11:00:00Z', meal_slot: 'dinner', meal_tag: null,
}

describe('fetchPostBatch', () => {
  beforeEach(() => {
    reply.data = [departed, current]
    reply.error = null
    from.mockReset().mockReturnValue({
      select() { return this },
      eq() { return this },
      order() { return this },
      then(resolve: (value: typeof reply) => unknown) { return Promise.resolve(reply).then(resolve) },
    })
  })

  it('선택한 행이 탈퇴 그룹에 있으면 현재 그룹의 저장된 맥락을 편집한다', async () => {
    const result = await fetchPostBatch('author', { id: 'departed', batch_id: 'batch' })
    expect(result).toEqual({
      postId: 'current', caption: 'saved caption', recordedAt: current.recorded_at,
      tag: null,
      groupIds: ['current-group'],
    })
  })

  it('현재 그룹에서 선택한 행은 대표로 유지한다', async () => {
    expect((await fetchPostBatch('author', { id: 'current', batch_id: 'batch' })).postId).toBe('current')
  })

  it('편집 가능한 행이 없어도 본인 과거 기록을 다시 공유할 수 있다', async () => {
    reply.data = [departed]
    const result = await fetchPostBatch('author', { id: 'departed', batch_id: 'batch' })
    expect(result.postId).toBe('departed')
    expect(result.caption).toBe('old caption')
    expect(result.groupIds).toEqual([])
  })

  it('그룹이 없는 기존 본인 행은 계속 편집할 수 있다', async () => {
    reply.data = [{ ...departed, group_id: null }]
    const result = await fetchPostBatch('author', { id: 'departed', batch_id: null })
    expect(result.postId).toBe('departed')
    expect(result.groupIds).toEqual([])
  })

  it('조회 오류를 전달하고 없는 기록은 거절한다', async () => {
    reply.error = new Error('query failed')
    await expect(fetchPostBatch('author', { id: 'missing', batch_id: null })).rejects.toThrow('query failed')
    reply.error = null
    reply.data = []
    await expect(fetchPostBatch('author', { id: 'missing', batch_id: null })).rejects.toThrow('POST_NOT_FOUND')
  })
})
