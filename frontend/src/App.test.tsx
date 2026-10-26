import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it('cycles the sidebar through full, small, and hidden and remembers the preference', async () => {
    window.localStorage.removeItem('alib-studio-sidebar-collapsed');
    window.localStorage.removeItem('alib-studio-sidebar-mode');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let payload: unknown = {};
      if (url.includes('/auth/csrf/')) payload = { csrfToken: 'test-csrf-token' };
      else if (url.includes('/auth/session/')) payload = { authenticated: true, user: { id: 1, username: 'studio-owner', email: 'owner@example.com', is_staff: true, is_superuser: true, role: 'administrator' } };
      else if (url.includes('/auth/me/')) payload = { id: 1, username: 'studio-owner', email: 'owner@example.com', is_staff: true, is_superuser: true, role: 'administrator' };
      else if (url.includes('/admin/stats/')) payload = { published: 0, drafts: 0, scheduled: 0, assets: 0, suggestions_pending: 0 };
      else if (url.includes('/content/')) payload = { count: 0, next: null, previous: null, results: [] };
      else if (url.includes('/categories/') || url.includes('/tags/')) payload = { count: 0, next: null, previous: null, results: [] };
      else if (url.includes('/settings/')) payload = { site_title: 'ALIB', logo_url: '', favicon_url: '', seo_description: '', homepage_sections: ['featured', 'latest', 'categories', 'collections'], theme_preferences: { primary: '#2563eb', secondary: '#facc15' }, owner_name: 'Mukamyi Izere Arcange', copyright_text: '© {year} {owner_name}. All rights reserved.', site_copy: { 'home.hero.intro': 'A test homepage intro.' } };
      else if (url.includes('/profile/')) payload = { display_name: 'Mukamyi Izere Arcange', headline: 'A home for ideas worth keeping.', biography: 'Creator bio', avatar_url: '', location: '', social_links: {} };
      else if (url.includes('/collections/')) payload = { count: 0, next: null, previous: null, results: [] };
      else if (url.includes('/analytics/event/')) payload = { detail: 'Event recorded.' };
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as Response;
    }));
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Collapse sidebar' });
    const sidebar = document.querySelector('.admin-sidebar');
    const layout = document.querySelector('.admin-page.admin-layout');
    expect(sidebar).not.toBeNull();
    expect(layout).not.toBeNull();
    expect(layout?.classList.contains('sidebar-full')).toBe(true);

    // full -> small (icon rail)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeTruthy());
    expect(sidebar?.classList.contains('is-collapsed')).toBe(true);
    expect(window.localStorage.getItem('alib-studio-sidebar-mode')).toBe('small');

    // small -> hidden
    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeTruthy());
    expect(sidebar?.classList.contains('is-hidden')).toBe(true);
    expect(window.localStorage.getItem('alib-studio-sidebar-mode')).toBe('hidden');

    // hidden -> full via the restore button in the topbar
    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy());
    expect(sidebar?.classList.contains('is-collapsed')).toBe(false);
    expect(sidebar?.classList.contains('is-hidden')).toBe(false);
    expect(window.localStorage.getItem('alib-studio-sidebar-mode')).toBe('full');

    // Workspace sections use a consistent top header with context-specific actions.
    // The sidebar panel and the header nav both list the sections, so scope the
    // section clicks to the sidebar and assert the header nav separately.
    const sidebarNav = within(sidebar as HTMLElement);
    const headerNav = document.querySelector('.admin-header-nav');
    expect(headerNav).not.toBeNull();
    expect(within(headerNav as HTMLElement).getAllByRole('button').map(button => button.textContent)).toEqual(
      ['Collections', 'Creator profile', 'Site settings', 'Contact inbox', 'Analytics', 'Suggestions', 'Comments', 'Team access', 'Audit history', 'Newsletter']);
    fireEvent.click(sidebarNav.getByRole('button', { name: 'Collections' }));
    await waitFor(() => expect(screen.getByTestId('admin-section-title').textContent).toBe('Collections'));
    expect(document.querySelector('.admin-header-description')?.textContent).toContain('chosen order');
    expect(await screen.findByRole('button', { name: 'Refresh Collections' })).toBeTruthy();

    fireEvent.click(sidebarNav.getByRole('button', { name: 'Creator profile' }));
    await waitFor(() => expect(screen.getByTestId('admin-section-title').textContent).toBe('Creator profile'));
    expect(await screen.findByRole('button', { name: 'Refresh Creator profile' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Save profile' })).toBeTruthy();

    fireEvent.click(sidebarNav.getByRole('button', { name: 'Site settings' }));
    await waitFor(() => expect(screen.getByTestId('admin-section-title').textContent).toBe('Site settings'));
    expect((await screen.findByLabelText('Website owner') as HTMLInputElement).value).toBe('Mukamyi Izere Arcange');
    expect((await screen.findByLabelText('Copyright text') as HTMLInputElement).value).toContain('{year}');
    expect(await screen.findByRole('button', { name: 'Refresh Site settings' })).toBeTruthy();
    expect(await within(document.querySelector('.admin-topbar') as HTMLElement).findByRole('button', { name: 'Save site settings' })).toBeTruthy();
    expect(await screen.findAllByRole('button', { name: 'Save site settings' })).toHaveLength(2);
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
