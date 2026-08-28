export { decideAxis, edgeZone, type Axis } from './axis'

/** 이 값을 넘어야 드래그로 인정한다(축 판정 임계). */
export const DRAG_THRESHOLD = 10
/** 가로 스와이프로 날짜를 넘기는 데 필요한 화면 폭 대비 비율. */
export const COMMIT_RATIO = 0.22
/** 세로 스와이프로 끼니를 넘기는 데 필요한 거리(px). */
export const VERTICAL_COMMIT = 56
