import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

import Page from '../src/app/page';

describe('Root Page', () => {
  it('redirects to /en', () => {
    Page();
    expect(redirect).toHaveBeenCalledWith('/en');
  });
});
