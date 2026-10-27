import { describe, expect, it } from 'vitest'
import { normalizePushTarget, parsePushUrl, MAX_DATE_OFFSET } from './push-url'

const NOW = new Date(2026, 7, 28, 12, 0, 0) // 2026-08-28 (월요일 아님, 값만 중요)

describe('parsePushUrl', () => {
  it('게시 알림 URL에서 group·date를 뽑고 끼니(slot·tag)는 버린다', () => {
    expect(
      parsePushUrl('/?group=abc-123&date=2026-08-27&slot=lunch'),
    ).toEqual({ group: 'abc-123', date: '2026-08-27' })
    expect(
      parsePushUrl('/?group=g&date=2026-10-21&tag=%EC%95%BC%EC%8B%9D'),
    ).toEqual({ group: 'g', date: '2026-10-21' })
  })

  it('slot이 없는 URL도 처리한다 (끼니 미지정 게시물)', () => {
    expect(parsePushUrl('/?group=abc&date=2026-08-27')).toEqual({
      group: 'abc',
      date: '2026-08-27',
    })
  })

  it('리마인더의 루트 URL은 빈 객체', () => {
    expect(parsePushUrl('/')).toEqual({})
  })

  it('url이 없거나 문자열이 아니면 빈 객체', () => {
    expect(parsePushUrl(undefined)).toEqual({})
    expect(parsePushUrl(null)).toEqual({})
    expect(parsePushUrl(42)).toEqual({})
    expect(parsePushUrl('')).toEqual({})
  })

  it('퍼센트 인코딩을 푼다', () => {
    expect(parsePushUrl('/?group=a%2Db')).toEqual({ group: 'a-b' })
  })

  it('빈 값과 모르는 키는 버린다', () => {
    expect(parsePushUrl('/?group=&date=2026-08-27&foo=bar')).toEqual({
      date: '2026-08-27',
    })
  })
})

describe('normalizePushTarget', () => {
  it('group이 없으면 null — 어느 보드로 갈지 알 수 없다', () => {
    expect(normalizePushTarget({}, NOW)).toBeNull()
    expect(normalizePushTarget({ date: '2026-08-27' }, NOW)).toBeNull()
  })

  it('정상 값은 그대로 통과한다', () => {
    expect(
      normalizePushTarget(
        { group: 'g1', date: '2026-08-27' },
        NOW,
      ),
    ).toEqual({ group: 'g1', date: '2026-08-27' })
  })

  it('오늘 날짜도 정확히 되돌린다', () => {
    expect(
      normalizePushTarget({ group: 'g1', date: '2026-08-28' }, NOW),
    ).toEqual({ group: 'g1', date: '2026-08-28' })
  })

  it('미래 날짜는 오늘로 폴백한다', () => {
    expect(
      normalizePushTarget({ group: 'g1', date: '2026-09-01' }, NOW),
    ).toEqual({ group: 'g1', date: '2026-08-28' })
  })

  it('보드 범위를 넘는 과거는 오늘로 폴백한다', () => {
    const tooOld = new Date(2026, 7, 28 - (MAX_DATE_OFFSET + 1))
    const key = `2026-08-${String(tooOld.getDate()).padStart(2, '0')}`
    expect(normalizePushTarget({ group: 'g1', date: key }, NOW)?.date).toBe(
      '2026-08-28',
    )
  })

  it('형식이 깨진 날짜는 오늘로 폴백한다', () => {
    expect(
      normalizePushTarget({ group: 'g1', date: '2026-13-99' }, NOW)?.date,
    ).toBe('2026-08-28')
  })
})
