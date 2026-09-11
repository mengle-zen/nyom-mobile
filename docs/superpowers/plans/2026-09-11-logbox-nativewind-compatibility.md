# LogBox NativeWind Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep React Native LogBox error notifications readable in the Expo development build while NativeWind is enabled.

**Architecture:** Persist a narrow React Native 0.86 patch that makes the LogBox button use a concrete style object instead of a Pressable style callback, which NativeWind style interop corrupts. The patch is recorded by pnpm so clean installs reproduce it.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, NativeWind 4.2.6, pnpm patch protocol.

---

### Task 1: Persist the targeted React Native LogBox patch

**Files:**

- Create: `patches/react-native@0.86.3.patch`
- Create: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

- [x] Create an editable pnpm patch workspace for `react-native@0.86.3` with `pnpm patch react-native@0.86.3`.
- [x] In `Libraries/LogBox/UI/LogBoxButton.js`, replace the function-valued `Pressable` `style={({ pressed }) => ...}` with `StyleSheet.compose({ backgroundColor: resolvedBackgroundColor.default }, focused ? StyleSheet.compose(style, styles.focusRing) : style)`.
- [x] Run `pnpm patch-commit <patch-workspace>` to create the patch and record its metadata.
- [x] Run `git diff --check` and review that only this LogBox compatibility change and pnpm metadata changed.

### Task 2: Verify the development-only LogBox rendering

**Files:**

- Modify temporarily, then restore: `src/app/_layout.tsx`

- [x] Add a temporary `useEffect(() => { if (__DEV__) console.error('LogBox rendering probe') }, [])` in `RootLayout`.
- [x] Run `pnpm ios` and inspect the simulator: the notification shows the probe text and a count badge rather than an empty white banner.
- [x] Remove the probe, reload, and capture the simulator: the group list loads with no LogBox badge.

### Task 3: Verify and commit

**Files:**

- Modify: `patches/react-native@0.86.3.patch`
- Create: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

- [x] Run `pnpm lint && pnpm exec tsc --noEmit` and require both commands to exit 0.
- [x] Run `pnpm exec vitest run` and require all tests to pass.
- [ ] Stage the persisted patch files and commit with `fix: preserve LogBox UI with NativeWind`.
