import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });

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
    expect(document.querySelector('.admin-page.admin-layout')).not.toBeNull();
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

describe('server-side content filtering', () => {
  it('requests project content directly from the API', async () => {
    const requestedUrls: string[] = [];
    const project = {
      id: 77, title: 'A sample project', slug: 'a-sample-project', summary: 'Project summary',
      body: '', content_type: 'project', source_url: '', cover_image_url: '',
      category: null, tags: [], visibility: 'public', status: 'published', featured: false,
      allow_download: false, published_at: '2026-01-01T00:00:00Z', scheduled_for: null,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      collection_slugs: [],
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); requestedUrls.push(url);
      const parsed = new URL(url, window.location.origin);
      let payload: unknown = {};
      if (parsed.pathname.endsWith('/settings/')) payload = { site_title: 'ALIB', logo_url: '', favicon_url: '', seo_description: '', homepage_sections: ['featured', 'latest', 'categories', 'collections'], theme_preferences: {} };
      else if (parsed.pathname.endsWith('/analytics/event/')) payload = { detail: 'Event recorded.' };
      else if (parsed.pathname.endsWith('/content/')) payload = parsed.searchParams.get('content_type') === 'project'
        ? { count: 1, next: null, previous: null, results: [project] }
        : { count: 0, next: null, previous: null, results: [] };
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as Response;
    }));
    render(<MemoryRouter initialEntries={['/projects']}><App /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'A sample project' })).toBeTruthy();
    expect(requestedUrls.some(value => new URL(value, window.location.origin).searchParams.get('content_type') === 'project')).toBe(true);
  });
});
