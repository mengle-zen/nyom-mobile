import { describe, expect, it } from 'vitest'

import { capturedAtFromExif } from './captured-at'
import { defaultRecipients, recipientSummary, sendLabel } from './recipients'

describe('defaultRecipients', () => {
  const mine = ['a', 'b', 'c']

  it('보드에서 들고 온 그룹이 가장 먼저', () => {
    expect(defaultRecipients({ fromGroup: 'b', lastSent: ['a', 'c'], myGroupIds: mine })).toEqual(['b'])
  })

  it('들고 온 그룹이 없으면 마지막으로 보낸 그룹들', () => {
    expect(defaultRecipients({ lastSent: ['a', 'c'], myGroupIds: mine })).toEqual(['a', 'c'])
  })

  it('나간 그룹은 기억에서 걸러낸다', () => {
    expect(defaultRecipients({ lastSent: ['x', 'c'], myGroupIds: mine })).toEqual(['c'])
  })

  it('들고 온 그룹이 내 그룹이 아니면 무시', () => {
    expect(defaultRecipients({ fromGroup: 'x', lastSent: ['a'], myGroupIds: mine })).toEqual(['a'])
  })

  it('기억이 없고 그룹이 하나뿐이면 그 그룹', () => {
    expect(defaultRecipients({ lastSent: [], myGroupIds: ['only'] })).toEqual(['only'])
  })

  it('기억이 없고 그룹이 여럿이면 고르게 둔다', () => {
    expect(defaultRecipients({ lastSent: [], myGroupIds: mine })).toEqual([])
  })
})

describe('sendLabel / recipientSummary', () => {
  it('받는 곳 이름이 버튼에 들어간다', () => {
    expect(sendLabel(['점심 원정대'])).toBe('점심 원정대에 보내기')
    expect(sendLabel(['a', 'b'])).toBe('2곳에 보내기')
    expect(sendLabel([])).toBe('받는 곳을 골라 주세요')
  })

  it('요약은 첫 이름 + 나머지 수', () => {
    expect(recipientSummary(['점심 원정대', '회사 동기'])).toBe('점심 원정대 외 1곳')
    expect(recipientSummary([])).toBe('고르기')
  })
})

describe('capturedAtFromExif', () => {
  const now = new Date(2026, 9, 18, 12, 34, 0)

  it('오늘 찍은 사진은 EXIF 촬영 시각', () => {
    const t = capturedAtFromExif({ DateTimeOriginal: '2026:10:18 08:05:12' }, now)
    expect([t.getHours(), t.getMinutes()]).toEqual([8, 5])
  })

  it('어제 찍은 사진은 지금 시각(업로드는 오늘 고정)', () => {
    expect(capturedAtFromExif({ DateTimeOriginal: '2026:10:17 20:00:00' }, now)).toBe(now)
  })

  it('미래 시각이면 지금', () => {
    expect(capturedAtFromExif({ DateTimeOriginal: '2026:10:18 13:00:00' }, now)).toBe(now)
  })

  it('EXIF가 없거나 형식이 다르면 지금', () => {
    expect(capturedAtFromExif(null, now)).toBe(now)
    expect(capturedAtFromExif({ DateTimeOriginal: 'yesterday' }, now)).toBe(now)
  })

  it('DateTimeOriginal이 없으면 DateTime을 쓴다', () => {
    const t = capturedAtFromExif({ DateTime: '2026:10:18 11:00:00' }, now)
    expect(t.getHours()).toBe(11)
  })
})
