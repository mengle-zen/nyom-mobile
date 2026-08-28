import { describe, expect, it } from 'vitest'
import {
  fallbackAfterCamera,
  REASON_CAMERA_UNAVAILABLE,
  REASON_DENIED_RETRYABLE,
  REASON_DENIED_SETTINGS,
} from './capture-source'

describe('fallbackAfterCamera', () => {
  it('취소는 선택 화면으로 — 업로드 화면을 벗어나지 않는다', () => {
    expect(fallbackAfterCamera({ kind: 'canceled' })).toEqual({ stage: 'choose' })
  })

  it('다시 물어볼 수 있는 권한 거부는 재시도를 권한다', () => {
    expect(fallbackAfterCamera({ kind: 'denied', canAskAgain: true })).toEqual({
      stage: 'blocked',
      reason: REASON_DENIED_RETRYABLE,
    })
  })

  it('영구 거부는 설정 경로를 알려준다', () => {
    expect(fallbackAfterCamera({ kind: 'denied', canAskAgain: false })).toEqual({
      stage: 'blocked',
      reason: REASON_DENIED_SETTINGS,
    })
  })

  it('카메라가 없는 기기(시뮬레이터)는 장치 부재로 안내한다', () => {
    expect(fallbackAfterCamera({ kind: 'unavailable' })).toEqual({
      stage: 'blocked',
      reason: REASON_CAMERA_UNAVAILABLE,
    })
  })

  it('막힌 경우의 안내는 항상 갤러리 경로를 남겨 둔다', () => {
    const blocked = [
      fallbackAfterCamera({ kind: 'denied', canAskAgain: true }),
      fallbackAfterCamera({ kind: 'denied', canAskAgain: false }),
      fallbackAfterCamera({ kind: 'unavailable' }),
    ]
    for (const f of blocked) {
      expect(f.stage).toBe('blocked')
      expect(f.stage === 'blocked' && f.reason).toContain('갤러리')
    }
  })
})
