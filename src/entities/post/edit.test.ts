import { describe, it, expect } from 'vitest'
import {
  diffGroupSelection,
  sameGroupSelection,
  hasPostBatchChanges,
  postEditErrorMessage,
  type PostBatchDraft,
} from './edit'

describe('diffGroupSelection', () => {
  it('추가·제거를 나눠 낸다', () => {
    const { added, removed } = diffGroupSelection(['g1', 'g2'], ['g2', 'g3'])
    expect(added).toEqual(['g3'])
    expect(removed).toEqual(['g1'])
  })

  it('affected는 추가·제거·유지 전부의 합집합 (제거된 그룹 보드도 무효화해야 한다)', () => {
    const { affected } = diffGroupSelection(['g1', 'g2'], ['g2', 'g3'])
    expect(affected).toEqual(['g1', 'g2', 'g3'])
  })

  it('변경이 없으면 추가·제거 모두 비고 affected는 그대로', () => {
    const { added, removed, affected } = diffGroupSelection(['g1'], ['g1'])
    expect(added).toEqual([])
    expect(removed).toEqual([])
    expect(affected).toEqual(['g1'])
  })

  it('마지막 그룹까지 제거하면 removed에 전부 담긴다', () => {
    const { added, removed } = diffGroupSelection(['g1', 'g2'], [])
    expect(added).toEqual([])
    expect(removed).toEqual(['g1', 'g2'])
  })

  it('빈 상태에서의 추가', () => {
    expect(diffGroupSelection([], ['g1']).added).toEqual(['g1'])
  })

  it('중복 입력은 접는다', () => {
    const { added, affected } = diffGroupSelection(['g1', 'g1'], ['g1', 'g2', 'g2'])
    expect(added).toEqual(['g2'])
    expect(affected).toEqual(['g1', 'g2'])
  })
})

describe('sameGroupSelection', () => {
  it('순서가 달라도 같은 집합이면 true', () => {
    expect(sameGroupSelection(['g1', 'g2'], ['g2', 'g1'])).toBe(true)
  })
  it('중복은 무시', () => {
    expect(sameGroupSelection(['g1', 'g1'], ['g1'])).toBe(true)
  })
  it('개수가 다르면 false', () => {
    expect(sameGroupSelection(['g1'], ['g1', 'g2'])).toBe(false)
  })
  it('원소가 다르면 false', () => {
    expect(sameGroupSelection(['g1'], ['g2'])).toBe(false)
  })
  it('둘 다 비면 true', () => {
    expect(sameGroupSelection([], [])).toBe(true)
  })
})

describe('hasPostBatchChanges', () => {
  const base: PostBatchDraft = {
    groupIds: ['g1'],
    caption: '맛있었다',
    recordedTime: '12:30',
  }

  it('아무것도 안 바뀌면 false', () => {
    expect(hasPostBatchChanges(base, { ...base })).toBe(false)
  })

  it('메모 변경 → true', () => {
    expect(hasPostBatchChanges(base, { ...base, caption: '별로였다' })).toBe(true)
  })

  it('메모의 앞뒤 공백만 다르면 변경 아님 (서버도 trim 후 저장)', () => {
    expect(hasPostBatchChanges(base, { ...base, caption: '  맛있었다  ' })).toBe(false)
  })

  it('메모를 지우면 → true', () => {
    expect(hasPostBatchChanges(base, { ...base, caption: '' })).toBe(true)
  })

  it('시각 변경 → true', () => {
    expect(hasPostBatchChanges(base, { ...base, recordedTime: '13:00' })).toBe(true)
  })

  it('그룹 추가 → true', () => {
    expect(hasPostBatchChanges(base, { ...base, groupIds: ['g1', 'g2'] })).toBe(true)
  })

  it('그룹 순서만 다르면 변경 아님', () => {
    const before = { ...base, groupIds: ['g1', 'g2'] }
    expect(hasPostBatchChanges(before, { ...base, groupIds: ['g2', 'g1'] })).toBe(false)
  })

  it('그룹을 전부 비우면 → true (삭제 확인 흐름으로 간다)', () => {
    expect(hasPostBatchChanges(base, { ...base, groupIds: [] })).toBe(true)
  })
})

describe('postEditErrorMessage', () => {
  it('RPC 에러 코드를 사용자 문구로 바꾼다', () => {
    expect(postEditErrorMessage(new Error('NOT_GROUP_MEMBER'))).toContain('그룹 멤버')
    expect(postEditErrorMessage(new Error('RECORDED_AT_FUTURE'))).toContain('시각')
    expect(postEditErrorMessage(new Error('RECORDED_AT_DATE_CHANGED'))).toContain('시:분')
    expect(postEditErrorMessage(new Error('CAPTION_TOO_LONG'))).toContain('100자')
    expect(postEditErrorMessage(new Error('NO_GROUP_SELECTED'))).toContain('하나 이상')
    expect(postEditErrorMessage(new Error('POST_NOT_FOUND'))).toContain('찾을 수 없어요')
  })

  it('Postgres가 앞에 붙이는 접두사가 있어도 인식한다', () => {
    const err = new Error('P0001: NOT_GROUP_MEMBER')
    expect(postEditErrorMessage(err)).toContain('그룹 멤버')
  })

  it('모르는 에러는 일반 문구', () => {
    expect(postEditErrorMessage(new Error('boom'))).toContain('다시 시도')
    expect(postEditErrorMessage(null)).toContain('다시 시도')
  })
})
