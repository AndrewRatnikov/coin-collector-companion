import type { CanonicalSetSummary } from '@coin-collector/shared';
import { buildLlmsTxt, LLMS_TXT_CONTENT_TYPE, publicApiBaseUrl } from '@/lib/llms-txt';
import { serverApiGet } from '@/lib/server-api';
import { siteOrigin } from '@/lib/site-url';

// Never prerendered or stored: counts stay current and a degraded answer isn't reused. The
// checklist response itself is cached by serverApiGet's data-cache revalidate.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let checklists: CanonicalSetSummary[] | null;
  try {
    checklists = await serverApiGet<CanonicalSetSummary[]>('/sets/canonical');
  } catch {
    checklists = null;
  }
  const body = buildLlmsTxt({ siteOrigin: siteOrigin(), apiBaseUrl: publicApiBaseUrl(), checklists });
  return new Response(body, { status: 200, headers: { 'Content-Type': LLMS_TXT_CONTENT_TYPE } });
}
