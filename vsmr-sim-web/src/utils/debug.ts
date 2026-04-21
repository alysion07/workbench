/**
 * Debug logging utility
 *
 * 평소에는 완전 OFF → 성능 영향 0
 * 디버깅 필요 시: 브라우저 콘솔에서 localStorage.setItem('DEBUG_STORE', 'true') 후 새로고침
 * 끄기: localStorage.removeItem('DEBUG_STORE') 후 새로고침
 */

const DEBUG_STORE = localStorage.getItem('DEBUG_STORE') === 'true';

/** Store 관련 디버그 로그 (연결/엣지/노드 변경 추적) */
export const debugStore = DEBUG_STORE
  ? (...args: unknown[]) => console.log('[Store]', ...args)
  : () => {};

/** Connection 관련 디버그 로그 (PUMP/HTSTR/Edge sync) */
export const debugConnection = DEBUG_STORE
  ? (...args: unknown[]) => console.log('[Connection]', ...args)
  : () => {};

/** Drop/DnD 관련 디버그 로그 */
export const debugDnD = DEBUG_STORE
  ? (...args: unknown[]) => console.log('[DnD]', ...args)
  : () => {};
