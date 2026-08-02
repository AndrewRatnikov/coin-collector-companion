import { describe, expect, it, vi } from 'vitest';
import { redirect } from 'next/navigation';
import SetsPage from '@/app/sets/page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('SetsPage', () => {
  it('redirects to /sets/canonical', () => {
    SetsPage();

    expect(redirect).toHaveBeenCalledWith('/sets/canonical');
  });
});
