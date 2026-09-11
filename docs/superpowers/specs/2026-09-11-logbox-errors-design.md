# Development LogBox and Runtime Error Recovery Design

## Goal

Identify and fix the runtime errors currently counted by React Native LogBox, then restore a readable development-only LogBox notification without changing the app's user-facing toast behavior.

## Scope

- Collect the full set of current LogBox errors from the running iOS simulator and Metro output.
- Group repeated errors by root cause and fix each cause at its source.
- Add focused regression coverage where the error can be represented by repository tests.
- Patch only the React Native LogBox rendering incompatibility caused by React Native 0.86 and NativeWind 4, after application errors are resolved.

## Non-goals

- Do not silence errors with `LogBox.ignoreAllLogs()` or broad ignore filters.
- Do not change `sonner-native` application toasts.
- Do not downgrade React Native or NativeWind unless evidence shows a patch cannot work safely.

## Approach

1. Capture the complete error messages and call sites from the running app.
2. Reproduce each unique application error, add a minimal failing test where feasible, and implement the smallest source-level fix.
3. Verify the repaired flows and run the repository test and lint checks.
4. Apply a narrowly scoped patch to React Native's LogBox button style handling so NativeWind no longer corrupts the development notification; verify it with a deliberate `console.error` in development.

## Verification

- The initial runtime errors no longer recur in the affected flows.
- Existing and newly added focused tests pass, followed by the full test suite and lint.
- A deliberate development-only console error produces a readable LogBox notification instead of an empty white banner.
- The production app remains free of LogBox because it is development-only.
