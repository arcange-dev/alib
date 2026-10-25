import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Command,
  Compass, ExternalLink, FileText, Filter, FolderOpen, Globe2, Heart, History, Inbox, Layers3, Link2, LockKeyhole,
  LogOut, Mail, Menu, MessageCircle, Moon, PenLine, Plus, Search, Share2, ShieldCheck, Sparkles, Sun, ThumbsUp, Trash2, Upload, Video, X, BarChart3, Settings2,
} from 'lucide-react';
import { api, type AdminStats, type AdminUser } from './api';
import type { Category, Collection, ContentItem, ContentType, CreatorProfile, HomePayload, MediaAsset } from './types';

const fallbackProfile: CreatorProfile = {
  display_name: 'Your name', headline: 'A home for ideas worth keeping.',
  biography: 'A personal space for work in progress, useful links, thoughtful notes, and the things worth returning to.',
  avatar_url: '', location: '', social_links: {},
};

const navItems = [
  { to: '/', label: 'Home', icon: Compass },
  { to: '/discover', label: 'Discover', icon: Search },
  { to: '/posts', label: 'Writing', icon: PenLine },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/projects', label: 'Projects', icon: Layers3 },
  { to: '/resources', label: 'Resources', icon: BookOpen },
];

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('alib-theme') === 'dark');
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('alib-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const labels: Record<string, string> = { '/': 'Digital Home', '/discover': 'Discover', '/posts': 'Writing', '/favorites': 'Reading List', '/projects': 'Projects', '/resources': 'Resources', '/collections': 'Collections', '/about': 'About', '/contact': 'Contact', '/suggest': 'Recommend', '/admin': 'Creator Studio' };
    document.title = `${labels[location.pathname] || 'Explore'} | ALIB`;
    void api.analytics('page_view', location.pathname).catch(() => {});
    api.settings().then(site => {
      const description = document.querySelector('meta[name="description"]');
      if (description && site.seo_description) description.setAttribute('content', site.seo_description);
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (icon && site.favicon_url) icon.href = site.favicon_url;
      if (location.pathname === '/' && site.site_title) document.title = site.site_title;
    }).catch(() => {});
  }, [location.pathname]);
  useEffect(() => setMobileNav(false), []);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader dark={dark} setDark={setDark} mobileNav={mobileNav} setMobileNav={setMobileNav} />
    {mobileNav && <button type="button" className="mobile-nav-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation menu" />}
    <main id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/posts" element={<LibraryPage title="Writing" description="Notes, essays, and longer ideas." types={['article', 'note']} />} />
        <Route path="/posts/:slug" element={<ContentDetailPage />} />
        <Route path="/content/:slug" element={<ContentDetailPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:slug" element={<CollectionDetailPage />} />
        <Route path="/projects" element={<LibraryPage title="Projects" description="Things being built, explored, or kept in motion." types={['project']} />} />
        <Route path="/projects/:slug" element={<ContentDetailPage />} />
        <Route path="/resources" element={<LibraryPage title="Resources" description="Books, tools, documents, and references worth keeping close." types={['resource', 'book', 'video', 'file', 'podcast', 'gallery']} />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/suggest" element={<SuggestPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
    <SiteFooter />
  </div>;
}

function SiteHeader({ dark, setDark, mobileNav, setMobileNav }: { dark: boolean; setDark: (v: boolean) => void; mobileNav: boolean; setMobileNav: (v: boolean) => void }) {
  const location = useLocation();
  useEffect(() => setMobileNav(false), [location.pathname, setMobileNav]);
  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand" aria-label="ALIB home"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link>
      <nav className={`primary-nav ${mobileNav ? 'is-open' : ''}`} aria-label="Main navigation">
        {navItems.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>)}
      </nav>
      <div className="header-actions">
        <Link to="/discover" className="icon-button search-shortcut" aria-label="Search content"><Search size={18} /><span>Search</span></Link>
        <button className="icon-button theme-toggle" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <Link to="/admin" className="studio-link"><span>Creator Studio</span><ArrowUpRight size={15} /></Link>
        <button className="icon-button mobile-menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileNav}>{mobileNav ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div>
  </header>;
}

function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner">
    <Link to="/" className="brand footer-brand"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link>
    <p>A small home for a growing digital world.</p>
    <div className="footer-links"><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/suggest">Recommend</Link><Link to="/privacy">Privacy</Link><a href="/feed.xml">RSS feed <ArrowUpRight size={13} /></a><Link to="/admin">Creator Studio <ArrowUpRight size={13} /></Link></div>
    <NewsletterSignup />
    <span className="footer-year">© {new Date().getFullYear()} ALIB</span>
  </div></footer>;
}

function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setStatus('');
    try { const result = await api.newsletterSubscribe(email); setStatus(result.detail); setEmail(''); }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Subscription could not be submitted.'); }
    finally { setBusy(false); }
  }
  return <form className="newsletter-signup" onSubmit={submit}><label htmlFor="newsletter-email">Occasional notes from the archive</label><div><input id="newsletter-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" autoComplete="email" /><button className="button button-primary button-small" disabled={busy}>{busy ? 'Sending…' : 'Subscribe'}</button></div>{status && <p role="status">{status}</p>}</form>;
}

function useHome() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.home().then(setData).catch(e => setError(e instanceof Error ? e.message : 'The content service is unavailable.')); }, []);
  return { data, error };
}

