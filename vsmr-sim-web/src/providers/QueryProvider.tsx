/**
 * React Query Provider
 * 서버 상태 관리 및 캐싱
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';

/**
 * QueryClient 설정
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 기본 옵션
      staleTime: 1000, // 1초 후 stale
      gcTime: 5 * 60 * 1000, // 5분간 캐시 유지 (이전 cacheTime)
      retry: 3, // 3회 재시도
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // 윈도우 포커스 시 리페치 비활성화
      refetchOnReconnect: true, // 재연결 시 리페치
    },
    mutations: {
      retry: 1, // 뮤테이션은 1회만 재시도
      retryDelay: 1000,
    },
  },
});

/**
 * QueryProvider 컴포넌트
 */
interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools 비활성화 - 필요 시 주석 해제 */}
      {/* {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )} */}
    </QueryClientProvider>
  );
}

/**
 * QueryClient export (테스트 등에서 사용)
 */
export { queryClient };
