/**
 * useICVPolling
 * 시뮬레이션 활성 시 getAllICVs()를 주기적으로 폴링하여 ICV 스냅샷을 관리
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getAllICVs, setICV } from '@/services/mars/marsServiceMod06';
import { ICVType, ControlMode } from '@/stubs/mars/mars_service_mod06_pb';
import type { ICVSnapshot } from '@/stubs/mars/mars_service_mod06_pb';
import type { InteractiveInput } from '@/types/mars';
import toast from 'react-hot-toast';

const DEFAULT_POLL_INTERVAL = 1000; // 1초

export interface TripICVEntry {
  /** interactiveInput의 cardNumber */
  cardNumber: number;
  /** ICV object_id (매칭 후 확정) */
  objectId: number;
  /** Trip 번호 (interactiveInput.parameter) */
  tripNumber: number;
  /** MARS 설명 (32자) */
  whatis: string;
  /** 사용자 설정 comment */
  comment: string;
  /** 현재 제어 모드 */
  cmode: ControlMode;
  /** 현재값 */
  asis: number;
  /** 목표값 */
  target: number;
  /** 변화율 */
  rate: number;
}

/** 일반 ICV 엔트리 (Trip 외 모든 타입) */
export interface GeneralICVEntry {
  objectId: number;
  ctype: ICVType;
  cccno: number;
  whatis: string;
  cmode: ControlMode;
  asis: number;
  target: number;
  rate: number;
}

interface UseICVPollingOptions {
  /** 시뮬레이션 활성 여부 */
  active: boolean;
  /** globalSettings.interactiveInputs */
  interactiveInputs?: InteractiveInput[];
  /** 폴링 간격 (ms) */
  interval?: number;
}

interface UseICVPollingReturn {
  /** Trip ICV 목록 (interactiveInputs와 매칭된 것만) */
  tripEntries: TripICVEntry[];
  /** 전체 ICV 스냅샷 (Trip 포함 모든 타입) */
  allICVEntries: GeneralICVEntry[];
  /** 폴링 에러 */
  error: string | null;
  /** 로딩 상태 (최초 폴링) */
  loading: boolean;
  /** Trip 모드 변경 */
  setTripMode: (objectId: number, cmode: ControlMode) => Promise<void>;
  /** 일반 ICV 값 설정 (target/rate/mode) */
  setICVValue: (objectId: number, patch: { target?: number; rate?: number; cmode?: ControlMode }) => Promise<void>;
}

export function useICVPolling({
  active,
  interactiveInputs,
  interval = DEFAULT_POLL_INTERVAL,
}: UseICVPollingOptions): UseICVPollingReturn {
  const [snapshots, setSnapshots] = useState<ICVSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Trip interactiveInputs만 필터
  const tripInputs = useMemo(
    () => (interactiveInputs ?? []).filter((input) => input.controlType === 'trip'),
    [interactiveInputs],
  );

  // 폴링 함수
  const fetchICVs = useCallback(async () => {
    try {
      const result = await getAllICVs();
      if (mountedRef.current) {
        setSnapshots(result.icvs);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'ICV 조회 실패';
        setError(message);
      }
    }
  }, []);

  // 폴링 시작/중지
  useEffect(() => {
    mountedRef.current = true;

    if (!active) {
      // 비활성 시 스냅샷 보존 (마지막 ICV 값 유지, 차트 데이터 소실 방지)
      // 폴링만 중단하고 데이터는 유지한다
      setError(null);
      return;
    }

    // 최초 즉시 호출
    setLoading(true);
    fetchICVs().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    timerRef.current = setInterval(fetchICVs, interval);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, interval, fetchICVs]);

  // interactiveInputs.parameter ↔ ICVSnapshot.cccno 매칭
  const tripEntries = useMemo<TripICVEntry[]>(() => {
    if (tripInputs.length === 0) return [];

    return tripInputs
      .map((input) => {
        const tripNum = typeof input.parameter === 'string'
          ? parseInt(input.parameter, 10)
          : input.parameter;

        const matched = snapshots.find(
          (s) => s.ctype === ICVType.TRIP && s.cccno === tripNum,
        );

        if (!matched) return null;

        return {
          cardNumber: input.cardNumber,
          objectId: matched.objectId,
          tripNumber: tripNum,
          whatis: matched.whatis,
          comment: input.comment ?? '',
          cmode: matched.cmode,
          asis: matched.asis,
          target: matched.target,
          rate: matched.rate,
        } satisfies TripICVEntry;
      })
      .filter((entry): entry is TripICVEntry => entry !== null);
  }, [tripInputs, snapshots]);

  // 전체 ICV 엔트리 (모든 타입)
  const allICVEntries = useMemo<GeneralICVEntry[]>(() => {
    return snapshots.map((s) => ({
      objectId: s.objectId,
      ctype: s.ctype as ICVType,
      cccno: s.cccno,
      whatis: s.whatis,
      cmode: s.cmode as ControlMode,
      asis: s.asis,
      target: s.target,
      rate: s.rate,
    }));
  }, [snapshots]);

  // Trip 모드 변경
  const setTripMode = useCallback(async (objectId: number, cmode: ControlMode) => {
    try {
      await setICV(objectId, { cmode });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trip 모드 변경 실패';
      toast.error(`Trip 모드 변경 실패: ${message}`);
    }
  }, []);

  // 일반 ICV 값 설정
  const setICVValue = useCallback(async (objectId: number, patch: { target?: number; rate?: number; cmode?: ControlMode }) => {
    try {
      await setICV(objectId, patch);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ICV 값 설정 실패';
      toast.error(`ICV 설정 실패: ${message}`);
    }
  }, []);

  return { tripEntries, allICVEntries, error, loading, setTripMode, setICVValue };
}
