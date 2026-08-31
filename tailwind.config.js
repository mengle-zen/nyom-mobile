/** @type {import('tailwindcss').Config} */
// 웹앱(nyom)의 디자인 토큰을 옮겨왔다. 클래스 이름이 같아야 화면 포팅이 기계적이 된다.
// 색은 그대로이고 라운드 스케일만 모바일에 맞게 조였다(아래 주석 참고) — 의도된 divergence다.
// NativeWind 4는 tailwindcss ~3을 요구하므로 웹의 v4 @theme 문법 대신 여기에 정의한다.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF7A2E',
          50: '#FFF4EC',
          100: '#FFE4D1',
          200: '#FFC79E',
          300: '#FFA56A',
          400: '#FF8C46',
          500: '#FF7A2E',
          600: '#E8651A',
          700: '#C24F0E',
          800: '#943C0A',
          900: '#5C2607',
          foreground: '#FFFFFF',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#FFFCF8',
          100: '#F5EFE6',
          200: '#EDE4D6',
          300: '#D9CCB7',
          400: '#A89A82',
          500: '#736756',
          600: '#534A3D',
          700: '#3A3329',
          800: '#251F18',
          900: '#1F1B16',
        },
        background: '#FFFCF8',
        foreground: '#1F1B16',
        card: '#FFFFFF',
        muted: '#F5EFE6',
        'muted-foreground': '#736756',
        border: '#EDE4D6',
        destructive: '#E5484D',
        // 보드는 항상 어두운 몰입 화면이라 라이트/다크와 무관한 고정 토큰을 둔다.
        board: {
          bg: '#1F1B16',
          surface: '#2A2620',
          tile: '#251F18',
        },
      },
      // 라운드 스케일은 웹보다 조인 값이다(웹은 6/10/16/24/32).
      //
      // 웹 값이 Tailwind 기본(2/6/8/12/16)의 약 2배라 모바일 화면에서는 과했다.
      // 특히 `rounded-xl`(24px)을 쓰는 그룹 카드·세그먼트 컨트롤이 높이 48~90pt에
      // 24px 라운드라 거의 알약처럼 보였다. 화면이 좁을수록 같은 radius가 더 둥글게
      // 읽힌다 — 웹 카드보다 모바일 카드가 훨씬 작기 때문이다.
      //
      // pill이 의도인 곳은 `rounded-full`을 따로 쓰고 있어(칩·아바타·배지) 이 스케일을
      // 조여도 영향받지 않는다.
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