function HomePage() {
  const { data, error } = useHome();
  const profile = data?.profile || fallbackProfile;
  const latest = data?.latest || [];
  const featured = data?.featured || [];
  return <>
    <section className="hero section-wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="status-dot" /> A PERSONAL DIGITAL SPACE <span className="eyebrow-rule" /></div>
        <h1>{profile.headline || 'A home for ideas worth keeping.'}</h1>
        <p className="hero-intro">A personal library of projects, thoughtful notes, useful links, and the digital things that make you curious.</p>
        <div className="hero-actions"><Link className="button button-primary" to="/discover">Explore the library <ArrowRight size={17} /></Link><Link className="text-link" to="/about">A little about this space <ArrowUpRight size={16} /></Link></div>
        <div className="hero-meta"><span><span className="meta-number">01</span> Curated by its creator</span><span><span className="meta-number">02</span> Always evolving</span></div>
      </div>
      <div className="hero-art" aria-label="Abstract editorial composition" role="img">
        <div className="art-corner art-corner-top">ALIB / DIGITAL HOME</div>
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="art-disc"><span>A</span><small>ARCHIVE<br />OF IDEAS</small></div>
        <div className="art-note note-top"><span className="note-dot yellow" /> Curiosity, collected</div>
        <div className="art-note note-bottom"><span className="note-line" /> Notes · Links · Projects</div>
        <div className="art-index">FIG. 001</div>
      </div>
    </section>

    <section className="ticker" aria-label="ALIB content types"><div className="ticker-inner"><span>READ</span><i>✳</i><span>DISCOVER</span><i>✳</i><span>COLLECT</span><i>✳</i><span>BUILD</span><i>✳</i><span>RETURN</span><i>✳</i><span>READ</span><i>✳</i><span>DISCOVER</span><i>✳</i><span>COLLECT</span></div></section>

    <section className="section-wrap section-block intro-band">
      <div className="section-kicker">THE IDEA / 001</div><div className="intro-band-copy"><h2>Not just a portfolio.<br /><em>A place to wander.</em></h2><p>Some things deserve more than a bookmark. ALIB brings together the work being made, the ideas being explored, and the resources worth passing along — all in one thoughtful, searchable place.</p><Link className="text-link" to="/about">Get to know the space <ArrowUpRight size={16} /></Link></div>
    </section>

    <section className="section-wrap section-block">
      <SectionHeading kicker="THE HIGHLIGHTS / 02" title="Worth a closer look" linkTo="/discover" linkLabel="Explore everything" />
      {error && <InlineNotice text="The API is not connected yet. The site is ready for your first published items; check the setup guide to connect the database." />}
      {featured.length ? <ContentGrid items={featured.slice(0, 3)} /> : <EmptyFeature />}
    </section>

    <section className="section-wrap section-block latest-block">
      <SectionHeading kicker="RECENTLY ADDED / 03" title="Fresh from the archive" linkTo="/discover" linkLabel="Browse the archive" />
      {latest.length ? <ContentGrid items={latest.slice(0, 4)} compact /> : <div className="empty-list"><div className="empty-icon"><FolderOpen size={23} /></div><div><h3>The first page is still unwritten.</h3><p>Publish an article, save a useful link, or add a project in Creator Studio. It will appear here automatically.</p></div><Link to="/admin" className="button button-outline">Open Creator Studio <ArrowUpRight size={15} /></Link></div>}
    </section>

    <section className="section-wrap section-block pathways-block">
      <SectionHeading kicker="FIND YOUR WAY / 04" title="Different paths in." />
      <div className="pathway-grid">
        <Pathway to="/posts" number="01" title="Read & reflect" body="Essays, notes, and things learned along the way." icon={<BookOpen size={20} />} />
        <Pathway to="/favorites" number="02" title="Save a little wonder" body="Websites and digital tools worth remembering." icon={<Heart size={20} />} />
        <Pathway to="/projects" number="03" title="See what's being built" body="Experiments, side projects, and work in progress." icon={<Layers3 size={20} />} />
        <Pathway to="/resources" number="04" title="Keep learning" body="Books, references, documents, and useful media." icon={<Compass size={20} />} />
      </div>
    </section>

    <section className="closing-cta"><div className="closing-cta-inner"><span className="closing-star"><Sparkles size={21} /></span><div><p className="section-kicker">A LIVING COLLECTION</p><h2>Good things are better<br /><em>when they’re easy to find.</em></h2><p>Have something worth adding? Send a recommendation for the archive.</p></div><Link className="button button-light" to="/suggest">Share a recommendation <ArrowRight size={16} /></Link></div></section>
    <section className="section-wrap stat-strip"><div><strong>{data?.counts.published ?? '—'}</strong><span>Published items</span></div><div><strong>{data?.counts.projects ?? '—'}</strong><span>Projects</span></div><div><strong>{data?.counts.collections ?? '—'}</strong><span>Collections</span></div><p>Counts reflect the live archive, not estimates.</p></section>
  </>;
}

function SectionHeading({ kicker, title, linkTo, linkLabel }: { kicker: string; title: string; linkTo?: string; linkLabel?: string }) {
  return <div className="section-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div>{linkTo && <Link className="text-link" to={linkTo}>{linkLabel || 'Explore'} <ArrowUpRight size={15} /></Link>}</div>;
}

function Pathway({ to, number, title, body, icon }: { to: string; number: string; title: string; body: string; icon: ReactNode }) {
  return <Link to={to} className="pathway-card"><span className="pathway-number">{number}</span><span className="pathway-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{body}</p><span className="pathway-arrow"><ArrowUpRight size={18} /></span></Link>;
}

function EmptyFeature() {
  return <div className="featured-empty"><div className="feature-empty-left"><span className="section-kicker">THE COLLECTION STARTS HERE</span><h3>Every interesting thing<br />has a place to land.</h3><p>This space will fill with standout stories, projects, and discoveries as they are published.</p><Link className="text-link" to="/admin">Add the first feature <ArrowUpRight size={15} /></Link></div><div className="feature-empty-graphic"><div className="paper paper-one" /><div className="paper paper-two" /><div className="paper paper-three"><span>ALIB</span><small>THE ARCHIVE<br />IS OPEN</small></div><div className="paper-spark">✳</div></div></div>;
}

function InlineNotice({ text }: { text: string }) { return <div className="inline-notice"><CircleHelp size={17} /><p>{text}</p></div>; }

function ContentGrid({ items, compact = false }: { items: ContentItem[]; compact?: boolean }) {
  return <div className={`content-grid ${compact ? 'compact-grid' : ''}`}>{items.map((item, index) => <ContentCard key={item.id} item={item} index={index} />)}</div>;
}

