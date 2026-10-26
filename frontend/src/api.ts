import type { Category, Collection, ContentItem, CreatorProfile, HomePayload, MediaAsset, PageResult, Tag } from './types';

// Empty VITE_API_URL means same-origin API requests (the recommended Render setup).
// For a separately hosted frontend, set it to the API origin without /api/v1.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_ROOT = API_ORIGIN + '/api/v1';
let csrfToken = '';

// Django rotates the CSRF token when the auth session changes (for example after a
// login in another tab), so a token cached at login time can go stale. Prefer the
// live csrftoken cookie set on this origin, falling back to the cached value.
function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function request<T>(path: string, init: RequestInit = {}, csrfRetry = false): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = csrfToken || readCsrfCookie();
  if (token && !['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase())) headers.set('X-CSRFToken', token);
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers, credentials: 'include' });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (response.status === 403 && !csrfRetry && typeof payload?.detail === 'string' && /CSRF/i.test(payload.detail)) {
    // The token was stale; refresh it from the API and retry the request once.
    await api.csrf();
    return request<T>(path, init, true);
  }
  if (!response.ok) {
    const detail = payload?.detail || payload?.error || (typeof payload === 'string' ? payload : '') || `Request failed (${response.status})`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return payload as T;
}
function safeJson(text: string): any { try { return JSON.parse(text); } catch { return text; } }

