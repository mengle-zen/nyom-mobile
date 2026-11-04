/**
 * 강제 업데이트 기준. 웹이 정적 파일로 낸다(nyom 저장소 `public/app-version.json`).
 *
 * 서버를 옮기거나 API를 바꿔 옛 빌드가 더는 동작하지 않을 때 `minBuild`를 올리면,
 * 그보다 낮은 빌드는 닫을 수 없는 업데이트 안내를 띄운다. 플랫폼 항목이 없으면 검사하지 않는다.
 */
export const APP_VERSION_URL = 'https://nyom.vercel.app/app-version.json'

export type UpdatePolicy = {
  /** 이 빌드 번호(iOS buildNumber · Android versionCode)부터 쓸 수 있다 */
  minBuild: number
  /** 업데이트 버튼이 여는 주소 — 지금은 TestFlight, 출시하면 스토어 */
  url: string
}

/** 받은 JSON에서 이 플랫폼 기준을 꺼낸다. 모양이 틀리면 null — 막지 않는다. */
export function parseUpdatePolicy(json: unknown, platform: string): UpdatePolicy | null {
  if (!json || typeof json !== 'object') return null
  const entry = (json as Record<string, unknown>)[platform]
  if (!entry || typeof entry !== 'object') return null
  const { minBuild, url } = entry as Record<string, unknown>
  if (typeof minBuild !== 'number' || !Number.isInteger(minBuild) || typeof url !== 'string' || !url) {
    return null
  }
  return { minBuild, url }
}

/** 지금 빌드가 기준보다 낮은가. 빌드 번호를 모르면 막지 않는다. */
export function needsUpdate(currentBuild: string | number | undefined | null, policy: UpdatePolicy | null): boolean {
  if (!policy || currentBuild == null) return false
  const current = Number(currentBuild)
  return Number.isFinite(current) && current < policy.minBuild
}