function ContentCard({ item, index }: { item: ContentItem; index: number }) {
  const cover = item.cover_image_url;
  return <article className={`content-card card-index-${index % 3}`}>
    <Link to={item.content_type === 'article' || item.content_type === 'note' ? `/posts/${item.slug}` : item.content_type === 'project' ? `/projects/${item.slug}` : `/content/${item.slug}`} className={`card-image ${cover ? 'has-cover' : ''}`} aria-label={`Open ${item.title}`}>
      {cover ? <img src={cover} alt="" loading="lazy" /> : <DefaultCover type={item.content_type} title={item.title} />}
      <span className="card-type">{labelType(item.content_type)}</span><span className="card-open"><ArrowUpRight size={18} /></span>
    </Link>
    <BookmarkButton itemId={item.id} compact />
    <div className="card-content"><div className="card-meta"><span>{item.category?.name || labelType(item.content_type)}</span><span className="meta-separator">/</span><span>{formatDate(item.published_at || item.created_at)}</span></div>
      <h3><Link to={item.content_type === 'article' || item.content_type === 'note' ? `/posts/${item.slug}` : item.content_type === 'project' ? `/projects/${item.slug}` : `/content/${item.slug}`}>{item.title}</Link></h3>
      <p>{item.summary || 'Open this item to explore more.'}</p>
      {item.tags.length > 0 && <div className="tag-row">{item.tags.slice(0, 3).map(tag => <span key={tag.id}>#{tag.name}</span>)}</div>}
    </div>
  </article>;
}

function DefaultCover({ type, title }: { type: ContentType; title: string }) {
  const Icon = type === 'article' || type === 'note' ? FileText : type === 'video' || type === 'podcast' ? Video : type === 'link' ? Link2 : type === 'book' ? BookOpen : type === 'project' ? Layers3 : FolderOpen;
  return <div className={`default-cover cover-${type}`}><div className="cover-topline"><span>ALIB / INDEX</span><span>{String(title.length).padStart(2, '0')}</span></div><Icon size={33} strokeWidth={1.3} /><span className="cover-title">{title}</span><span className="cover-bottomline">ARCHIVE ENTRY</span></div>;
}

function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allItems, setAllItems] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = searchParams.get('q') || '';
  const activeType = searchParams.get('type') || 'all';
  const activeCategory = searchParams.get('category') || 'all';
  const deferredSearch = useDeferredValue(search);
  useEffect(() => { Promise.all([api.content({ page_size: '100' }), api.categories()]).then(([items, cats]) => { setAllItems(items.results); setCategories(cats.results); }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load content.')).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => allItems.filter(item => {
    const term = deferredSearch.trim().toLowerCase();
    const matchesSearch = !term || [item.title, item.summary, item.body, item.source_url, ...(item.tags || []).map(t => t.name)].some(value => value?.toLowerCase().includes(term));
    return matchesSearch && (activeType === 'all' || item.content_type === activeType) && (activeCategory === 'all' || String(item.category?.id) === activeCategory);
  }), [allItems, deferredSearch, activeType, activeCategory]);
  const updateParam = (key: string, value: string) => { const next = new URLSearchParams(searchParams); if (!value || value === 'all') next.delete(key); else next.set(key, value); setSearchParams(next); };
  const types = ['all', 'article', 'note', 'link', 'project', 'video', 'book', 'resource', 'file'];
  return <div className="page-wrap section-wrap page-enter">
    <div className="page-hero"><div className="eyebrow">DISCOVERY / 01 <span className="eyebrow-rule" /></div><h1>Find your<br /><em>next rabbit hole.</em></h1><p>A searchable index of ideas, projects, and resources gathered here.</p></div>
    <div className="discover-toolbar"><label className="search-field"><Search size={19} /><span className="sr-only">Search published content</span><input value={search} onChange={e => updateParam('q', e.target.value)} placeholder="Search titles, topics, tags…" /><kbd>↵</kbd></label><label className="filter-field"><Filter size={17} /><span className="sr-only">Filter by category</span><select value={activeCategory} onChange={e => updateParam('category', e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15} /></label></div>
    <div className="filter-pills" role="group" aria-label="Filter by content type">{types.map(t => <button key={t} className={`filter-pill ${activeType === t ? 'selected' : ''}`} onClick={() => updateParam('type', t)} aria-pressed={activeType === t}>{t === 'all' ? 'Everything' : labelType(t as ContentType)}</button>)}</div>
    <div className="results-line"><span>{loading ? 'Loading the archive…' : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}</span><span>Sorted by newest</span></div>
    {error && <InlineNotice text="The API could not be reached. Connect the backend and database to load published content." />}
    {!loading && filtered.length > 0 && <ContentGrid items={filtered} compact />}
    {!loading && !filtered.length && <div className="empty-state"><div className="empty-icon"><Search size={24} /></div><h2>{error ? 'Your archive is waiting to connect.' : 'Nothing here by that name. Yet.'}</h2><p>{error ? 'Run the Django API and connect Supabase PostgreSQL to show published items.' : 'Try another search or clear the filters. Newly published content will appear here.'}</p><button className="button button-outline" onClick={() => setSearchParams({})}>Clear all filters</button></div>}
  </div>;
}

const BOOKMARKS_KEY = 'alib-bookmarks';

function readBookmarks(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is number => Number.isInteger(id)) : [];
  } catch { return []; }
}
function writeBookmarks(ids: number[]) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...new Set(ids)])); window.dispatchEvent(new Event('alib-bookmarks-changed')); } catch { /* Storage may be disabled; the page remains usable. */ }
}
function BookmarkButton({ itemId, compact = false }: { itemId: number; compact?: boolean }) {
  const [saved, setSaved] = useState(() => readBookmarks().includes(itemId));
  useEffect(() => {
    const sync = () => setSaved(readBookmarks().includes(itemId));
    window.addEventListener('alib-bookmarks-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('alib-bookmarks-changed', sync); window.removeEventListener('storage', sync); };
  }, [itemId]);
  return <button type="button" className={`bookmark-button ${compact ? 'bookmark-compact' : ''} ${saved ? 'is-saved' : ''}`} onClick={() => { const ids = readBookmarks(); writeBookmarks(saved ? ids.filter(id => id !== itemId) : [...ids, itemId]); setSaved(!saved); }} aria-pressed={saved} aria-label={saved ? 'Remove from reading list' : 'Save to reading list'} title={saved ? 'Remove from reading list' : 'Save to reading list'}>{saved ? <Bookmark size={15} fill="currentColor" /> : <Bookmark size={15} />}{compact ? null : <span>{saved ? 'Saved' : 'Save for later'}</span>}</button>;
}

function FavoritesPage() {
  const [allItems, setAllItems] = useState<ContentItem[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>(() => readBookmarks());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setSavedIds(readBookmarks());
    window.addEventListener('alib-bookmarks-changed', sync);
    window.addEventListener('storage', sync);
    api.content({ page_size: '100' }).then(data => setAllItems(data.results)).catch(e => setError(e instanceof Error ? e.message : 'Unable to load the reading list.')).finally(() => setLoading(false));
    return () => { window.removeEventListener('alib-bookmarks-changed', sync); window.removeEventListener('storage', sync); };
  }, []);
  const saved = allItems.filter(item => savedIds.includes(item.id));
  return <div className="page-wrap section-wrap page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">YOUR PRIVATE READING LIST <span className="eyebrow-rule" /></div><h1>Keep close<span className="title-period">.</span></h1><p>Items saved in this browser for another time. This list stays on this device and does not require an account.</p></div>{loading ? <LoadingRows /> : error ? <EmptyState title="Your reading list could not load." body={error} /> : saved.length ? <ContentGrid items={saved} compact /> : <EmptyState title="Save something for later." body="Use the bookmark icon on any public item and it will appear here on this browser." action={<Link className="button button-primary" to="/discover">Explore the archive <ArrowRight size={15} /></Link>} />}</div>;
}

function LibraryPage({ title, description, types }: { title: string; description: string; types: ContentType[] }) {
  const [items, setItems] = useState<ContentItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { api.content({ page_size: '100' }).then(data => setItems(data.results.filter(item => types.includes(item.content_type)))).catch(e => setError(e instanceof Error ? e.message : 'Unable to load content.')).finally(() => setLoading(false)); }, [types.join(',')]);
  return <div className="page-wrap section-wrap page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">THE ARCHIVE <span className="eyebrow-rule" /></div><h1>{title}<span className="title-period">.</span></h1><p>{description}</p></div>
    {loading ? <LoadingRows /> : error ? <EmptyState title="The archive is not connected yet." body="Start the Django API and connect Supabase to load public items." /> : items.length ? <ContentGrid items={items} compact /> : <EmptyState title={`No ${title.toLowerCase()} published yet.`} body="When the creator publishes content in Creator Studio, it will show up here automatically." action={<Link className="button button-outline" to="/admin">Open Creator Studio <ArrowUpRight size={15} /></Link>} />}
  </div>;
}

