import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.localStorage.clear(); });

describe('ALIB public shell', () => {
  it('renders the core navigation and a path into discovery', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API offline')));
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /ALIB home/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Explore the library/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Creator Studio/i }).length).toBeGreaterThan(0);
  });
});

describe('Creator Studio navigation', () => {
  it('toggles the sidebar and remembers the preference', async () => {
    window.localStorage.removeItem('alib-studio-sidebar-collapsed');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let payload: unknown = {};
      if (url.includes('/auth/csrf/')) payload = { csrfToken: 'test-csrf-token' };
      else if (url.includes('/auth/me/')) payload = { id: 1, username: 'studio-owner', email: 'owner@example.com', is_staff: true, is_superuser: true, role: 'administrator' };
      else if (url.includes('/admin/stats/')) payload = { published: 0, drafts: 0, scheduled: 0, assets: 0, suggestions_pending: 0 };
      else if (url.includes('/content/')) payload = { count: 0, next: null, previous: null, results: [] };
      else if (url.includes('/categories/') || url.includes('/tags/')) payload = { count: 0, next: null, previous: null, results: [] };
      else if (url.includes('/settings/')) payload = { site_title: 'ALIB', logo_url: '', favicon_url: '', seo_description: '', homepage_sections: ['featured', 'latest', 'categories', 'collections'], theme_preferences: {} };
      else if (url.includes('/analytics/event/')) payload = { detail: 'Event recorded.' };
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as Response;
    }));
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
    const collapseButton = await screen.findByRole('button', { name: 'Collapse sidebar' });
    const sidebar = document.querySelector('.admin-sidebar');
    expect(sidebar).not.toBeNull();
    fireEvent.click(collapseButton);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy());
    expect(sidebar?.classList.contains('is-collapsed')).toBe(true);
    expect(window.localStorage.getItem('alib-studio-sidebar-collapsed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy());
    expect(sidebar?.classList.contains('is-collapsed')).toBe(false);
    expect(window.localStorage.getItem('alib-studio-sidebar-collapsed')).toBe('false');
  });
});
