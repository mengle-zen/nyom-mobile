import { describe, it, expect } from 'vitest'
import { slotBoardLayout, slotCountLabel } from './layout'

describe('slotBoardLayout', () => {
  it('1명이면 1열 + 정사각 상한 + 가운데 정렬 (빈 타일이 화면을 다 먹지 않게)', () => {
    expect(slotBoardLayout(1)).toEqual({ cols: 1, maxAspect: 1, center: true })
  })

  it('멤버가 0명이어도 1명과 같은 안전한 모양', () => {
    expect(slotBoardLayout(0)).toEqual({ cols: 1, maxAspect: 1, center: true })
  })

  it('2명이면 1열 2행, 세로로 살짝 눌린 카드', () => {
    expect(slotBoardLayout(2)).toEqual({ cols: 1, maxAspect: 0.85, center: true })
  })

  it('3명 이상은 2열 — 타일이 저절로 세로 카드가 되어 상한이 필요 없다', () => {
    for (const n of [3, 4, 5, 8]) {
      expect(slotBoardLayout(n)).toEqual({ cols: 2, maxAspect: null, center: false })
    }
  })

  it('상한을 두는 경우에만 가운데로 모은다', () => {
    for (const n of [0, 1, 2, 3, 4, 7]) {
      const l = slotBoardLayout(n)
      expect(l.center).toBe(l.maxAspect !== null)
    }
  })
})

describe('slotCountLabel', () => {
  it('1인 그룹은 숫자를 세지 않는다', () => {
    expect(slotCountLabel(0, 1)).toBe('아직 안 올렸어요')
    expect(slotCountLabel(1, 1)).toBe('올렸어요')
  })

  it('여러 명이면 분수로', () => {
    expect(slotCountLabel(0, 3)).toBe('0/3 올림')
    expect(slotCountLabel(2, 3)).toBe('2/3 올림')
  })

  it('다 올렸으면 숫자보다 결론', () => {
    expect(slotCountLabel(3, 3)).toBe('모두 올렸어요')
    expect(slotCountLabel(2, 2)).toBe('모두 올렸어요')
  })

  it('멤버 목록이 아직 없으면 빈 문자열 — 「0/0 올림」을 띄우지 않는다', () => {
    expect(slotCountLabel(0, 0)).toBe('')
  })
})