function LoadingRows() { return <div className="loading-grid" aria-label="Loading content">{[1, 2, 3].map(n => <div key={n} className="skeleton-card"><div className="skeleton-block" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>; }

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><FolderOpen size={24} /></div><h2>{title}</h2><p>{body}</p>{action}</div>; }

function ContentDetailPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<'like' | 'love' | 'useful', number>>({ like: 0, love: 0, useful: 0 });
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentName, setCommentName] = useState('');
  const [commentEmail, setCommentEmail] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  useEffect(() => {
    setLoading(true); setError(''); setItem(null);
    api.contentDetail(slug).then(setItem).catch(e => setError(e instanceof Error ? e.message : 'This item is unavailable.')).finally(() => setLoading(false));
  }, [slug]);
  useEffect(() => {
    if (!item) return;
    document.title = `${item.title} | ALIB`;
    const description = document.querySelector('meta[name="description"]');
    if (description && item.summary) description.setAttribute('content', item.summary);
    api.related(item.id).then(setRelated).catch(() => setRelated([]));
    api.reactions(item.id).then(result => setReactionCounts(result.counts)).catch(() => {});
    api.comments(item.id).then(result => setComments(result.results)).catch(() => setComments([]));
  }, [item?.id]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Copying is unavailable in this browser.'); }
  }
  async function shareItem() {
    if (navigator.share) {
      try { await navigator.share({ title: item?.title || 'ALIB', text: item?.summary || '', url: window.location.href }); return; }
      catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
    }
    await copyLink();
  }
  async function reactToItem(reaction: 'like' | 'love' | 'useful') {
    if (!item) return;
    try {
      const result = await api.react(item.id, reaction);
      setReactionCounts(result.counts);
      setCommentMessage(result.recorded ? 'Thanks for sharing your reaction.' : 'Your reaction was already recorded from this connection.');
    } catch (e) { setCommentMessage(e instanceof Error ? e.message : 'Reaction could not be saved.'); }
  }
  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    setCommentBusy(true); setCommentMessage('');
    try {
      await api.submitComment({ item_id: item.id, name: commentName, email: commentEmail, body: commentBody });
      setCommentMessage('Your comment was submitted for moderation. It will appear after approval.');
      setCommentName(''); setCommentEmail(''); setCommentBody('');
    } catch (e) { setCommentMessage(e instanceof Error ? e.message : 'Comment could not be submitted.'); }
    finally { setCommentBusy(false); }
  }
  if (loading) return <div className="page-wrap section-wrap detail-loading"><LoadingRows /></div>;
  if (!item) return <div className="page-wrap section-wrap"><EmptyState title="We couldn’t find that item." body={error || 'It may be private, unpublished, or have a different address.'} action={<Link to="/discover" className="button button-outline"><ArrowLeft size={15} /> Back to discovery</Link>} /></div>;
  const cover = item.cover_image_url;
  return <article className="detail-page section-wrap page-enter">
    <Link className="back-link" to="/discover"><ArrowLeft size={15} /> Back to discovery</Link>
    <header className="detail-header">
      <div className="eyebrow">{labelType(item.content_type).toUpperCase()} / ENTRY <span className="eyebrow-rule" /></div>
      <h1>{item.title}</h1><p className="detail-summary">{item.summary}</p>
      <div className="detail-byline"><span>{item.category?.name || 'ALIB archive'}</span><span>·</span><span>{formatDate(item.published_at || item.created_at)}</span><span>·</span><button className="inline-action" onClick={copyLink}>{copied ? <Check size={14} /> : <Link2 size={14} />}{copied ? 'Copied link' : 'Copy link'}</button></div>
      <div className="detail-actions"><BookmarkButton itemId={item.id} /><button className="button button-outline button-small" onClick={() => void shareItem()}><Share2 size={15} /> Share</button></div>
    </header>
    {cover ? <img className="detail-cover" src={cover} alt="" /> : <div className="detail-cover detail-cover-fallback"><DefaultCover type={item.content_type} title={item.title} /></div>}
    <div className="detail-body-layout">
      <div className="detail-body">
        <ContentBody body={item.body || 'This entry does not have a longer description yet.'} />
        {item.source_url && <div className="source-link-card"><div className="source-icon"><Globe2 size={20} /></div><div><span className="section-kicker">ORIGINAL SOURCE</span><h3>Continue exploring</h3><p>Open the original item on its source website.</p></div><a className="button button-primary" href={item.source_url} target="_blank" rel="noreferrer" onClick={() => void api.analytics('outbound_click', location.pathname, item.id).catch(() => {})}>Visit source <ExternalLink size={15} /></a></div>}
      </div>
      <aside className="detail-aside"><span className="section-kicker">IN THIS ENTRY</span>{item.tags?.length > 0 && <div className="detail-tag-list">{item.tags.map(tag => <Link key={tag.id} to={`/discover?q=${encodeURIComponent(tag.name)}`}>#{tag.name}</Link>)}</div>}<button className="button button-outline full-width" onClick={() => void shareItem()}><Share2 size={15} /> Share this item</button><p className="detail-aside-note">RSS readers can follow the latest public posts from the <a href="/feed.xml">ALIB feed</a>.</p></aside>
    </div>
    <section className="reader-engagement">
      <div className="reader-reactions"><span className="section-kicker">WAS THIS USEFUL?</span><div>
        <button className="reaction-button" onClick={() => void reactToItem('like')}><ThumbsUp size={15} /> Like <span>{reactionCounts.like}</span></button>
        <button className="reaction-button" onClick={() => void reactToItem('love')}><Heart size={15} /> Loved <span>{reactionCounts.love}</span></button>
        <button className="reaction-button" onClick={() => void reactToItem('useful')}><Check size={15} /> Useful <span>{reactionCounts.useful}</span></button>
      </div></div>
      <div className="comments-area"><span className="section-kicker">COMMUNITY NOTES</span><h2>Leave a thoughtful comment</h2><p>Comments are reviewed before publication. Your email is kept private.</p>
        {commentMessage && <div className={/could not|already|error|configure/i.test(commentMessage) ? 'inline-notice' : 'success-message'} role="status">{commentMessage}</div>}
        <form className="comment-form" onSubmit={submitComment}><div className="form-two-col"><label>Your name<input required maxLength={120} value={commentName} onChange={e => setCommentName(e.target.value)} /></label><label>Email (not public)<input type="email" required value={commentEmail} onChange={e => setCommentEmail(e.target.value)} /></label></div><label>Comment<textarea required minLength={3} maxLength={3000} rows={4} value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Add something useful to the conversation…" /></label><button className="button button-primary" disabled={commentBusy}>{commentBusy ? 'Submitting…' : 'Submit for review'} <MessageCircle size={15} /></button></form>
        {comments.length > 0 ? <div className="approved-comments">{comments.map(comment => <article className="approved-comment" key={comment.id}><strong>{comment.name}</strong><time>{formatDate(comment.created_at)}</time><p>{comment.body}</p></article>)}</div> : <p className="comment-empty">No approved comments yet.</p>}
      </div>
    </section>
    {related.length > 0 && <section className="related-section"><SectionHeading kicker="CONTINUE EXPLORING" title="Related from the archive" linkTo="/discover" linkLabel="Browse all" /><ContentGrid items={related} compact /></section>}
  </article>;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
}

function ContentBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, '\n').split(/\n\s*\n/).filter(block => block.trim());
  return <div className="content-markdown">{blocks.map((block, index) => {
    const trimmed = block.trim();
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const content = renderInlineMarkdown(heading[2]);
      if (heading[1].length === 1) return <h2 key={index}>{content}</h2>;
      if (heading[1].length === 2) return <h3 key={index}>{content}</h3>;
      return <h4 key={index}>{content}</h4>;
    }
    if (trimmed.startsWith('> ')) return <blockquote key={index}>{renderInlineMarkdown(trimmed.slice(2))}</blockquote>;
    const lines = trimmed.split('\n');
    if (lines.every(line => /^[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>)}</ul>;
    if (lines.every(line => /^\d+\.\s+/.test(line))) return <ol key={index}>{lines.map((line, i) => <li key={i}>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>)}</ol>;
    const image = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
    if (image) return <figure key={index}><img loading="lazy" src={image[2]} alt={image[1]} /><figcaption>{image[1]}</figcaption></figure>;
    return <p key={index}>{lines.map((line, i) => <span key={i}>{i > 0 && <br />}{renderInlineMarkdown(line)}</span>)}</p>;
  })}</div>;
}

