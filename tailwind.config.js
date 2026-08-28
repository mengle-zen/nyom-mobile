/** @type {import('tailwindcss').Config} */
// 웹앱(nyom)의 디자인 토큰을 그대로 옮겼다. 클래스 이름이 같아야 화면 포팅이 기계적이 된다.
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
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
      },
    },
  },
  plugins: [],
}
