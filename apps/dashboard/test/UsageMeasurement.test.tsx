import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import UsagePage from '../app/usage/page';

vi.mock('../components/layout/Topbar', () => ({ Topbar: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('existing usage page measurement semantics', () => {
  it.each([null, 0, 18])('distinguishes confirmed %s tokens from absent measurement', async (tokens) => {
    const llm_usage = { confirmed_calls: tokens === null ? 0 : 1, unmeasured_calls: 2, legacy_events: 3, input_tokens: tokens, output_tokens: 0, total_tokens: tokens };
    vi.stubGlobal('fetch', vi.fn(async (url) => new Response(JSON.stringify(String(url).includes('summary=1')
      ? { total_requests: 1, total_user_messages: 1, total_assistant_messages: 1, estimated_cost: 0.001, llm_usage }
      : [{ tenant_id: 'tenant-1', site_id: 'site-1', day: '2026-09-13', request_count: 1, llm_usage }]), { status: 200 })));
    render(<UsagePage />);
    await waitFor(() => expect(screen.getByText(/Aufrufe ohne vollständige Messung: 2/)).toBeTruthy());
    expect(screen.getByText(/Historische\/regelbasierte Ereignisse ohne Messnachweis: 3/)).toBeTruthy();
    expect(screen.getByText('Bestätigte LLM-Tokens')).toBeTruthy();
    if (tokens === null) expect(screen.getAllByText('Nicht gemessen').length).toBeGreaterThan(0);
    else expect(screen.getAllByText(String(tokens)).length).toBeGreaterThan(0);
  });
});
