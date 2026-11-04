import { describe, expect, it } from 'vitest'
import { isDefaultNickname, validateNickname } from './nickname'

const ID = 'ce21c9fe-1234-4abc-8def-0123456789ab'

describe('isDefaultNickname', () => {
  it('user_ + 내 id 앞 8자리면 기본값', () => {
    expect(isDefaultNickname('user_ce21c9fe', ID)).toBe(true)
  })
  it('다른 사람의 기본값이나 직접 정한 이름은 아니다', () => {
    expect(isDefaultNickname('user_00000000', ID)).toBe(false)
    expect(isDefaultNickname('재빈', ID)).toBe(false)
  })
  it('기본값은 12자를 넘어 그대로 저장할 수 없다', () => {
    expect(validateNickname('user_ce21c9fe')).not.toBeNull()
  })
})
