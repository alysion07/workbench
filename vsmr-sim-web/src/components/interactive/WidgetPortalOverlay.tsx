/**
 * WidgetPortalOverlay
 * F3.8: 위젯을 ReactFlow 노드의 stacking context 밖에 렌더링하기 위한 포털 타겟.
 *
 * ReactFlow의 zustand 스토어에 직접 구독(useStoreApi)하여
 * viewport transform을 프레임 지연 없이 DOM에 즉시 반영한다.
 * React 렌더 사이클을 거치지 않으므로 줌/팬 시 위치 동기화가 완벽하다.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStoreApi } from 'reactflow';

interface WidgetPortalOverlayProps {
  /** 포털 타겟 div가 준비되면 호출 */
  onReady: (el: HTMLDivElement | null) => void;
}

const WidgetPortalOverlay: React.FC<WidgetPortalOverlayProps> = ({ onReady }) => {
  const storeApi = useStoreApi();
  const transformRef = useRef<HTMLDivElement | null>(null);

  // 콜백 ref: transformRef 설정 + 부모에 알림
  const setRef = useCallback((el: HTMLDivElement | null) => {
    transformRef.current = el;
    onReady(el);

    // 마운트 시 초기 transform 동기화
    if (el) {
      const [x, y, zoom] = storeApi.getState().transform;
      el.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }, [onReady, storeApi]);

  // ReactFlow 스토어에 직접 구독 — React 렌더 사이클 우회, 즉시 DOM 업데이트
  useEffect(() => {
    const unsubscribe = storeApi.subscribe((state) => {
      if (transformRef.current) {
        const [x, y, zoom] = state.transform;
        transformRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      }
    });
    return unsubscribe;
  }, [storeApi]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      <div
        ref={setRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default WidgetPortalOverlay;
