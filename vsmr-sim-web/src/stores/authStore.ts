/**
 * Auth Store
 *
 * Supabase Auth를 사용한 인증 상태 관리
 * - 세션 초기화 및 복원 (새로고침 대응)
 * - 로그인/로그아웃
 * - 이메일 로그인 (관리자 승인 필요)
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { useSessionStore } from './sessionStore';
import { createSession, closeSession } from '@/services/sm/simulationManagerService';

// StrictMode/중복 호출로 initialize가 동시에 실행될 때를 방지
let _initializePromise: Promise<void> | null = null;
// Auth 상태 리스너는 탭당 1개만 유지
let _authStateUnsubscribe: (() => void) | null = null;
let _lastSessionCreateAttemptAt = 0;
const SESSION_CREATE_RETRY_COOLDOWN_MS = 10000;

// 사용자 프로필 타입
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  is_admin: boolean;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  resetLoading: () => void;

  // Profile Actions
  fetchProfile: () => Promise<void>;

  // Profile Update Actions
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;

  // Admin Actions
  fetchAllUsers: () => Promise<UserProfile[]>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,
  error: null,

  /**
   * 앱 시작 시 세션 복원
   * Supabase가 localStorage에서 세션을 자동으로 복원함
   */
  initialize: async () => {
    if (_initializePromise) {
      return _initializePromise;
    }

    _initializePromise = (async () => {
    // 이미 초기화되었으면 스킵
    if (get().initialized) {
      return;
    }

    try {
      set({ loading: true, error: null });

      // 현재 세션 가져오기 (localStorage에서 자동 복원)
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthStore] Failed to get session:', error.message);
        set({ user: null, session: null, loading: false, initialized: true });
        return;
      }

      set({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });

      console.log('[AuthStore] Session initialized:', session ? 'logged in' : 'not logged in');

      const hasSessionReady = () => {
        const { sessionId, sessionCreating } = useSessionStore.getState();
        return !!sessionId || sessionCreating;
      };

      const shouldThrottleSessionCreate = () => {
        const now = Date.now();
        const delta = now - _lastSessionCreateAttemptAt;
        return delta < SESSION_CREATE_RETRY_COOLDOWN_MS;
      };

      const ensureConnectSession = (source: string) => {
        if (hasSessionReady()) {
          console.log('[AuthStore] Existing/creating SESSION_ID detected, skipping session creation:', source);
          return;
        }

        if (shouldThrottleSessionCreate()) {
          console.warn('[AuthStore] Session create throttled:', source);
          return;
        }

        _lastSessionCreateAttemptAt = Date.now();
        console.log('[AuthStore] Session event without SESSION_ID, creating Connect-RPC session:', source);
        createSession().then(sessionId => {
          useSessionStore.getState().setSessionId(sessionId);
          console.log('[AuthStore] Connect-RPC session created from:', source, sessionId);
        }).catch(err => {
          console.error('[AuthStore] Failed to create Connect-RPC session from:', source, err);
        });
      };

      // 로그인 상태이고 SESSION_ID가 없으면 Connect-RPC 세션 생성
      if (session) {
        ensureConnectSession('init');
      }

      // 인증 상태 변경 리스너 등록
      if (_authStateUnsubscribe) {
        _authStateUnsubscribe();
        _authStateUnsubscribe = null;
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AuthStore] Auth state changed:', event);

        set({
          user: session?.user ?? null,
          session,
        });

        // 세션 유효 이벤트 처리 - SESSION_ID가 없을 때만 Connect-RPC 세션 생성
        // INITIAL_SESSION: 페이지/탭 최초 로딩 시 localStorage 복원 경로
        // SIGNED_IN: 명시적 로그인 직후
        // TOKEN_REFRESHED: 토큰 갱신 후 session_id 유실 복구
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          ensureConnectSession(`auth:${event}`);
        }

        // 로그아웃 이벤트 처리 - Connect-RPC 세션 정리
        if (event === 'SIGNED_OUT') {
          console.log('[AuthStore] User signed out, clearing Connect-RPC session');
          closeSession();
          useSessionStore.getState().clearSessionId();
        }

        // 토큰 갱신 이벤트
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AuthStore] Token refreshed');
        }
      });

      _authStateUnsubscribe = () => {
        try {
          authListener.subscription.unsubscribe();
        } catch (error) {
          console.warn('[AuthStore] Failed to unsubscribe auth listener:', error);
        }
      };
    } catch (err) {
      console.error('[AuthStore] Initialization error:', err);
      set({
        user: null,
        session: null,
        loading: false,
        initialized: true,
        error: 'Failed to initialize authentication',
      });
    } finally {
      _initializePromise = null;
    }
    })();

    return _initializePromise;
  },

  /**
   * 이메일/비밀번호 로그인
   * B 정책: 이메일 로그인은 관리자 승인 필요
   */
  signInWithEmail: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });

      // 1. Supabase 인증
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // 2. 프로필 조회 (승인 상태 확인은 ProtectedRoute에서 처리)
      // RLS 에러 시에도 로그인은 허용하고 ProtectedRoute가 pending/rejected 처리
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      // 3. 로그인 허용 - pending/rejected는 ProtectedRoute에서 차단
      set({
        user: data.user,
        session: data.session,
        profile: profile as UserProfile | null,
        loading: false,
      });

      // 4. Connect-RPC 세션은 onAuthStateChange SIGNED_IN 이벤트에서 생성됨
      console.log('[AuthStore] Email sign in successful');
    } catch (err) {
      const authError = err as Error;
      console.error('[AuthStore] Email sign in error:', authError.message);
      set({
        loading: false,
        error: authError.message || '로그인에 실패했습니다.',
      });
      throw err;
    }
  },

  /**
   * 이메일/비밀번호 회원가입
   */
  signUpWithEmail: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // 이메일 확인이 필요한 경우 user는 있지만 session은 null
      set({
        user: data.user,
        session: data.session,
        loading: false,
      });

      console.log('[AuthStore] Sign up successful');
    } catch (err) {
      const authError = err as AuthError;
      console.error('[AuthStore] Sign up error:', authError.message);
      set({
        loading: false,
        error: authError.message || '회원가입에 실패했습니다.',
      });
      throw err;
    }
  },

  /**
   * 로그아웃
   */
  signOut: async () => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase.auth.signOut();

      // 세션 없음 에러는 무시 (이미 로그아웃 상태)
      if (error && error.message !== 'Auth session missing!') {
        console.warn('[AuthStore] Sign out warning:', error.message);
      }

      // 에러 여부와 관계없이 로컬 state 클리어
      set({
        user: null,
        session: null,
        profile: null,
        loading: false,
      });

      // Connect-RPC 세션 스트림 종료 → 서버 측 세션 cleanup 트리거
      closeSession();
      useSessionStore.getState().clearSessionId();

      console.log('[AuthStore] Sign out successful');
    } catch (err) {
      const authError = err as AuthError;
      console.error('[AuthStore] Sign out error:', authError.message);

      // 에러가 나도 로컬 state는 클리어
      set({
        user: null,
        session: null,
        profile: null,
        loading: false,
        error: null, // 세션 없음은 에러로 표시하지 않음
      });

      // Connect-RPC 세션 스트림 종료 → 서버 측 세션 cleanup 트리거
      closeSession();
      useSessionStore.getState().clearSessionId();
    }
  },

  /**
   * 에러 클리어
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * 로딩 상태 리셋 (OAuth 취소 등의 경우)
   */
  resetLoading: () => {
    set({ loading: false });
  },

  /**
   * 현재 사용자의 프로필 조회
   */
  fetchProfile: async () => {
    const user = get().user;
    if (!user) {
      set({ profile: null });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // single() 대신 maybeSingle() 사용 - 결과 없어도 에러 안 남

      if (error) {
        console.error('[AuthStore] Failed to fetch profile:', error.message);
        // RLS 에러 등의 경우 기본 프로필 생성 (pending 상태)
        set({
          profile: {
            id: user.id,
            email: user.email || '',
            display_name: user.email?.split('@')[0] || null,
            approval_status: 'pending',
            is_admin: false,
            has_password: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
        return;
      }

      // 프로필이 없으면 기본값 설정 (트리거 실패 등의 경우)
      if (!data) {
        console.warn('[AuthStore] Profile not found, using default');
        set({
          profile: {
            id: user.id,
            email: user.email || '',
            display_name: user.email?.split('@')[0] || null,
            approval_status: 'pending',
            is_admin: false,
            has_password: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
        return;
      }

      set({ profile: data as UserProfile });
    } catch (err) {
      console.error('[AuthStore] Profile fetch error:', err);
      // 에러 시에도 기본 프로필로 pending 상태 표시
      const user = get().user;
      set({
        profile: {
          id: user?.id || '',
          email: user?.email || '',
          display_name: user?.email?.split('@')[0] || null,
          approval_status: 'pending',
          is_admin: false,
          has_password: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }
  },

  /**
   * 비밀번호 변경
   * 현재 비밀번호 검증 후 새 비밀번호로 변경
   */
  updatePassword: async (currentPassword: string, newPassword: string) => {
    const user = get().user;
    if (!user?.email) throw new Error('사용자 정보를 찾을 수 없습니다');

    // 1단계: 현재 비밀번호 검증
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('현재 비밀번호가 올바르지 않습니다');

    // 2단계: 새 비밀번호로 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) throw updateError;
  },

  /**
   * 표시 이름 변경
   */
  updateDisplayName: async (displayName: string) => {
    const user = get().user;
    if (!user) throw new Error('사용자 정보를 찾을 수 없습니다');

    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;

    // 프로필 새로고침
    await get().fetchProfile();
  },

  /**
   * [관리자] 모든 사용자 프로필 조회
   * RPC 함수를 통해 RLS 우회
   */
  fetchAllUsers: async (): Promise<UserProfile[]> => {
    try {
      const { data, error } = await supabase.rpc('get_all_users_for_admin');

      if (error) {
        console.error('[AuthStore] Failed to fetch users:', error.message);
        throw error;
      }

      return (data as UserProfile[]) || [];
    } catch (err) {
      console.error('[AuthStore] Fetch users error:', err);
      throw err;
    }
  },

  /**
   * [관리자] 사용자 승인
   * RPC 함수를 통해 RLS 우회
   */
  approveUser: async (userId: string) => {
    try {
      const { error } = await supabase.rpc('approve_user', {
        target_user_id: userId,
      });

      if (error) {
        console.error('[AuthStore] Failed to approve user:', error.message);
        throw error;
      }

      console.log('[AuthStore] User approved:', userId);
    } catch (err) {
      console.error('[AuthStore] Approve user error:', err);
      throw err;
    }
  },

  /**
   * [관리자] 사용자 거부
   * RPC 함수를 통해 RLS 우회
   */
  rejectUser: async (userId: string) => {
    try {
      const { error } = await supabase.rpc('reject_user', {
        target_user_id: userId,
      });

      if (error) {
        console.error('[AuthStore] Failed to reject user:', error.message);
        throw error;
      }

      console.log('[AuthStore] User rejected:', userId);
    } catch (err) {
      console.error('[AuthStore] Reject user error:', err);
      throw err;
    }
  },
}));
