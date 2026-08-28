import { describe, expect, it } from 'vitest'
import { isOptimisticGroup, makeOptimisticGroup } from './optimistic'

describe('makeOptimisticGroup', () => {
  it('입력한 이름과 소유자로 자리표시 행을 만든다', () => {
    const g = makeOptimisticGroup('점심팟', 'u1', new Date('2026-08-28T03:00:00Z'))
    expect(g.name).toBe('점심팟')
    expect(g.created_by).toBe('u1')
    expect(g.is_public).toBe(false)
    expect(g.created_at).toBe('2026-08-28T03:00:00.000Z')
  })

  it('자리표시로 식별된다', () => {
    const g = makeOptimisticGroup('점심팟', 'u1')
    expect(isOptimisticGroup(g)).toBe(true)
  })

  it('서버에서 온 행은 자리표시가 아니다', () => {
    expect(isOptimisticGroup({ id: '3f1c1a4e-0000-4000-8000-000000000000' })).toBe(false)
  })
})
