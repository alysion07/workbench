import { createPromiseClient } from "@connectrpc/connect";
import type { PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { Timestamp } from "@bufbuild/protobuf";
import { BFF_URL, createAuthInterceptor } from "@/services/connectCommon";
import { AnalysisService } from "@/stubs/analysis/analysis_connect";
import { GetTelemetriesRequest } from "@/stubs/analysis/analysis_pb";

export interface GetTelemetriesParams {
  taskId: string;
  start: Date;
  end: Date;
  objectId: number;
  variableName: string;
}

export interface TelemetryPointData {
  timehy: bigint | string | number;
  value: number;
}

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [createAuthInterceptor()],
});

const analysisClient: PromiseClient<typeof AnalysisService> = createPromiseClient(
  AnalysisService,
  transport,
);

function toTimestamp(date: Date): Timestamp {
  const millis = date.getTime();
  const seconds = Math.floor(millis / 1000);
  const nanos = (millis % 1000) * 1_000_000;
  return new Timestamp({
    seconds: BigInt(seconds),
    nanos,
  });
}

export const analysisService = {
  async getTelemetries(params: GetTelemetriesParams): Promise<TelemetryPointData[]> {
    const response = await analysisClient.getTelemetries(
      new GetTelemetriesRequest({
        taskId: params.taskId,
        start: toTimestamp(params.start),
        end: toTimestamp(params.end),
        objectId: params.objectId,
        variableName: params.variableName,
      }),
    );

    return response.points.map((point) => ({
      timehy: point.timehy,
      value: point.value,
    }));
  },
};