function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { api.collections().then(data => setCollections(data.results)).catch(e => setError(e instanceof Error ? e.message : 'Unable to load collections.')).finally(() => setLoading(false)); }, []);
  return <div className="page-wrap section-wrap page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">CURATED PATHS <span className="eyebrow-rule" /></div><h1>Collections<span className="title-period">.</span></h1><p>Thoughtful groupings that make good things easier to find again.</p></div>{loading ? <LoadingRows /> : collections.length ? <div className="collection-grid">{collections.map((collection, i) => <Link key={collection.id} className={`collection-card collection-card-${i % 3}`} to={`/collections/${collection.slug}`}>{collection.cover_image_url ? <img src={collection.cover_image_url} alt="" loading="lazy" /> : <div className="collection-graphic"><span>0{i + 1}</span><Layers3 size={40} strokeWidth={1.2} /></div>}<span className="section-kicker">COLLECTION / {String(i + 1).padStart(2, '0')}</span><h2>{collection.title}</h2><p>{collection.description}</p><span className="collection-link">Open collection <ArrowUpRight size={15} /></span></Link>)}</div> : <EmptyState title="Collections are being arranged." body={error || 'Create a collection in Creator Studio, then add published content to it.'} action={<Link to="/admin" className="button button-outline">Manage collections <ArrowUpRight size={15} /></Link>} />}</div>;
}

function CollectionDetailPage() {
  const { slug = '' } = useParams(); const [collection, setCollection] = useState<Collection | null>(null); const [items, setItems] = useState<ContentItem[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api.collections(), api.content({ page_size: '100' })]).then(([cols, content]) => { const found = cols.results.find(c => c.slug === slug); setCollection(found || null); setItems(found ? content.results.filter(item => item.collection_slugs?.includes(found.slug)) : []); }).catch(() => setCollection(null)).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="page-wrap section-wrap"><LoadingRows /></div>;
  if (!collection) return <div className="page-wrap section-wrap"><EmptyState title="Collection not found." body="This collection may be private or not published." action={<Link to="/collections" className="button button-outline"><ArrowLeft size={15} /> All collections</Link>} /></div>;
  return <div className="page-wrap section-wrap page-enter"><Link className="back-link" to="/collections"><ArrowLeft size={15} /> All collections</Link><div className="page-hero page-hero-small"><div className="eyebrow">CURATED COLLECTION <span className="eyebrow-rule" /></div><h1>{collection.title}<span className="title-period">.</span></h1><p>{collection.description}</p></div>{items.length ? <ContentGrid items={items} compact /> : <EmptyState title="This collection is ready to grow." body="Add items to this collection from Creator Studio. Only published public entries are shown here." />}</div>;
}

function AboutPage() {
  const [profile, setProfile] = useState<CreatorProfile>(fallbackProfile);
  useEffect(() => { api.profile().then(setProfile).catch(() => {}); }, []);
  return <div className="page-wrap section-wrap page-enter"><div className="page-hero"><div className="eyebrow">ABOUT THIS SPACE <span className="eyebrow-rule" /></div><h1>One place.<br /><em>Many curiosities.</em></h1><p>{profile.biography}</p></div><div className="about-layout"><div className="about-letter"><span className="section-kicker">A NOTE FROM THE CREATOR</span><div className="about-monogram">A<span>.</span></div><h2>{profile.display_name}</h2><p>{profile.headline}</p><p className="about-muted">This profile is editable through Creator Studio. Personal details and social links will appear here only when the creator adds them.</p><Link to="/contact" className="button button-primary">Get in touch <ArrowRight size={16} /></Link></div><div className="about-principles"><div><span className="principle-index">01</span><div><h3>Keep what matters.</h3><p>A curated library, not a race to publish. Useful finds and meaningful work belong side by side.</p></div></div><div><span className="principle-index">02</span><div><h3>Make it easy to return.</h3><p>Search, collections, clear categories, and direct links keep the archive useful as it grows.</p></div></div><div><span className="principle-index">03</span><div><h3>Share with intention.</h3><p>Public items are discoverable; drafts and private files stay behind the appropriate permissions.</p></div></div></div></div></div>;
}

function ContactPage() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setState('sending'); setError(''); try { await api.contact({ name, email, message }); setState('done'); setName(''); setEmail(''); setMessage(''); } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Message could not be saved.'); } }
  return <div className="page-wrap section-wrap contact-layout page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">OPEN CHANNEL <span className="eyebrow-rule" /></div><h1>Say hello<span className="title-period">.</span></h1><p>Questions, ideas, or a useful thing to add to the archive are all welcome.</p><div className="contact-note"><Mail size={17} /><p>Messages are stored privately for the creator to review. They are not displayed publicly.</p></div></div><form className="form-card" onSubmit={submit}><span className="section-kicker">SEND A MESSAGE</span>{state === 'done' && <div className="success-message"><Check size={18} /> Your message was saved for the creator.</div>}{state === 'error' && <div className="error-message" role="alert">{error}</div>}<label>Name<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label>Message<textarea required minLength={10} rows={5} value={message} onChange={e => setMessage(e.target.value)} /></label><button className="button button-primary full-width" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'} <ArrowRight size={16} /></button><p className="form-footnote">No tracking pixels. Only the details needed to reply.</p></form></div>;
}