export const api = {
  home: () => request<HomePayload>('/home/'),
  settings: () => request<SiteSettings>('/settings/'),
  saveSettings: (payload: Partial<SiteSettings>) => request<SiteSettings>('/admin/settings/', { method: 'PUT', body: JSON.stringify(payload) }),
  related: (id: number) => request<ContentItem[]>(`/content/${id}/related/`),
  revisions: (id: number) => request<ContentRevision[]>(`/content/${id}/revisions/`),
  restoreRevision: (id: number, revisionId: number) => request<ContentItem>(`/content/${id}/restore-revision/`, { method: 'POST', body: JSON.stringify({ revision_id: revisionId }) }),
  analytics: (event_type: 'page_view' | 'outbound_click' | 'search', path: string, item_id?: number) => request<{ detail: string }>('/analytics/event/', { method: 'POST', body: JSON.stringify({ event_type, path, referrer: document.referrer, item_id }) }),
  adminAnalytics: () => request<AnalyticsSummary>('/admin/analytics/'),
  auditEvents: (params: Record<string, string> = {}) => request<AuditEventItem[]>(`/admin/audit/${new URLSearchParams(params).size ? `?${new URLSearchParams(params)}` : ''}`),
  newsletterSubscribers: (active = 'all') => request<NewsletterSubscriberItem[]>(`/admin/newsletter/${active === 'all' ? '' : `?active=${active}`}`),
  contactInbox: (archived = false) => request<ContactInboxItem[]>(`/admin/contact/?archived=${archived ? 'true' : 'false'}`),
  saveProfile: (payload: Partial<CreatorProfile>) => request<CreatorProfile>('/admin/profile/', { method: 'PUT', body: JSON.stringify(payload) }),
  team: () => request<TeamMember[]>('/admin/team/'),
  inviteTeamMember: (payload: { username: string; email: string; role: TeamRole }) => request<{ detail: string; member: TeamMember }>('/admin/team/', { method: 'POST', body: JSON.stringify(payload) }),
  updateTeamMember: (id: number, payload: { role?: TeamRole; is_active?: boolean; reset_two_factor?: boolean }) => request<TeamMember>(`/admin/team/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  saveCollection: (payload: Partial<Collection> & { item_ids?: number[] }, id?: number) => request<Collection>(id ? `/collections/${id}/` : '/collections/', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }),
  adminSuggestions: () => request<PageResult<{ id: number; title: string; url: string; reason: string; status: string; created_at: string }>>('/suggestions/?page_size=100'),
  reviewSuggestion: (id: number, status: 'pending' | 'approved' | 'rejected') => request<{ id: number; status: string }>(`/suggestions/${id}/review/`, { method: 'POST', body: JSON.stringify({ status }) }),
  bulkReviewSuggestions: (ids: number[], status: 'pending' | 'approved' | 'rejected') => request<{ updated: number; status: string }>('/suggestions/bulk-review/', { method: 'POST', body: JSON.stringify({ ids, status }) }),
  reviewContact: (id: number, reviewed: boolean) => request<{ id: number; reviewed: boolean }>('/admin/contact/', { method: 'PATCH', body: JSON.stringify({ id, reviewed }) }),
  archiveContact: (id: number, archived: boolean) => request<{ id: number; reviewed: boolean; archived: boolean }>(`/admin/contact/${id}/`, { method: 'PATCH', body: JSON.stringify({ archived }) }),
  deleteContact: (id: number) => request<void>(`/admin/contact/${id}/`, { method: 'DELETE' }),
  comments: (item_id?: number) => request<PageResult<ContentComment>>(`/comments/${item_id ? `?item_id=${item_id}` : ''}`),
  submitComment: (payload: { item_id: number; name: string; email: string; body: string }) => request<ContentComment>('/comments/', { method: 'POST', body: JSON.stringify(payload) }),
  moderateComment: (id: number, status: 'pending' | 'approved' | 'rejected') => request<ContentComment>(`/comments/${id}/moderate/`, { method: 'POST', body: JSON.stringify({ status }) }),
  reactions: (item_id: number) => request<{ counts: Record<'like' | 'love' | 'useful', number> }>(`/content/${item_id}/reactions/`),
  react: (item_id: number, reaction: 'like' | 'love' | 'useful') => request<{ counts: Record<'like' | 'love' | 'useful', number>; recorded: boolean }>(`/content/${item_id}/reactions/`, { method: 'POST', body: JSON.stringify({ reaction }) }),
  newsletterSubscribe: (email: string) => request<{ detail: string }>('/newsletter/subscribe/', { method: 'POST', body: JSON.stringify({ email }) }),
  requestPasswordReset: (email: string) => request<{ detail: string }>('/auth/password-reset/', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordReset: (uid: string, token: string, password: string) => request<{ detail: string }>('/auth/password-reset/confirm/', { method: 'POST', body: JSON.stringify({ uid, token, password }) }),
  content: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<PageResult<ContentItem>>(`/content/${query.size ? `?${query}` : ''}`);
  },
  contentDetail: (slug: string) => request<ContentItem>(`/content/by-slug/${encodeURIComponent(slug)}/`),
  categories: () => request<PageResult<Category>>('/categories/'),
  tags: () => request<PageResult<Tag>>('/tags/'),
  collections: () => request<PageResult<Collection>>('/collections/'),
  collectionDetail: (slug: string) => request<Collection>(`/collections/by-slug/${encodeURIComponent(slug)}/`),
  profile: () => request<CreatorProfile>('/profile/'),
  contact: (payload: { name: string; email: string; message: string }) => request<{ detail: string }>('/contact/', { method: 'POST', body: JSON.stringify(payload) }),
  suggest: (payload: { title: string; url: string; reason: string }) => request<{ detail: string }>('/suggestions/', { method: 'POST', body: JSON.stringify(payload) }),
  csrf: async () => {
    const result = await request<{ csrfToken: string }>('/auth/csrf/'); csrfToken = result.csrfToken; return result;
  },
  login: async (username: string, password: string): Promise<StaffLoginResponse> => {
    await api.csrf();
    const result = await request<StaffLoginResponse>('/auth/login/', { method: 'POST', body: JSON.stringify({ username, password }) });
    await api.csrf(); // Django rotates the CSRF token on login; refresh the cached value.
    return result;
  },
  verifyTwoFactorLogin: async (challenge: string, code: string) => {
    await api.csrf();
    const result = await request<{ detail: string; user: AdminUser }>('/auth/2fa/verify-login/', { method: 'POST', body: JSON.stringify({ challenge, code }) });
    return result.user;
  },
  twoFactorStatus: () => request<TwoFactorStatus>('/auth/2fa/'),
  enableTwoFactor: (code: string) => request<{ detail: string; enabled: boolean }>('/auth/2fa/', { method: 'POST', body: JSON.stringify({ action: 'enable', code }) }),
  disableTwoFactor: (code: string, password: string) => request<{ detail: string; enabled: boolean }>('/auth/2fa/', { method: 'POST', body: JSON.stringify({ action: 'disable', code, password }) }),
  logout: async () => { await api.csrf(); return request<{ detail: string }>('/auth/logout/', { method: 'POST', body: JSON.stringify({}) }); },
  me: async () => { await api.csrf(); return request<AdminUser>('/auth/me/'); },
  session: () => request<{ authenticated: boolean; user?: AdminUser }>('/auth/session/'),
  adminStats: () => request<AdminStats>('/admin/stats/'),
  adminContent: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<PageResult<ContentItem>>(`/content/${query.size ? `?${query}` : ''}`);
  },
  saveContent: (payload: Partial<ContentItem>, id?: number) => request<ContentItem>(id ? `/content/${id}/` : '/content/', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }),
  deleteContent: (id: number) => request<void>(`/content/${id}/`, { method: 'DELETE' }),
  media: () => request<PageResult<MediaAsset>>('/admin/media/'),
  deleteMedia: (id: number) => request<void>(`/admin/media/${id}/`, { method: 'DELETE' }),
  updateMedia: (id: number, payload: { title?: string; description?: string; alt_text?: string; visibility?: string; downloadable?: boolean }) => request<MediaAsset>(`/admin/media/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadMedia: async (form: FormData, onProgress?: (progress: number) => void): Promise<MediaAsset> => {
    if (!csrfToken && !readCsrfCookie()) await api.csrf();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_ROOT}/admin/media/upload/`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-CSRFToken', csrfToken || readCsrfCookie());
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.onprogress = event => {
        if (event.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onerror = () => reject(new Error('Upload connection failed.'));
      xhr.onabort = () => reject(new Error('Upload cancelled.'));
      xhr.onload = () => {
        const payload = xhr.responseText ? safeJson(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload as MediaAsset);
        else {
          const detail = payload?.detail || payload?.error || `Upload failed (${xhr.status})`;
          reject(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)));
        }
      };
      xhr.send(form);
    });
  },
  signedMediaUrl: (id: number) => request<{ url: string; expires_in: number }>(`/media/${id}/signed-url/`),
};

export type TeamRole = 'administrator' | 'editor' | 'moderator' | 'support';
export interface AdminUser { id: number; username: string; email: string; is_staff: boolean; is_superuser?: boolean; role?: TeamRole; }
export interface TeamMember { id: number; username: string; email: string; is_active: boolean; is_superuser: boolean; role: TeamRole | 'none'; last_login: string | null; }
export interface AdminStats { published: number; drafts: number; scheduled: number; assets: number; suggestions_pending: number; }

export interface SiteSettings { site_title: string; logo_url: string; favicon_url: string; seo_description: string; homepage_sections: string[]; theme_preferences: Record<string, string>; owner_name: string; copyright_text: string; youtube_url: string; site_copy: Record<string, string>; updated_at?: string; }
export interface ContentRevision { id: number; revision_number: number; snapshot: Record<string, unknown>; editor_username: string; created_at: string; }
export interface ContentComment { id: number; item_id?: number; name: string; email?: string; body: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; }
export interface ContactInboxItem { id: number; name: string; email: string; message: string; reviewed: boolean; archived: boolean; created_at: string; }
export interface AnalyticsSummary { period_days: number; page_views: number; outbound_clicks: number; searches: number; unique_daily_visitors_approx: number; popular_paths: { path: string; views: number }[]; daily_page_views: { day: string; views: number }[]; }

export interface AuditEventItem { id: number; actor: string; action: string; object_type: string; object_id: string; details: Record<string, unknown>; created_at: string; }
export interface NewsletterSubscriberItem { id: number; email: string; is_active: boolean; confirmed_at: string | null; created_at: string; }

export interface StaffLoginResponse { detail: string; user?: AdminUser; requires_two_factor?: boolean; challenge?: string; }
export interface TwoFactorStatus { enabled: boolean; secret: string; otpauth_uri: string; }
