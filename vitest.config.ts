import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// 순수 로직(끼니 버킷팅·날짜·리액션·제스처 판정) 전용 러너.
// 이 파일들은 웹앱(nyom)과 바이트 단위로 같고 플랫폼 의존이 없어 그대로 돈다.
// RN 컴포넌트 테스트는 별도 과제 — 여기서는 수집하지 않는다.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'src/**/*.test.tsx'],
  },
})
