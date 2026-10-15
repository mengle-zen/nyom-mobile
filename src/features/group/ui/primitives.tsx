import type { ReactNode } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import { PressableScale, type HapticKind } from '@/shared/ui/press'

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
  // disabled를 브랜드 컬러로 두면(연한 주황) 눌릴 것처럼 보인다. 확실히 회색으로
  // 눕혀서 "지금은 못 누른다"가 색만 보고도 읽히게 한다 — 토스가 하는 방식.
  const base = disabled
    ? 'bg-neutral-200'
    : variant === 'primary'
      ? 'bg-primary'
      : variant === 'destructive'
        ? 'bg-transparent border border-destructive/40'
        : 'bg-transparent border border-border'
  const fg = disabled
    ? 'text-neutral-400'
    : variant === 'primary'
      ? 'text-primary-foreground'
      : variant === 'destructive'
        ? 'text-destructive'
        : 'text-foreground'
  const iconColor = disabled
    ? '#A89A82'
    : variant === 'primary'
      ? '#FFFFFF'
      : variant === 'destructive'
        ? '#E5484D'
        : '#1F1B16'
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
      className={`flex-row items-center justify-center gap-1.5 rounded-md ${pad} ${base} ${className}`}
    >
      {icon && (
        <Feather name={icon} size={size === 'sm' ? 14 : 16} color={iconColor} />
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
  disabled = false,
}: {
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
  accessibilityLabel: string
  color?: string
  bg?: string
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      activeOpacity={0.7}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
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

/**
 * 하단 시트 껍데기 (딤 · 핸들 · 제목 · 스크롤).
 *
 * 그룹 설정 · 만들기/참여 · 카드 동작이 각자 Modal을 세우면 딤 농도와 라운드가
 * 조금씩 갈린다. 껍데기를 한 곳에 두고 안쪽만 바꾼다.
 *
 * 키보드: 입력이 있는 시트는 iOS에서 키보드가 시트를 덮으므로
 * KeyboardAvoidingView로 밀어 올린다.
 */
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 웹의 backdrop-blur는 RN에 없다. 반투명 딤으로 대체한다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} 닫기`}
          onPress={onClose}
          className="flex-1"
          style={{ backgroundColor: 'rgba(31,27,22,0.4)' }}
        />

        <View
          className="rounded-t-xl bg-background"
          style={{ maxHeight: '88%', paddingBottom: insets.bottom }}
        >
          <View className="items-center pb-1 pt-3">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <ScrollView
            className="px-4"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              accessibilityRole="header"
              className="py-3 text-base font-bold text-foreground"
            >
              {title}
            </Text>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** 시트 안의 동작 한 줄 (아이콘 + 라벨 + 설명). */
export function SheetRow({
  icon,
  label,
  hint,
  tone = 'default',
  hapticKind = 'light',
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  hint?: string
  tone?: 'default' | 'destructive'
  /** 누를 때 줄 햅틱. 상태를 바꾸지 않는 항목은 null. */
  hapticKind?: HapticKind | null
  onPress: () => void
}) {
  const fg = tone === 'destructive' ? '#E5484D' : '#1F1B16'

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hapticKind={hapticKind}
      onPress={onPress}
      style={{ marginBottom: 8 }}
    >
      <View className="flex-row items-center gap-3 rounded-lg bg-card px-4 py-3.5">
        <Feather name={icon} size={18} color={fg} />
        <View className="flex-1">
          <Text className="text-[15px] font-semibold" style={{ color: fg }}>
            {label}
          </Text>
          {hint && (
            <Text className="mt-0.5 text-xs text-muted-foreground">{hint}</Text>
          )}
        </View>
      </View>
    </PressableScale>
  )
}
