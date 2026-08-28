import { describe, it, expect } from 'vitest'
import { avatarObjectPath, orphanAvatarPaths } from './avatar'

describe('avatarObjectPath', () => {
  it('첫 세그먼트가 user_id여야 RLS를 통과한다', () => {
    expect(avatarObjectPath('user-1', 'abc')).toBe('user-1/abc.jpg')
  })
})

describe('orphanAvatarPaths', () => {
  it('방금 올린 파일만 남기고 나머지를 정리 대상으로 본다', () => {
    expect(orphanAvatarPaths('u1', ['a.jpg', 'b.jpg', 'c.jpg'], 'b.jpg')).toEqual([
      'u1/a.jpg',
      'u1/c.jpg',
    ])
  })

  it('supabase가 만드는 빈 폴더 placeholder는 건드리지 않는다', () => {
    expect(
      orphanAvatarPaths('u1', ['.emptyFolderPlaceholder', 'new.jpg'], 'new.jpg'),
    ).toEqual([])
  })

  it('정리할 게 없으면 빈 배열', () => {
    expect(orphanAvatarPaths('u1', ['only.jpg'], 'only.jpg')).toEqual([])
  })
})
