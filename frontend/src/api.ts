import type { Category, Collection, ContentItem, CreatorProfile, HomePayload, MediaAsset, PageResult } from './types';

// Empty VITE_API_URL means same-origin API requests (the recommended Render setup).
// For a separately hosted frontend, set it to the API origin without /api/v1.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_ROOT = API_ORIGIN + '/api/v1';
let csrfToken = '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase())) headers.set('X-CSRFToken', csrfToken);
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers, credentials: 'include' });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    const detail = payload?.detail || payload?.error || (typeof payload === 'string' ? payload : '') || `Request failed (${response.status})`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return payload as T;
}
function safeJson(text: string): any { try { return JSON.parse(text); } catch { return text; } }

export const api = {
  home: () => request<HomePayload>('/home/'),
  content: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<PageResult<ContentItem>>(`/content/${query.size ? `?${query}` : ''}`);
  },
  contentDetail: (slug: string) => request<ContentItem>(`/content/${encodeURIComponent(slug)}/`),
  categories: () => request<PageResult<Category>>('/categories/'),
  collections: () => request<PageResult<Collection>>('/collections/'),
  profile: () => request<CreatorProfile>('/profile/'),
  contact: (payload: { name: string; email: string; message: string }) => request<{ detail: string }>('/contact/', { method: 'POST', body: JSON.stringify(payload) }),
  suggest: (payload: { title: string; url: string; reason: string }) => request<{ detail: string }>('/suggestions/', { method: 'POST', body: JSON.stringify(payload) }),
  csrf: async () => {
    const result = await request<{ csrfToken: string }>('/auth/csrf/'); csrfToken = result.csrfToken; return result;
  },
  login: async (username: string, password: string) => {
    await api.csrf();
    const result = await request<{ detail: string; user: AdminUser }>('/auth/login/', { method: 'POST', body: JSON.stringify({ username, password }) });
    return result.user;
  },
  logout: async () => { await api.csrf(); return request<{ detail: string }>('/auth/logout/', { method: 'POST', body: JSON.stringify({}) }); },
  me: async () => { await api.csrf(); return request<AdminUser>('/auth/me/'); },
  adminStats: () => request<AdminStats>('/admin/stats/'),
  adminContent: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<PageResult<ContentItem>>(`/content/${query.size ? `?${query}` : ''}`);
  },
  saveContent: (payload: Partial<ContentItem>, id?: number) => request<ContentItem>(id ? `/content/${id}/` : '/content/', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }),
  deleteContent: (id: number) => request<void>(`/content/${id}/`, { method: 'DELETE' }),
  media: () => request<PageResult<MediaAsset>>('/admin/media/'),
  updateMedia: (id: number, payload: { title?: string; description?: string; visibility?: string; downloadable?: boolean }) => request<MediaAsset>(`/admin/media/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadMedia: (form: FormData) => request<MediaAsset>('/admin/media/upload/', { method: 'POST', body: form }),
  signedMediaUrl: (id: number) => request<{ url: string; expires_in: number }>(`/media/${id}/signed-url/`),
};

export interface AdminUser { id: number; username: string; email: string; is_staff: boolean; }
export interface AdminStats { published: number; drafts: number; scheduled: number; assets: number; suggestions_pending: number; }
