import { describe, it, expect } from 'vitest'
import { dedupeByBatch } from './dedupe'

describe('dedupeByBatch', () => {
  it('같은 batch_id는 첫 행만 남긴다', () => {
    const rows = [
      { id: 'a', batch_id: 'b1' },
      { id: 'b', batch_id: 'b1' },
      { id: 'c', batch_id: 'b2' },
    ]
    expect(dedupeByBatch(rows).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('batch_id 없으면 id로 개별 유지', () => {
    const rows = [
      { id: 'a', batch_id: null },
      { id: 'b' },
      { id: 'c', batch_id: null },
    ]
    expect(dedupeByBatch(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('순서를 보존한다', () => {
    const rows = [
      { id: 'x', batch_id: 'b1' },
      { id: 'y', batch_id: 'b2' },
      { id: 'z', batch_id: 'b1' },
    ]
    expect(dedupeByBatch(rows).map((r) => r.id)).toEqual(['x', 'y'])
  })
})
