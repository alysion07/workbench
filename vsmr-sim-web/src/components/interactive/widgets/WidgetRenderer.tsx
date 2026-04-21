/**
 * WidgetRenderer
 * 위젯 타입별 디스패처
 * — 이름표(R3) + 잠금 버튼은 각 위젯 내부에서 렌더링
 */

import { memo } from 'react';
import type { NodeWidgetConfig, TimeSeriesPoint, AlarmLevel } from '@/types/interactive';
import NumericLabelWidget from './NumericLabelWidget';
import AutoManualToggleWidget from './AutoManualToggleWidget';
import MiniChartWidget from './MiniChartWidget';

interface WidgetRendererProps {
  config: NodeWidgetConfig;
  value: number | string | TimeSeriesPoint[] | undefined;
  onValueChange?: (dataKey: string, newValue: string) => void;
  extraValues?: Record<string, number | string | TimeSeriesPoint[] | undefined>;
  alarmLevel?: AlarmLevel;
  customWidth?: number;
  customHeight?: number;
  pinned?: boolean;
  onPinToggle?: () => void;
  locked?: boolean;
  onLockToggle?: () => void;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = (props) => {
  switch (props.config.type) {
    case 'numeric-label':
      return (
        <NumericLabelWidget
          config={props.config}
          value={Array.isArray(props.value) ? undefined : props.value}
          alarmLevel={props.alarmLevel}
          pinned={props.pinned}
          onPinToggle={props.onPinToggle}
          locked={props.locked}
          onLockToggle={props.onLockToggle}
        />
      );
    case 'auto-manual-toggle':
      return (
        <AutoManualToggleWidget
          config={props.config}
          value={Array.isArray(props.value) ? undefined : props.value}
          onValueChange={props.onValueChange}
          extraValues={props.extraValues as Record<string, number | string | undefined>}
          locked={props.locked}
          onLockToggle={props.onLockToggle}
        />
      );
    case 'mini-chart':
      return (
        <MiniChartWidget
          config={props.config}
          value={props.value}
          alarmLevel={props.alarmLevel}
          customWidth={props.customWidth}
          customHeight={props.customHeight}
          pinned={props.pinned}
          onPinToggle={props.onPinToggle}
          locked={props.locked}
          onLockToggle={props.onLockToggle}
        />
      );
    default:
      return null;
  }
};

export default memo(WidgetRenderer);
