/**
 * Supabase Client Configuration
 *
 * Supabase 클라이언트 초기화 및 설정
 * - 인증 (Auth)
 * - 데이터베이스 (PostgreSQL)
 * - 스토리지 (Storage)
 */

import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 가져오기
// window.__ENV (런타임) > import.meta.env (빌드타임) 우선순위
const supabaseUrl = (window as any).__ENV?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = (window as any).__ENV?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 세션을 localStorage에 자동 저장 (새로고침 시 복원)
    persistSession: true,
    // 세션 자동 갱신
    autoRefreshToken: true,
    // URL에서 세션 감지 (OAuth 콜백)
    detectSessionInUrl: true,
  },
});

// Storage 버킷 이름
export const STORAGE_BUCKET = (window as any).__ENV?.VITE_SUPABASE_STORAGE_BUCKET || import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'v-smr';
