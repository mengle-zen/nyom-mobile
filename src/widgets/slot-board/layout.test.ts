import { describe, it, expect } from 'vitest'
import { MAX_TILE_WIDE, slotBoardLayout, slotCountLabel } from './layout'

describe('slotBoardLayout', () => {
  const GRID = { width: 378, height: 540 }
  const GAP = 8

  it('1~2명은 한 줄(위아래), 3명 이상은 두 줄', () => {
    expect(slotBoardLayout(1, GRID, GAP).cols).toBe(1)
    expect(slotBoardLayout(2, GRID, GAP).cols).toBe(1)
    expect(slotBoardLayout(3, GRID, GAP).cols).toBe(2)
    expect(slotBoardLayout(6, GRID, GAP)).toMatchObject({ cols: 2, rows: 3 })
    expect(slotBoardLayout(8, GRID, GAP)).toMatchObject({ cols: 2, rows: 4 })
  })

  it('타일은 세로로 정사각보다 길어지지 않고, 가로는 4:3까지만 납작해진다', () => {
    for (let n = 1; n <= 8; n++) {
      const { tileWidth, tileHeight } = slotBoardLayout(n, GRID, GAP)
      expect(tileHeight).toBeLessThanOrEqual(tileWidth + 1e-9)
      expect(tileWidth / tileHeight).toBeLessThanOrEqual(MAX_TILE_WIDE + 1e-9)
    }
  })

  it('정원 8명까지 스크롤 없이 격자 안에 들어간다', () => {
    for (let n = 1; n <= 8; n++) {
      const { cols, rows, tileWidth, tileHeight } = slotBoardLayout(n, GRID, GAP)
      expect(cols * tileWidth + GAP * (cols - 1)).toBeLessThanOrEqual(GRID.width + 1e-9)
      expect(rows * tileHeight + GAP * (rows - 1)).toBeLessThanOrEqual(GRID.height + 1e-9)
    }
  })

  it('6명은 화면을 거의 꽉 채운다(2·2·2)', () => {
    const { tileWidth, tileHeight } = slotBoardLayout(6, GRID, GAP)
    expect(tileWidth).toBeCloseTo(185)
    expect(tileHeight).toBeCloseTo((540 - 16) / 3)
  })

  it('2명은 옆으로 나란히(185)보다 위아래로 쌓을 때 더 크다', () => {
    const { tileWidth, tileHeight } = slotBoardLayout(2, GRID, GAP)
    expect(tileHeight).toBeGreaterThan(185)
    expect(tileWidth).toBeGreaterThan(185)
  })

  it('격자를 아직 못 쟀으면 크기 0, 멤버 0명은 1명과 같은 모양', () => {
    expect(slotBoardLayout(3, { width: 0, height: 0 }, GAP)).toMatchObject({ tileWidth: 0, tileHeight: 0 })
    expect(slotBoardLayout(0, GRID, GAP)).toEqual(slotBoardLayout(1, GRID, GAP))
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
