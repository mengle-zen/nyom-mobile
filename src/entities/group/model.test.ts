import { beforeEach, describe, expect, it, vi } from 'vitest'
import { joinByCode } from './model'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/shared/api/supabase', () => ({ supabase: { rpc } }))
vi.mock('@/entities/post', () => ({ dayRangeFromOffset: vi.fn() }))

describe('joinByCode', () => {
  beforeEach(() => rpc.mockReset())

  it('유효한 초대의 그룹을 반환한다', async () => {
    const group = { id: 'group', invite_code: 'A1B2C3D4E5F6' }
    rpc.mockResolvedValue({ data: group, error: null })
    await expect(joinByCode('A1B2C3D4E5F6')).resolves.toEqual(group)
    expect(rpc).toHaveBeenCalledWith('join_group_by_code', { p_invite_code: 'A1B2C3D4E5F6' })
  })

  it('실패 횟수를 보존하는 null 응답을 가입 성공으로 처리하지 않는다', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(joinByCode('MISS')).rejects.toThrow('NOT_FOUND')
  })

  it.each([
    ['INVITE_RATE_LIMITED', 'RATE_LIMITED'],
    ['GROUP_NOT_FOUND', 'NOT_FOUND'],
    ['ALREADY_MEMBER', 'ALREADY_MEMBER'],
    ['GROUP_FULL', 'FULL'],
    ['BANNED', 'BANNED'],
    ['unavailable', 'UNKNOWN'],
  ])('%s 오류를 %s로 처리한다', async (message, expected) => {
    rpc.mockResolvedValue({ data: null, error: { message } })
    await expect(joinByCode('A1B2C3D4E5F6')).rejects.toThrow(expected)
  })
})
