import type { ReactNode } from 'react'
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

/**
 * 그룹 화면용 최소 UI 프리미티브.
 *
 * 웹은 shadcn/ui(Button·Input·Badge)를 쓰지만 RN에는 그 컴포넌트가 없다.
 * 그룹 화면 밖으로 새어 나가지 않게 feature 안에 두고, 클래스 이름은 웹 토큰을
 * 그대로 쓴다(primary / muted / border …).
 */

export function Button({
  label,
  onPress,
  disabled,
  icon,
  variant = 'primary',
  size = 'md',
  accessibilityLabel,
  className = '',
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  icon?: keyof typeof Feather.glyphMap
  variant?: 'primary' | 'outline' | 'destructive'
  size?: 'sm' | 'md'
  accessibilityLabel?: string
  className?: string
}) {
  const base =
    variant === 'primary'
      ? 'bg-primary'
      : variant === 'destructive'
        ? 'bg-transparent border border-destructive/40'
        : 'bg-transparent border border-border'
  const fg =
    variant === 'primary'
      ? 'text-primary-foreground'
      : variant === 'destructive'
        ? 'text-destructive'
        : 'text-foreground'
  const pad = size === 'sm' ? 'h-9 px-3' : 'h-11 px-4'

  return (
    // NativeWind(react-native-css-interop)로 감싼 컴포넌트는 함수 형태의 style
    // 프롭({pressed}) => ...)을 그대로 버린다(스타일이 통째로 사라진다).
    // 눌림 피드백은 TouchableOpacity의 activeOpacity에 맡기고 style은 정적으로만 쓴다.
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={{ opacity: disabled ? 0.45 : 1 }}
      className={`flex-row items-center justify-center gap-1.5 rounded-md ${pad} ${base} ${className}`}
    >
      {icon && (
        <Feather
          name={icon}
          size={size === 'sm' ? 14 : 16}
          color={variant === 'primary' ? '#FFFFFF' : variant === 'destructive' ? '#E5484D' : '#1F1B16'}
        />
      )}
      <Text className={`text-sm font-semibold ${fg}`}>{label}</Text>
    </TouchableOpacity>
  )
}

/** 원형 아이콘 버튼 (초대코드 복사 · 설정 · 수락/거절) */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = '#736756',
  bg = '#F5EFE6',
}: {
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
  accessibilityLabel: string
  color?: string
  bg?: string
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      activeOpacity={0.7}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={16} color={color} />
    </TouchableOpacity>
  )
}

export function Input(props: TextInputProps & { className?: string }) {
  const { className = '', ...rest } = props
  return (
    <TextInput
      placeholderTextColor="#A89A82"
      {...rest}
      className={`h-11 rounded-md border border-border bg-card px-3 text-base text-foreground ${className}`}
    />
  )
}

export function Badge({
  label,
  tone = 'muted',
  icon,
}: {
  label: string
  tone?: 'primary' | 'amber' | 'muted'
  icon?: keyof typeof Feather.glyphMap
}) {
  const tones = {
    // primary/10 같은 알파 유틸은 NativeWind에서도 동작하지만, 배지 색을 한곳에
    // 모아두는 편이 읽기 쉬워 명시적인 hex를 쓴다.
    primary: { bg: '#FFF4EC', fg: '#C24F0E' },
    amber: { bg: '#FEF3C7', fg: '#B45309' },
    muted: { bg: '#F5EFE6', fg: '#736756' },
  }[tone]

  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
      style={{ backgroundColor: tones.bg }}
    >
      {icon && <Feather name={icon} size={11} color={tones.fg} />}
      <Text className="text-xs font-semibold" style={{ color: tones.fg }}>
        {label}
      </Text>
    </View>
  )
}

/** 섹션 제목 + 내용 묶음 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-foreground">{title}</Text>
      {children}
    </View>
  )
}

/** 이름 첫 글자 폴백이 있는 원형 아바타 */
export function Avatar({
  uri,
  nickname,
  size = 32,
}: {
  uri: string | null
  nickname: string
  size?: number
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }
  return (
    <View
      className="items-center justify-center bg-primary-100"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="text-xs font-bold text-primary-700">
        {nickname.slice(0, 1)}
      </Text>
    </View>
  )
}
