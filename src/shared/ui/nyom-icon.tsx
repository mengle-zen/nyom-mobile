import { View } from 'react-native'

/**
 * NyomIcon — 뇸 로고 (RN 버전)
 *
 * 웹은 `public/nyomLogo.svg` / `shared/ui/nyom-icon.tsx`의 SVG를 쓰지만,
 * RN에서 SVG를 그리려면 react-native-svg를 새로 붙여야 해서 로고 하나 때문에
 * 의존성을 늘리지 않았다. 대신 같은 모티브(밥그릇 ㅁ + 숟가락 ㄴ + 김 ㅛ)를
 * View 몇 개로 재현한다. 좌표는 원본 SVG의 512×512 viewBox 비율을 그대로 옮긴 것.
 */
export function NyomIcon({
  size = 48,
  shadow = false,
  bg = '#FF7A2E',
  fg = '#FFFFFF',
}: {
  size?: number
  /** 로그인 화면 등 큰 버전에서 드롭 섀도 추가 */
  shadow?: boolean
  bg?: string
  fg?: string
}) {
  const p = (n: number) => (n / 512) * size // 원본 viewBox 좌표 → px

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="뇸"
      style={[
        {
          width: size,
          height: size,
          borderRadius: p(120),
          backgroundColor: bg,
          overflow: 'hidden',
        },
        shadow && {
          shadowColor: '#5C2607',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.2,
          shadowRadius: 18,
          elevation: 8,
        },
      ]}
    >
      {/* ── ㄴ (숟가락) : 세로 획 + 가로 획 ─────────────── */}
      <View
        style={{
          position: 'absolute',
          left: p(99),
          top: p(70),
          width: p(54),
          height: p(160),
          borderRadius: p(27),
          backgroundColor: fg,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: p(99),
          top: p(203),
          width: p(150),
          height: p(54),
          borderRadius: p(27),
          backgroundColor: fg,
        }}
      />

      {/* ── ㅛ (김) : 짧은 세로 획 두 개 ────────────────── */}
      {[315, 378].map((x) => (
        <View
          key={x}
          style={{
            position: 'absolute',
            left: p(x),
            top: p(129),
            width: p(30),
            height: p(106),
            borderRadius: p(15),
            backgroundColor: fg,
          }}
        />
      ))}

      {/* ── ㅁ (밥그릇) : 아래가 둥근 반원 ──────────────── */}
      <View
        style={{
          position: 'absolute',
          left: p(68),
          top: p(285),
          width: p(376),
          height: p(177),
          borderBottomLeftRadius: p(188),
          borderBottomRightRadius: p(188),
          backgroundColor: fg,
        }}
      />
    </View>
  )
}
