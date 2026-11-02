import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportDialog } from './report-dialog';

const setup = () => {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReportDialog open onOpenChange={onOpenChange} targetType="LISTING" targetId="abc" title="Report this listing" />
    </QueryClientProvider>,
  );
  return onOpenChange;
};

afterEach(() => vi.unstubAllGlobals());

describe('ReportDialog', () => {
  it('sends the report and closes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const onOpenChange = setup();
    await userEvent.type(screen.getByLabelText('Details (optional)'), 'Looks fake');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ targetType: 'LISTING', targetId: 'abc', details: 'Looks fake' });
  });

  it('stays open and shows the server error when sending fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'You already reported this', requestId: 'r' } }), { status: 409, headers: { 'content-type': 'application/json' } })));
    const onOpenChange = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('You already reported this')).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
