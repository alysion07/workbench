import { createPromiseClient } from '@connectrpc/connect';
import type { PromiseClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { InputdService } from '@/stubs/inputd/inputd_connect';
import { ValidateInputContentRequest } from '@/stubs/inputd/inputd_pb';
import { BFF_URL, createAuthInterceptor } from '@/services/connectCommon';

export type InputValidationIssue = string;

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [createAuthInterceptor()],
});

const inputdClient: PromiseClient<typeof InputdService> = createPromiseClient(
  InputdService,
  transport,
);

export async function validateInputContent(
  content: string | Uint8Array,
  options?: { rstpltS3Uri?: string },
): Promise<{ success: boolean; messages: InputValidationIssue[] }> {
  const inputContent = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : new Uint8Array(content);

  const response = await inputdClient.validateInputContent(
    new ValidateInputContentRequest({
      inputContent,
      rstpltS3Uri: options?.rstpltS3Uri ?? '',
    }),
  );

  return {
    success: response.success,
    messages: (response.messages || []).map((message) => String(message || '')),
  };
}
