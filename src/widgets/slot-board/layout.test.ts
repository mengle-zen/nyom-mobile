import { describe, it, expect } from 'vitest'
import { slotBoardLayout, slotCountLabel } from './layout'

describe('slotBoardLayout', () => {
  it('타일은 인원과 무관하게 항상 정사각 — 같은 사진이 다르게 잘리지 않는다', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(slotBoardLayout(n).maxAspect).toBe(1)
    }
  })

  it('인원이 늘면 행이 아니라 열을 늘린다 (보드는 스크롤하지 않는다)', () => {
    expect(slotBoardLayout(1).cols).toBe(1)
    expect(slotBoardLayout(2).cols).toBe(2)
    expect(slotBoardLayout(4).cols).toBe(2)
    expect(slotBoardLayout(5).cols).toBe(3)
    expect(slotBoardLayout(8).cols).toBe(3)
  })

  it('멤버가 0명이어도 1명과 같은 안전한 모양', () => {
    expect(slotBoardLayout(0)).toEqual(slotBoardLayout(1))
  })

  it('정사각 상한이 항상 있으므로 항상 가운데로 모은다', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 7, 8]) {
      expect(slotBoardLayout(n).center).toBe(true)
    }
  })

  it('정원 8명까지 정사각으로 화면에 들어간다', () => {
    // 격자 폭 378 · gap 8 · 가용 높이 540 기준. 필요 높이 = 행수 x 타일폭.
    const GRID = 378
    const GAP = 8
    const AVAILABLE = 540
    for (let n = 1; n <= 8; n++) {
      const { cols } = slotBoardLayout(n)
      const tile = (GRID - GAP * (cols - 1)) / cols
      const rows = Math.ceil(n / cols)
      const needed = rows * tile + GAP * (rows - 1)
      expect(needed).toBeLessThanOrEqual(AVAILABLE)
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