function SuggestPage() {
  const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setState('sending'); setError(''); try { await api.suggest({ title, url, reason }); setState('done'); setTitle(''); setUrl(''); setReason(''); } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Recommendation could not be saved.'); } }
  return <div className="page-wrap section-wrap contact-layout page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">COMMUNITY / RECOMMENDATIONS <span className="eyebrow-rule" /></div><h1>Found something good<span className="title-period">?</span></h1><p>Recommend a website, video, book, project, or resource that deserves a spot in the archive.</p><div className="contact-note"><ShieldCheck size={17} /><p>Recommendations go to a private moderation queue. They are never published automatically.</p></div></div><form className="form-card" onSubmit={submit}><span className="section-kicker">MAKE A RECOMMENDATION</span>{state === 'done' && <div className="success-message"><Check size={18} /> Recommendation submitted for review.</div>}{state === 'error' && <div className="error-message" role="alert">{error}</div>}<label>Title<input required maxLength={240} value={title} onChange={e => setTitle(e.target.value)} placeholder="What should we check out?" /></label><label>URL<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label><label>Why is it worth saving?<textarea rows={5} value={reason} onChange={e => setReason(e.target.value)} placeholder="A short reason is helpful (optional)." /></label><button className="button button-primary full-width" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Submitting…' : 'Submit recommendation'} <ArrowRight size={16} /></button><p className="form-footnote">Submissions are reviewed before appearing publicly.</p></form></div>;
}

function PrivacyPage() { return <div className="page-wrap section-wrap legal-page page-enter"><div className="eyebrow">PLAIN-LANGUAGE NOTICE <span className="eyebrow-rule" /></div><h1>Privacy<span className="title-period">.</span></h1><p>ALIB is a creator-managed content library. The live privacy practices depend on which services the site owner configures.</p><h2>What the site stores</h2><p>When enabled, contact forms and visitor recommendations are stored so the creator can review them. Content that is saved as a draft, marked private, or uploaded to private storage should not be available to anonymous visitors.</p><h2>Cookies and sessions</h2><p>The interface stores a light/dark theme preference in your browser. The admin panel uses server-managed authentication cookies when configured. Do not enter passwords outside the official sign-in page.</p><h2>External websites</h2><p>Links to other websites follow their own privacy policies. ALIB only displays supported metadata or embeds and links back to the original source.</p><h2>Contact</h2><p>Use the <Link to="/contact">contact form</Link> for privacy-related questions. The site owner should update this page to reflect any analytics, newsletter, or storage integrations enabled for production.</p></div>; }

function NotFoundPage() { return <div className="page-wrap section-wrap not-found page-enter"><span className="not-found-code">404</span><h1>That page wandered off.</h1><p>It may have moved, or it may not be public yet.</p><Link className="button button-primary" to="/">Return home <ArrowRight size={16} /></Link></div>; }

function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null); const [checking, setChecking] = useState(true); const [authError, setAuthError] = useState('');
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  async function signOut() { try { await api.logout(); } finally { setUser(null); } }
  if (checking) return <div className="admin-page"><div className="admin-loading"><div className="spinner" /><p>Checking your session…</p></div></div>;
  if (!user) return <AdminLogin onLogin={setUser} error={authError} setError={setAuthError} />;
  return <AdminShell user={user} onSignOut={signOut} />;
}

