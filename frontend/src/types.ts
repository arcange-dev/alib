export type ContentType = 'article' | 'note' | 'link' | 'project' | 'video' | 'book' | 'resource' | 'file' | 'gallery' | 'podcast';
export type ContentStatus = 'draft' | 'published' | 'scheduled' | 'archived';
export type Visibility = 'public' | 'unlisted' | 'private';

export interface Category { id: number; name: string; slug: string; description: string; }
export interface Tag { id: number; name: string; slug: string; }
export interface Collection { id: number; title: string; slug: string; description: string; cover_image_url: string; item_count?: number; }
export interface ContentItem {
  id: number; title: string; slug: string; summary: string; body: string; content_type: ContentType;
  source_url: string; cover_image_url: string; category: Category | null; tags: Tag[];
  visibility: Visibility; status: ContentStatus; featured: boolean; allow_download: boolean;
  published_at: string | null; created_at: string; updated_at: string; collection_slugs: string[];
}
export interface CreatorProfile {
  display_name: string; headline: string; biography: string; avatar_url: string; location: string;
  social_links: Record<string, string>; updated_at?: string;
}
export interface HomePayload {
  profile: CreatorProfile; featured: ContentItem[]; latest: ContentItem[]; categories: Category[];
  collections: Collection[]; counts: { published: number; projects: number; collections: number };
}
export interface PageResult<T> { count: number; next: string | null; previous: string | null; results: T[]; }
export interface MediaAsset {
  id: number; original_filename: string; title: string; description: string; mime_type: string;
  file_size: number; visibility: Visibility; downloadable: boolean; created_at: string;
}
