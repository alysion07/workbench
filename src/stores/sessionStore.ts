/**
 * Session Store
 *
 * Connect-RPC session_id 로컬 저장소
 * - session_id 저장 및 조회
 * - Connect-RPC 서비스에 session_id 동기화
 */

import { create } from 'zustand';

interface SessionState {
  // State
  sessionId: string | null;
  sessionCreating: boolean;

  // Actions
  setSessionId: (sessionId: string | null) => void;
  setSessionCreating: (creating: boolean) => void;
  clearSessionId: () => void;
  getSessionId: () => string | null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  sessionId: null,
  sessionCreating: false,

  /**
   * Session ID 설정
   * Connect-RPC 서비스에도 동기화
   */
  setSessionId: (sessionId: string | null) => {
    console.log('[SessionStore] Setting session ID:', sessionId);

    // 단일 소스: sessionStore만 갱신
    set({ sessionId });
  },

  setSessionCreating: (creating: boolean) => {
    set({ sessionCreating: creating });
  },

  /**
   * Session ID 클리어
   */
  clearSessionId: () => {
    const currentSessionId = get().sessionId;

    if (currentSessionId) {
      console.log('[SessionStore] Clearing session ID:', currentSessionId);
    }

    // 단일 소스: sessionStore만 갱신
    set({ sessionId: null, sessionCreating: false });
  },

  /**
   * 현재 Session ID 가져오기
   */
  getSessionId: () => {
    return get().sessionId;
  },
}));