function AdminLogin({ onLogin, error, setError }: { onLogin: (u: AdminUser) => void; error: string; setError: (s: string) => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { onLogin(await api.login(username, password)); } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed. Check your credentials and try again.'); } finally { setBusy(false); } }
  return <div className="admin-auth-wrap"><div className="admin-auth-art"><Link to="/" className="brand"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link><div><span className="eyebrow">PRIVATE WORKSPACE</span><h1>Make room<br /><em>for the good stuff.</em></h1><p>Your ideas, projects, and digital archive — managed in one place.</p></div><span className="auth-art-stamp">CREATOR STUDIO<br />BUILD / SAVE / PUBLISH</span></div><div className="admin-auth-form"><Link to="/" className="back-link"><ArrowLeft size={15} /> Back to ALIB</Link><div className="admin-auth-form-inner"><span className="section-kicker">WELCOME BACK</span><h2>Sign in to your studio</h2><p>Use the administrator account created with Django.</p>{error && <div className="error-message" role="alert">{error}</div>}<form onSubmit={submit}><label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button button-primary full-width" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button></form><div className="secure-note"><ShieldCheck size={16} /><p>Protected by the Django server. No default password is provided.</p></div></div><span className="auth-copyright">ALIB · PRIVATE BY DESIGN</span></div></div>;
}

function AdminShell({ user, onSignOut }: { user: AdminUser; onSignOut: () => void }) {
  const [tab, setTab] = useState<'overview' | 'content' | 'editor' | 'media' | 'settings' | 'collections' | 'inbox' | 'analytics' | 'moderation' | 'comments'>('overview'); const [stats, setStats] = useState<AdminStats | null>(null); const [items, setItems] = useState<ContentItem[]>([]); const [media, setMedia] = useState<MediaAsset[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [editId, setEditId] = useState<number | undefined>();
  const emptyForm = { title: '', slug: '', summary: '', body: '', content_type: 'article' as ContentType, source_url: '', cover_image_url: '', status: 'draft', visibility: 'public', featured: false, allow_download: false, scheduled_for: '' };
  const [form, setForm] = useState(emptyForm);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alib-editor-draft');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.form && !editId) {
        setForm({ ...emptyForm, ...parsed.form });
        setMessage('Recovered an unsaved local draft. Save it to keep it in the database.');
        setTab('editor');
      }
    } catch { localStorage.removeItem('alib-editor-draft'); }
  }, []);
  useEffect(() => {
    if (tab === 'editor' && !editId) {
      try { localStorage.setItem('alib-editor-draft', JSON.stringify({ form })); } catch { /* Autosave is a convenience, not a requirement for editing. */ }
    }
  }, [form, tab, editId]);
  async function reload() { setBusy(true); try { const [s, c] = await Promise.all([api.adminStats(), api.adminContent({ page_size: '100' })]); setStats(s); setItems(c.results); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load dashboard data.'); } finally { setBusy(false); } }
  useEffect(() => { void reload(); }, []);
  async function loadMedia() { try { const result = await api.media(); setMedia(result.results); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load the media library.'); } }
  function newItem() { setEditId(undefined); setForm(emptyForm); setMessage(''); setTab('editor'); }
  function editItem(item: ContentItem) { setEditId(item.id); setForm({ title: item.title, slug: item.slug, summary: item.summary || '', body: item.body || '', content_type: item.content_type, source_url: item.source_url || '', cover_image_url: item.cover_image_url || '', status: item.status, visibility: item.visibility, featured: item.featured, allow_download: item.allow_download, scheduled_for: item.scheduled_for ? item.scheduled_for.slice(0, 16) : '' }); setMessage(''); setTab('editor'); }
  async function saveItem(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage(''); try { const payload = { ...form, scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null }; await api.saveContent(payload as Partial<ContentItem>, editId); localStorage.removeItem('alib-editor-draft'); setMessage(form.status === 'published' ? 'Content published. Public pages will now show it.' : form.status === 'scheduled' ? 'Scheduled content saved. Ensure the publish_scheduled command is run by a scheduler.' : 'Draft saved successfully.'); await reload(); setTab('content'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save content.'); } finally { setBusy(false); } }
  function insertMarkup(before: string, after = '') {
    const element = bodyRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = form.body.slice(start, end);
    setField('body', form.body.slice(0, start) + before + selected + after + form.body.slice(end));
    window.requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + before.length, start + before.length + selected.length); });
  }
  async function removeItem(item: ContentItem) { if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return; try { await api.deleteContent(item.id); setMessage('Content deleted.'); await reload(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not delete content.'); } }
  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) { setForm(prev => ({ ...prev, [key]: value })); }
  return <div className="admin-page"><aside className="admin-sidebar"><Link to="/" className="brand"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link><div className="studio-caption"><span className="status-dot" /> CREATOR STUDIO</div><div className="admin-workspace-label">WORKSPACE</div><nav className="admin-menu" aria-label="Creator Studio navigation">
      <button className={tab === 'overview' ? 'selected' : ''} onClick={() => setTab('overview')}><Compass size={17} /> Overview</button>
      <button className={tab === 'content' ? 'selected' : ''} onClick={() => setTab('content')}><FileText size={17} /> All content <span className="nav-count">{items.length}</span></button>
      <button className={tab === 'editor' ? 'selected' : ''} onClick={newItem}><Plus size={17} /> New content</button>
      <button className={tab === 'media' ? 'selected' : ''} onClick={() => { setTab('media'); void loadMedia(); }}><FolderOpen size={17} /> Media library</button>
      <Link to="/" className="admin-menu-link"><Globe2 size={17} /> View public site <ArrowUpRight size={14} /></Link>
    </nav><div className="admin-sidebar-bottom"><div className="admin-avatar">{user.username.slice(0, 1).toUpperCase()}</div><div className="admin-user-meta"><strong>{user.username}</strong><span>Administrator</span></div><button className="icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button></div></aside>
    <div className="admin-main"><header className="admin-topbar"><div><span className="section-kicker">ALIB / WORKSPACE</span><span className="admin-breadcrumb">{tab === 'overview' ? 'Overview' : tab === 'content' ? 'All content' : tab === 'editor' ? (editId ? 'Edit content' : 'New content') : 'Media library'}</span></div><div className="admin-topbar-actions"><span className="admin-live-status"><span className="status-dot" /> Connected as {user.username}</span><button className="button button-primary button-small" onClick={newItem}><Plus size={15} /> Create content</button></div></header>
      <div className="admin-content-area">{message && <div className={message.toLowerCase().includes('could not') || message.toLowerCase().includes('unable') ? 'error-message' : 'success-message'} role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15} /></button></div>}
      {tab === 'overview' && <><div className="admin-welcome"><div><span className="section-kicker">YOUR DIGITAL HOME</span><h1>Good to see you, {user.username}.</h1><p>Here’s what’s happening in your archive.</p></div><button className="button button-outline" onClick={() => void reload()} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh data'} <Clock3 size={15} /></button></div><div className="admin-stat-grid"><AdminStat icon={<FileText size={18} />} label="Published" value={stats?.published ?? '—'} hint="Visible to visitors" /><AdminStat icon={<PenLine size={18} />} label="Drafts" value={stats?.drafts ?? '—'} hint="Still in the studio" /><AdminStat icon={<Clock3 size={18} />} label="Scheduled" value={stats?.scheduled ?? '—'} hint="Waiting to publish" /><AdminStat icon={<FolderOpen size={18} />} label="Media assets" value={stats?.assets ?? '—'} hint="Stored asset records" /></div><div className="admin-overview-grid"><section className="admin-panel recent-content-panel"><div className="admin-panel-heading"><div><span className="section-kicker">THE ARCHIVE</span><h2>Recent content</h2></div><button className="text-link" onClick={() => setTab('content')}>View all <ArrowRight size={15} /></button></div>{items.slice(0, 5).length ? <div className="admin-recent-list">{items.slice(0, 5).map(item => <div key={item.id} className="admin-recent-row"><div className="admin-recent-icon"><FileText size={17} /></div><div className="admin-recent-meta"><strong>{item.title}</strong><span>{labelType(item.content_type)} · updated {formatDate(item.updated_at)}</span></div><StatusPill status={item.status} /><button className="icon-button" aria-label={`Edit ${item.title}`} onClick={() => editItem(item)}><ArrowUpRight size={16} /></button></div>)}</div> : <div className="admin-empty"><PenLine size={22} /><h3>Your content starts here.</h3><p>Create a draft or publish a first item. Publicly published items become discoverable automatically.</p><button className="button button-primary" onClick={newItem}><Plus size={15} /> Create first item</button></div>}</section><section className="admin-panel quick-actions-panel"><div className="admin-panel-heading"><div><span className="section-kicker">QUICK ACTIONS</span><h2>Keep things moving</h2></div><Command size={19} /></div><button className="quick-action" onClick={newItem}><span className="quick-action-icon"><Plus size={17} /></span><span><strong>Write something new</strong><small>Create an article, link, project, or resource.</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={() => { setTab('media'); void loadMedia(); }}><span className="quick-action-icon"><Upload size={17} /></span><span><strong>Add a media asset</strong><small>Manage covers and permitted downloads.</small></span><ArrowRight size={16} /></button><Link className="quick-action" to="/" target="_blank"><span className="quick-action-icon"><Globe2 size={17} /></span><span><strong>Preview the public site</strong><small>See the visitor experience.</small></span><ArrowUpRight size={16} /></Link><div className="security-note"><ShieldCheck size={16} /><span>Publishing is controlled by your account permissions. Drafts are not shown to anonymous visitors.</span></div></section></div></>}
      {tab === 'content' && <section className="admin-panel content-management-panel"><div className="admin-panel-heading"><div><span className="section-kicker">CONTENT MANAGER</span><h2>Everything in the archive</h2><p>{items.length} items returned by the API</p></div><button className="button button-primary" onClick={newItem}><Plus size={15} /> New item</button></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Visibility</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="table-title"><span className="table-thumb"><FileText size={16} /></span><span><strong>{item.title}</strong><small>/{item.slug}</small></span></div></td><td>{labelType(item.content_type)}</td><td><StatusPill status={item.status} /></td><td><span className="visibility-label">{item.visibility}</span></td><td>{formatDate(item.updated_at)}</td><td><div className="table-actions"><button className="icon-button" onClick={() => editItem(item)} aria-label={`Edit ${item.title}`}><PenLine size={15} /></button><button className="icon-button danger-icon" onClick={() => void removeItem(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!items.length && <div className="table-empty"><FolderOpen size={22} /><p>No items have been added yet.</p><button className="button button-outline" onClick={newItem}><Plus size={15} /> Create your first item</button></div>}</div></section>}
      {tab === 'editor' && <section className="admin-editor-layout"><form className="admin-panel editor-panel" onSubmit={saveItem}><div className="admin-panel-heading"><div><span className="section-kicker">{editId ? 'EDIT AN ENTRY' : 'NEW ENTRY'}</span><h2>{editId ? 'Shape this content.' : 'What would you like to share?'}</h2><p>Save a draft while you work, or publish to make it discoverable.</p></div><span className="editor-badge"><PenLine size={15} /> Editor</span></div><label>Title<input required value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Give it a clear title" /></label><div className="form-two-col"><label>Content type<select value={form.content_type} onChange={e => setField('content_type', e.target.value as ContentType)}>{(['article', 'note', 'link', 'project', 'video', 'book', 'resource', 'file', 'gallery', 'podcast'] as ContentType[]).map(type => <option key={type} value={type}>{labelType(type)}</option>)}</select></label><label>URL slug<input value={form.slug} onChange={e => setField('slug', e.target.value)} placeholder="Generated from title if empty" /></label></div><label>Short summary<textarea rows={2} value={form.summary} onChange={e => setField('summary', e.target.value)} placeholder="A useful one- or two-sentence introduction" /></label><label>Body / description
    <div className="editor-toolbar" role="toolbar" aria-label="Content formatting">
      <button type="button" onClick={() => insertMarkup('## ')} aria-label="Insert heading">H2</button>
      <button type="button" onClick={() => insertMarkup('**', '**')} aria-label="Bold selected text"><strong>B</strong></button>
      <button type="button" onClick={() => insertMarkup('*', '*')} aria-label="Italic selected text"><em>I</em></button>
      <button type="button" onClick={() => insertMarkup('- ')} aria-label="Bullet list">• List</button>
      <button type="button" onClick={() => insertMarkup('> ')} aria-label="Quote">Quote</button>
      <button type="button" onClick={() => insertMarkup('[', '](https://example.com)')} aria-label="Link">Link</button>
    </div>
    <textarea ref={bodyRef} rows={9} value={form.body} onChange={e => setField('body', e.target.value)} placeholder="Write content in Markdown: ## headings, **bold**, bullet lists, > quotes, and [links](https://…). Blank lines start new paragraphs." />
  </label>
  <div className="editor-live-preview"><span className="section-kicker">LIVE PREVIEW</span><ContentBody body={form.body || 'Your formatted article preview appears here as you write.'} /></div><label>Original source URL<input type="url" value={form.source_url} onChange={e => setField('source_url', e.target.value)} placeholder="https://…" /></label><label>Cover image URL<input type="url" value={form.cover_image_url} onChange={e => setField('cover_image_url', e.target.value)} placeholder="https://… (optional)" /></label>{form.status === 'scheduled' && <label>Publish date and time<input type="datetime-local" required value={form.scheduled_for} onChange={e => setField('scheduled_for', e.target.value)} /></label>}<div className="editor-options"><label className="check-field"><input type="checkbox" checked={form.featured} onChange={e => setField('featured', e.target.checked)} /> Feature on the homepage</label><label className="check-field"><input type="checkbox" checked={form.allow_download} onChange={e => setField('allow_download', e.target.checked)} /> Allow downloads (where supported)</label></div><div className="form-two-col"><label>Publication status<select value={form.status} onChange={e => setField('status', e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled (requires server scheduler)</option><option value="archived">Archived</option></select></label><label>Visibility<select value={form.visibility} onChange={e => setField('visibility', e.target.value)}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label></div><div className="editor-submit-row"><button type="button" className="button button-outline" onClick={() => setTab('content')}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : form.status === 'published' ? 'Publish content' : 'Save content'} <ArrowRight size={15} /></button></div><p className="editor-disclaimer">Autosave keeps an unsubmitted draft in this browser. Scheduled posts publish only when a scheduler runs the server-side publish_scheduled command.</p></form><aside className="editor-sidebar"><div className="admin-panel editor-help-panel"><span className="section-kicker">PUBLISHING GUIDE</span><h3>From idea to public</h3><ol><li><span>01</span><p>Fill in the title and relevant details.</p></li><li><span>02</span><p>Save as a draft to keep editing privately.</p></li><li><span>03</span><p>Choose Public and Published to show it on the site.</p></li><li><span>04</span><p>Preview on the public site after publishing.</p></li></ol></div>{editId && <RevisionHistoryPanel itemId={editId} onRestored={item => { editItem(item); setMessage('Revision restored and saved as a new revision.'); }} />}<div className="admin-panel visibility-help"><LockKeyhole size={18} /><div><strong>Private means private</strong><p>The backend filters draft, private, and unpublished content from anonymous requests.</p></div></div></aside></section>}
      {tab === 'media' && <section className="admin-panel media-panel"><div className="admin-panel-heading"><div><span className="section-kicker">ASSET LIBRARY</span><h2>Media that supports the story</h2><p>Upload cover images or permitted files. Storage needs server-side Supabase credentials.</p></div><label className="button button-primary upload-label"><Upload size={15} /> Upload asset<input type="file" accept="image/*,application/pdf,audio/*,video/*" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); fd.append('title', file.name); try { await api.uploadMedia(fd); setMessage('Asset uploaded and saved.'); await loadMedia(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Upload failed.'); } e.currentTarget.value = ''; }} /></label></div>{media.length ? <div className="media-grid">{media.map(asset => <div className="media-asset-card" key={asset.id}><div className="media-asset-thumb"><FileText size={29} /></div><div className="media-asset-meta"><strong>{asset.title || asset.original_filename}</strong><span>{asset.mime_type} · {formatBytes(asset.file_size)}</span><label className="media-visibility">Visibility<select aria-label={`Visibility for ${asset.title || asset.original_filename}`} value={asset.visibility} onChange={async e => { try { await api.updateMedia(asset.id, { visibility: e.target.value }); setMessage('Media visibility updated.'); await loadMedia(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not update visibility.'); } }}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label><label className="media-download-check"><input type="checkbox" checked={asset.downloadable} onChange={async e => { try { await api.updateMedia(asset.id, { downloadable: e.target.checked }); setMessage('Download permission updated.'); await loadMedia(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not update download permission.'); } }} /> Allow download</label></div><button className="button button-outline button-small" onClick={async () => { try { const signed = await api.signedMediaUrl(asset.id); window.open(signed.url, '_blank', 'noopener,noreferrer'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not preview asset.'); } }}>Preview <ArrowUpRight size={14} /></button></div>)}</div> : <div className="table-empty"><FolderOpen size={22} /><p>No media assets have been uploaded.</p><p className="muted-small">Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET on the backend to enable uploads.</p></div>}</section>}
      </div>
    </div>
  </div>;
}

function AdminStat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number | string; hint: string }) { return <div className="admin-stat-card"><span className="admin-stat-icon">{icon}</span><span className="admin-stat-label">{label}</span><strong>{value}</strong><span className="admin-stat-hint">{hint}</span></div>; }
function StatusPill({ status }: { status: string }) { return <span className={`status-pill status-${status}`}><span />{status}</span>; }

function labelType(type: ContentType | string) { const names: Record<string, string> = { article: 'Article', note: 'Note', link: 'Website', project: 'Project', video: 'Video', book: 'Book', resource: 'Resource', file: 'File', gallery: 'Gallery', podcast: 'Podcast' }; return names[type] || type; }
function formatDate(value: string | null | undefined) { if (!value) return 'Not dated'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Not dated' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d); }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }

export default App;
