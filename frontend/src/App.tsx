import { createContext, Fragment, useContext, useDeferredValue, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Command,
  Compass, ExternalLink, FileText, Filter, FolderOpen, Globe2, Heart, History, Inbox, Layers3, Link2, LockKeyhole, ChevronLeft, ChevronRight,
  LogOut, Mail, Menu, MessageCircle, Moon, PenLine, Plus, Search, Share2, ShieldCheck, Sparkles, Sun, ThumbsUp, Trash2, Upload, Video, X, BarChart3, Settings2, Users, UserRound, ClipboardList, AtSign, ChevronsLeft,
} from 'lucide-react';
import { api, type AdminStats, type AdminUser, type AnalyticsSummary, type AuditEventItem, type ContactInboxItem, type ContentComment, type ContentRevision, type NewsletterSubscriberItem, type SiteSettings, type TeamMember, type TeamRole, type TwoFactorStatus } from './api';
import type { Category, Collection, ContentItem, ContentType, CreatorProfile, HomePayload, MediaAsset, Tag } from './types';

const fallbackProfile: CreatorProfile = {
  display_name: 'Mukamyi Izere Arcange', headline: 'A home for ideas worth keeping.',
  biography: 'A personal space for work in progress, useful links, thoughtful notes, and the things worth returning to.',
  avatar_url: '', location: '', social_links: {},
};

const SiteSettingsContext = createContext<SiteSettings | null>(null);
function useSiteSettings() { return useContext(SiteSettingsContext); }
function siteCopy(settings: SiteSettings | null | undefined, key: string, fallback: string): string {
  const value = settings?.site_copy?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}
function renderCopyright(settings: SiteSettings | null | undefined): string {
  const year = String(new Date().getFullYear());
  const owner = settings?.owner_name?.trim() || 'Mukamyi Izere Arcange';
  const template = settings?.copyright_text?.trim() || '© {year} {owner_name}. All rights reserved.';
  const value = template.replace(/\{year\}/gi, year).replace(/\{owner_name\}/gi, owner);
  return value.replace(/(©\s*)(?:19|20)\d{2}/, \`$1\${year}\`);
}

function safeStorageGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* Storage is optional; keep the app usable when blocked or full. */ }
}
function safeStorageRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Ignore unavailable browser storage. */ }
}

const navItems = [
  { to: '/', label: 'Home', icon: Compass },
  { to: '/discover', label: 'Discover', icon: Search },
  { to: '/posts', label: 'Writing', icon: PenLine },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/projects', label: 'Projects', icon: Layers3 },
  { to: '/resources', label: 'Resources', icon: BookOpen },
];

function App() {
  const [dark, setDark] = useState(() => safeStorageGet('alib-theme') === 'dark');
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    safeStorageSet('alib-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const labels: Record<string, string> = { '/': 'Digital Home', '/discover': 'Discover', '/posts': 'Writing', '/favorites': 'Reading List', '/projects': 'Projects', '/resources': 'Resources', '/collections': 'Collections', '/about': 'About', '/contact': 'Contact', '/suggest': 'Recommend', '/admin': 'Creator Studio' };
    const defaultTitle = `${labels[location.pathname] || 'Explore'} | ALIB`;
    const canonicalUrl = window.location.origin + location.pathname;
    const setMeta = (attribute: 'name' | 'property', key: string, value: string) => {
      let element = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.appendChild(element); }
      element.content = value;
    };
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = canonicalUrl;
    document.title = defaultTitle;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = location.pathname.startsWith('/admin') || location.pathname.startsWith('/reset-password') ? 'noindex,nofollow' : 'index,follow';
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:title', defaultTitle);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', defaultTitle);
    void api.analytics('page_view', location.pathname).catch(() => {});
    api.settings().then(site => {
      setSiteSettings(site);
      const description = site.seo_description || 'A considered home for ideas, work, and curiosity.';
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (icon && site.favicon_url) icon.href = site.favicon_url;
      if (location.pathname === '/' && site.site_title) {
        document.title = site.site_title;
        setMeta('property', 'og:title', site.site_title);
        setMeta('name', 'twitter:title', site.site_title);
      }
    }).catch(() => {});
  }, [location.pathname]);
  useEffect(() => setMobileNav(false), []);
  useEffect(() => {
    const handler = (event: Event) => { const updated = (event as CustomEvent<SiteSettings>).detail; if (updated) setSiteSettings(updated); };
    window.addEventListener('alib-site-settings-updated', handler);
    return () => window.removeEventListener('alib-site-settings-updated', handler);
  }, []);
  // The Creator Studio is a private workspace with its own chrome; the public
  // site header and footer stay on visitor-facing routes only.
  const isAdminRoute = location.pathname.startsWith('/admin');
  return <SiteSettingsContext.Provider value={siteSettings}><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!isAdminRoute && <SiteHeader dark={dark} setDark={setDark} mobileNav={mobileNav} setMobileNav={setMobileNav} />}
    {!isAdminRoute && mobileNav && <button type="button" className="mobile-nav-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation menu" />}
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
    {!isAdminRoute && <SiteFooter />}
  </div></SiteSettingsContext.Provider>;
}

function SiteHeader({ dark, setDark, mobileNav, setMobileNav }: { dark: boolean; setDark: (v: boolean) => void; mobileNav: boolean; setMobileNav: (v: boolean) => void }) {
  const location = useLocation();
  const settings = useSiteSettings();
  const [siteTitle, setSiteTitle] = useState('ALIB');
  const [logoUrl, setLogoUrl] = useState('');
  useEffect(() => setMobileNav(false), [location.pathname, setMobileNav]);
  useEffect(() => { api.settings().then(settings => { setSiteTitle(settings.site_title || 'ALIB'); setLogoUrl(settings.logo_url || ''); }).catch(() => {}); }, []);
  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand" aria-label={`${siteTitle} home`}>{logoUrl ? <img className="brand-logo" src={logoUrl} alt="" /> : <span className="brand-mark">A<span>.</span></span>}<span className="brand-word">ALIB</span></Link>
      <nav className={`primary-nav ${mobileNav ? 'is-open' : ''}`} aria-label="Main navigation">
        {navItems.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{siteCopy(settings, ({ '/': 'nav.home', '/discover': 'nav.discover', '/posts': 'nav.writing', '/favorites': 'nav.favorites', '/projects': 'nav.projects', '/resources': 'nav.resources' } as Record<string, string>)[to] || '', label)}</NavLink>)}
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
  const settings = useSiteSettings();
  return <footer className="site-footer"><div className="footer-inner">
    <Link to="/" className="brand footer-brand"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link>
    <p>{siteCopy(settings, 'footer.description', 'A small home for a growing digital world.')}</p>
    <div className="footer-links"><Link to="/about">{siteCopy(settings, 'nav.about', 'About')}</Link><Link to="/contact">{siteCopy(settings, 'nav.contact', 'Contact')}</Link><Link to="/suggest">{siteCopy(settings, 'nav.recommend', 'Recommend')}</Link><Link to="/privacy">Privacy</Link><a href="/feed.xml">RSS feed <ArrowUpRight size={13} /></a><a href="/atom.xml">Atom feed <ArrowUpRight size={13} /></a><Link to="/admin">Creator Studio <ArrowUpRight size={13} /></Link></div>
    <NewsletterSignup />
    <span className="footer-year">{renderCopyright(settings)}</span>
  </div></footer>;
}

function NewsletterSignup() {
  const settings = useSiteSettings();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setStatus('');
    try { const result = await api.newsletterSubscribe(email); setStatus(result.detail); setEmail(''); }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Subscription could not be submitted.'); }
    finally { setBusy(false); }
  }
  return <form className="newsletter-signup" onSubmit={submit}><label htmlFor="newsletter-email">{siteCopy(settings, 'footer.newsletter_label', 'Occasional notes from the archive')}</label><div><input id="newsletter-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" autoComplete="email" /><button className="button button-primary button-small" disabled={busy}>{busy ? 'Sending…' : 'Subscribe'}</button></div>{status && <p role="status">{status}</p>}</form>;
}

function useHome() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const HOME_RETRIES = 3;
    const load = async (attempt: number): Promise<void> => {
      try {
        const payload = await api.home();
        if (!cancelled) { setData(payload); setError(''); }
      } catch (e) {
        // The hosting service can drop the first request while the instance
        // wakes up; retry briefly before showing the empty archive state.
        if (!cancelled && attempt < HOME_RETRIES) {
          window.setTimeout(() => void load(attempt + 1), 2500 * (attempt + 1));
          return;
        }
        if (!cancelled) setError(e instanceof Error ? e.message : 'The content service is unavailable.');
      }
    };
    void load(0);
    return () => { cancelled = true; };
  }, []);
  return { data, error };
}

function HomePage() {
  const settings = useSiteSettings();
  const { data, error } = useHome();
  const [homeSections, setHomeSections] = useState<string[]>(['featured', 'latest', 'categories', 'collections']);
  useEffect(() => { api.settings().then(settings => setHomeSections(settings.homepage_sections || ['featured', 'latest', 'categories', 'collections'])).catch(() => {}); }, []);
  const profile = data?.profile || fallbackProfile;
  const latest = data?.latest || [];
  const featured = data?.featured || [];
  const sectionMap: Record<string, ReactNode> = {
    featured: <section className="section-wrap section-block"><SectionHeading kicker={siteCopy(settings, 'home.featured.eyebrow', 'THE HIGHLIGHTS / 02')} title={siteCopy(settings, 'home.featured.title', 'Worth a closer look')} linkTo="/discover" linkLabel="Explore everything" />{error && <InlineNotice text="The API is not connected yet. The site is ready for your first published items; check the setup guide to connect the database." />}{featured.length ? <ContentGrid items={featured.slice(0, 3)} /> : <EmptyFeature />}</section>,
    latest: <section className="section-wrap section-block latest-block"><SectionHeading kicker={siteCopy(settings, 'home.latest.eyebrow', 'RECENTLY ADDED / 03')} title={siteCopy(settings, 'home.latest.title', 'Fresh from the archive')} linkTo="/discover" linkLabel="Browse the archive" />{latest.length ? <ContentGrid items={latest.slice(0, 4)} compact /> : <div className="empty-list"><div className="empty-icon"><FolderOpen size={23} /></div><div><h3>The first page is still unwritten.</h3><p>Publish an article, save a useful link, or add a project in Creator Studio. It will appear here automatically.</p></div><Link to="/admin" className="button button-outline">Open Creator Studio <ArrowUpRight size={15} /></Link></div>}</section>,
    categories: Boolean(data?.categories.length) ? <section className="section-wrap section-block"><SectionHeading kicker="BROWSE BY TOPIC / 04" title="A few ways to explore" linkTo="/discover" linkLabel="All topics" /><div className="homepage-category-grid">{data?.categories.map(category => <Link className="homepage-category" key={category.id} to={`/discover?category=${category.id}`}><span>{category.name}</span><ArrowUpRight size={16} /></Link>)}</div></section> : null,
    collections: Boolean(data?.collections.length) ? <section className="section-wrap section-block"><SectionHeading kicker="CURATED BY HAND / 05" title="Explore by collection" linkTo="/collections" linkLabel="All collections" /><div className="collection-grid">{data?.collections.slice(0, 3).map((collection, index) => <Link key={collection.id} className={`collection-card collection-card-${index % 3}`} to={`/collections/${collection.slug}`}>{collection.cover_image_url ? <img src={collection.cover_image_url} alt="" loading="lazy" /> : <div className="collection-graphic"><span>0{index + 1}</span><Layers3 size={40} strokeWidth={1.2} /></div>}<span className="section-kicker">COLLECTION / {String(index + 1).padStart(2, '0')}</span><h2>{collection.title}</h2><p>{collection.description}</p><span className="collection-link">Open collection <ArrowUpRight size={15} /></span></Link>)}</div></section> : null,
  };
  return <>
    <section className="hero section-wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="status-dot" /> {siteCopy(settings, 'home.hero.eyebrow', 'A PERSONAL DIGITAL SPACE')} <span className="eyebrow-rule" /></div>
        <h1>{profile.headline || 'A home for ideas worth keeping.'}</h1>
        <p className="hero-intro">{siteCopy(settings, 'home.hero.intro', 'A personal library of projects, thoughtful notes, useful links, and the digital things that make you curious.')}</p>
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
      <div className="section-kicker">THE IDEA / 001</div><div className="intro-band-copy"><h2>{siteCopy(settings, 'home.intro.heading', 'Not just a portfolio. A place to wander.')}</h2><p>{siteCopy(settings, 'home.intro.body', 'Some things deserve more than a bookmark. ALIB brings together the work being made, the ideas being explored, and the resources worth passing along — all in one thoughtful, searchable place.')}</p><Link className="text-link" to="/about">Get to know the space <ArrowUpRight size={16} /></Link></div>
    </section>

    {homeSections.filter(name => name in sectionMap && sectionMap[name]).map(name => <Fragment key={name}>{sectionMap[name]}</Fragment>)}

    <section className="section-wrap section-block pathways-block">
      <SectionHeading kicker={siteCopy(settings, 'home.pathways.eyebrow', 'FIND YOUR WAY / 04')} title={siteCopy(settings, 'home.pathways.title', 'Different paths in.')} />
      <div className="pathway-grid">
        <Pathway to="/posts" number="01" title={siteCopy(settings, 'home.pathway.read.title', 'Read & reflect')} body={siteCopy(settings, 'home.pathway.read.body', 'Essays, notes, and things learned along the way.')} icon={<BookOpen size={20} />} />
        <Pathway to="/favorites" number="02" title={siteCopy(settings, 'home.pathway.save.title', 'Save a little wonder')} body={siteCopy(settings, 'home.pathway.save.body', 'Websites and digital tools worth remembering.')} icon={<Heart size={20} />} />
        <Pathway to="/projects" number="03" title={siteCopy(settings, 'home.pathway.build.title', "See what's being built")} body={siteCopy(settings, 'home.pathway.build.body', 'Experiments, side projects, and work in progress.')} icon={<Layers3 size={20} />} />
        <Pathway to="/resources" number="04" title={siteCopy(settings, 'home.pathway.learn.title', 'Keep learning')} body={siteCopy(settings, 'home.pathway.learn.body', 'Books, references, documents, and useful media.')} icon={<Compass size={20} />} />
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
  const [items, setItems] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const search = searchParams.get('q') || '';
  const activeType = searchParams.get('type') || 'all';
  const activeCategory = searchParams.get('category') || 'all';
  const activeTag = searchParams.get('tag') || 'all';
  const featuredOnly = searchParams.get('featured') === 'true';
  const fromDate = searchParams.get('from_date') || '';
  const toDate = searchParams.get('to_date') || '';
  const sort = searchParams.get('sort') || 'newest';
  const deferredSearch = useDeferredValue(search);
  useEffect(() => { api.categories().then(result => setCategories(result.results)).catch(() => setCategories([])); api.tags().then(result => setTags(result.results)).catch(() => setTags([])); }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setItems([]); setNextUrl(null);
    const params: Record<string, string> = { page_size: '24', ordering: sort === 'oldest' ? 'published_at' : sort === 'title' ? 'title' : '-published_at' };
    if (deferredSearch.trim()) params.search = deferredSearch.trim();
    if (activeType !== 'all') params.content_type = activeType;
    if (activeCategory !== 'all') params.category = activeCategory;
    if (activeTag !== 'all') params.tag = activeTag;
    if (featuredOnly) params.featured = 'true';
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    api.content(params).then(result => {
      if (cancelled) return;
      setItems(result.results); setTotal(result.count); setNextUrl(result.next);
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to search the archive.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (deferredSearch.trim()) void api.analytics('search', `/discover?q=${encodeURIComponent(deferredSearch.trim())}`).catch(() => {});
    return () => { cancelled = true; };
  }, [deferredSearch, activeType, activeCategory, activeTag, featuredOnly, fromDate, toDate, sort]);
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || (key === 'sort' && value === 'newest')) next.delete(key); else next.set(key, value);
    setSearchParams(next);
  };
  async function loadMore() {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = new URL(nextUrl, window.location.origin);
      const params = Object.fromEntries(url.searchParams.entries());
      const page = await api.content(params);
      setItems(current => [...current, ...page.results]);
      setNextUrl(page.next);
    } catch (e) { setError(e instanceof Error ? e.message : 'More results could not load.'); }
    finally { setLoadingMore(false); }
  }
  const types: Array<ContentType | 'all'> = ['all', 'article', 'note', 'link', 'project', 'video', 'book', 'resource', 'file', 'gallery', 'podcast'];
  return <div className="page-wrap section-wrap page-enter">
    <div className="page-hero"><div className="eyebrow">DISCOVERY / 01 <span className="eyebrow-rule" /></div><h1>Find your<br /><em>next rabbit hole.</em></h1><p>A searchable index of ideas, projects, and resources gathered here.</p></div>
    <div className="discover-toolbar">
      <label className="search-field"><Search size={19} /><span className="sr-only">Search published content</span><input value={search} onChange={e => updateParam('q', e.target.value)} placeholder="Search titles, topics, tags…" /><kbd>⌕</kbd></label>
      <label className="filter-field"><Filter size={17} /><span className="sr-only">Filter by category</span><select value={activeCategory} onChange={e => updateParam('category', e.target.value)}><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={15} /></label>
      <label className="filter-field"><span className="sr-only">Sort search results</span><select value={sort} onChange={e => updateParam('sort', e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select><ChevronDown size={15} /></label>
      <label className="filter-field"><span className="sr-only">Filter by tag</span><select value={activeTag} onChange={e => updateParam('tag', e.target.value)}><option value="all">All tags</option>{tags.map(tag => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}</select><ChevronDown size={15} /></label>
    </div>
    <div className="discover-extra-filters"><label className="check-field"><input type="checkbox" checked={featuredOnly} onChange={e => updateParam('featured', e.target.checked ? 'true' : '')} /> Featured only</label><label>From date<input type="date" value={fromDate} onChange={e => updateParam('from_date', e.target.value)} /></label><label>To date<input type="date" value={toDate} min={fromDate || undefined} onChange={e => updateParam('to_date', e.target.value)} /></label></div>
    <div className="filter-pills" role="group" aria-label="Filter by content type">{types.map(type => <button key={type} className={`filter-pill ${activeType === type ? 'selected' : ''}`} onClick={() => updateParam('type', type)} aria-pressed={activeType === type}>{type === 'all' ? 'Everything' : labelType(type)}</button>)}</div>
    <div className="results-line"><span>{loading ? 'Searching the archive…' : `${total} ${total === 1 ? 'result' : 'results'}`}</span><span>{sort === 'title' ? 'Sorted by title' : sort === 'oldest' ? 'Sorted oldest first' : 'Sorted newest first'}</span></div>
    {error && <InlineNotice text={error} />}
    {loading && items.length === 0 && <LoadingRows />}
    {!loading && items.length > 0 && <ContentGrid items={items} compact />}
    {!loading && !items.length && <div className="empty-state"><div className="empty-icon"><Search size={24} /></div><h2>{error ? 'The archive could not be searched.' : 'Nothing here by that name. Yet.'}</h2><p>{error || 'Try another search or clear the filters. Newly published content will appear here.'}</p><button className="button button-outline" onClick={() => setSearchParams({})}>Clear all filters</button></div>}
    {nextUrl && items.length > 0 && <div className="discover-load-more"><button className="button button-outline" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading more…' : 'Load more results'} <ArrowDown size={15} /></button><span>Showing {items.length} of {total}</span></div>}
  </div>;
}

const BOOKMARKS_KEY = 'alib-bookmarks';

function readBookmarks(): number[] {
  try {
    const saved = JSON.parse(safeStorageGet(BOOKMARKS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is number => Number.isInteger(id)) : [];
  } catch { return []; }
}
function writeBookmarks(ids: number[]) {
  try { safeStorageSet(BOOKMARKS_KEY, JSON.stringify([...new Set(ids)])); window.dispatchEvent(new Event('alib-bookmarks-changed')); } catch { /* Storage may be disabled; the page remains usable. */ }
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
  const [items, setItems] = useState<ContentItem[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const typeFilter = types.join(',');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setItems([]); setNextUrl(null);
    api.content({ page_size: '24', content_type: typeFilter })
      .then(data => {
        if (cancelled) return;
        setItems(data.results); setNextUrl(data.next);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load content.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [typeFilter]);

  async function loadMore() {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true); setError('');
    try {
      const url = new URL(nextUrl, window.location.origin);
      const page = await api.content(Object.fromEntries(url.searchParams.entries()));
      setItems(current => [...current, ...page.results]); setNextUrl(page.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'More content could not load.');
    } finally { setLoadingMore(false); }
  }

  return <div className="page-wrap section-wrap page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">THE ARCHIVE <span className="eyebrow-rule" /></div><h1>{title}<span className="title-period">.</span></h1><p>{description}</p></div>
    {loading ? <LoadingRows /> : error && !items.length ? <EmptyState title={`${title} could not load.`} body={error} /> : items.length ? <ContentGrid items={items} compact /> : <EmptyState title={`No ${title.toLowerCase()} published yet.`} body="When the creator publishes content in Creator Studio, it will show up here automatically." action={<Link className="button button-outline" to="/admin">Open Creator Studio <ArrowUpRight size={15} /></Link>} />}
    {error && items.length > 0 && <InlineNotice text={error} />}
    {nextUrl && items.length > 0 && <div className="discover-load-more"><button className="button button-outline" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading more…' : `Load more ${title.toLowerCase()}`} <ArrowDown size={15} /></button></div>}
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
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description && item.summary) description.content = item.summary;
    const setProperty = (key: string, value: string) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[property="${key}"]`);
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', key); document.head.appendChild(meta); }
      meta.content = value;
    };
    const setName = (key: string, value: string) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${key}"]`);
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', key); document.head.appendChild(meta); }
      meta.content = value;
    };
    setProperty('og:title', item.title);
    setProperty('og:description', item.summary || 'A considered entry from the ALIB archive.');
    setName('twitter:title', item.title);
    setName('twitter:description', item.summary || 'A considered entry from the ALIB archive.');
    if (item.cover_image_url) setProperty('og:image', item.cover_image_url);
    else document.querySelector('meta[property="og:image"]')?.remove();
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = item.status === 'published' && item.visibility === 'public' ? 'index,follow' : 'noindex,nofollow';
    let structured = document.querySelector<HTMLScriptElement>('script[data-alib-structured-data="content"]');
    if (!structured) { structured = document.createElement('script'); structured.type = 'application/ld+json'; structured.dataset.alibStructuredData = 'content'; document.head.appendChild(structured); }
    structured.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': item.content_type === 'article' ? 'Article' : 'CreativeWork',
      headline: item.title,
      description: item.summary || '',
      url: window.location.origin + location.pathname,
      datePublished: item.published_at || item.created_at,
      dateModified: item.updated_at || item.created_at,
      image: item.cover_image_url || undefined,
    });
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
    const lines = trimmed.split('\n');
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (trimmed.startsWith('```') && trimmed.endsWith('```') && lines.length >= 2) {
      const code = lines.slice(1, -1).join('\n');
      const language = lines[0].slice(3).trim();
      return <pre className="content-code-block" key={index}><code data-language={language || 'text'}>{code}</code></pre>;
    }
    if (trimmed === '---' || trimmed === '***') return <hr key={index} />;
    if (heading) {
      const content = renderInlineMarkdown(heading[2]);
      if (heading[1].length === 1) return <h2 key={index}>{content}</h2>;
      if (heading[1].length === 2) return <h3 key={index}>{content}</h3>;
      return <h4 key={index}>{content}</h4>;
    }
    if (trimmed.startsWith('> ')) return <blockquote key={index}>{renderInlineMarkdown(trimmed.slice(2))}</blockquote>;
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
  const { slug = '' } = useParams();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setCollection(null); setItems([]); setNextUrl(null);
    Promise.all([
      api.collectionDetail(slug),
      api.content({ page_size: '24', collection: slug }),
    ]).then(([found, content]) => {
      if (cancelled) return;
      setCollection(found); setItems(content.results); setNextUrl(content.next);
    }).catch(err => {
      if (cancelled) return;
      setCollection(null);
      setError(err instanceof Error ? err.message : 'This collection could not load.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  async function loadMore() {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true); setError('');
    try {
      const url = new URL(nextUrl, window.location.origin);
      const page = await api.content(Object.fromEntries(url.searchParams.entries()));
      setItems(current => [...current, ...page.results]); setNextUrl(page.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'More collection items could not load.');
    } finally { setLoadingMore(false); }
  }

  if (loading) return <div className="page-wrap section-wrap"><LoadingRows /></div>;
  if (!collection) return <div className="page-wrap section-wrap"><EmptyState title="Collection not found." body={error || "This collection may be private or not published."} action={<Link to="/collections" className="button button-outline"><ArrowLeft size={15} /> All collections</Link>} /></div>;
  return <div className="page-wrap section-wrap page-enter"><Link className="back-link" to="/collections"><ArrowLeft size={15} /> All collections</Link><div className="page-hero page-hero-small"><div className="eyebrow">CURATED COLLECTION <span className="eyebrow-rule" /></div><h1>{collection.title}<span className="title-period">.</span></h1><p>{collection.description}</p></div>{items.length ? <ContentGrid items={items} compact /> : <EmptyState title="This collection is ready to grow." body="Add items to this collection from Creator Studio. Only published public entries are shown here." />}{error && items.length > 0 && <InlineNotice text={error} />}{nextUrl && items.length > 0 && <div className="discover-load-more"><button className="button button-outline" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading more…' : 'Load more collection items'} <ArrowDown size={15} /></button></div>}</div>;
}

function AboutPage() {
  const settings = useSiteSettings();
  const [profile, setProfile] = useState<CreatorProfile>(fallbackProfile);
  useEffect(() => { api.profile().then(setProfile).catch(() => {}); }, []);
  return <div className="page-wrap section-wrap page-enter"><div className="page-hero"><div className="eyebrow">{siteCopy(settings, 'about.eyebrow', 'ABOUT THIS SPACE')} <span className="eyebrow-rule" /></div><h1>{siteCopy(settings, 'about.title', 'One place. Many curiosities.')}</h1><p>{profile.biography}</p></div><div className="about-layout"><div className="about-letter"><span className="section-kicker">A NOTE FROM THE CREATOR</span><div className="about-monogram">A<span>.</span></div><h2>{profile.display_name}</h2><p>{profile.headline}</p><p className="about-muted">This profile is editable through Creator Studio. Personal details and social links will appear here only when the creator adds them.</p><Link to="/contact" className="button button-primary">Get in touch <ArrowRight size={16} /></Link></div><div className="about-principles"><div><span className="principle-index">01</span><div><h3>Keep what matters.</h3><p>A curated library, not a race to publish. Useful finds and meaningful work belong side by side.</p></div></div><div><span className="principle-index">02</span><div><h3>Make it easy to return.</h3><p>Search, collections, clear categories, and direct links keep the archive useful as it grows.</p></div></div><div><span className="principle-index">03</span><div><h3>Share with intention.</h3><p>Public items are discoverable; drafts and private files stay behind the appropriate permissions.</p></div></div></div></div></div>;
}

function ContactPage() {
  const settings = useSiteSettings();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setState('sending'); setError(''); try { await api.contact({ name, email, message }); setState('done'); setName(''); setEmail(''); setMessage(''); } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Message could not be saved.'); } }
  return <div className="page-wrap section-wrap contact-layout page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">{siteCopy(settings, 'contact.eyebrow', 'OPEN CHANNEL')} <span className="eyebrow-rule" /></div><h1>{siteCopy(settings, 'contact.title', 'Say hello.')}</h1><p>{siteCopy(settings, 'contact.intro', 'Questions, ideas, or a useful thing to add to the archive are all welcome.')}</p><div className="contact-note"><Mail size={17} /><p>Messages are stored privately for the creator to review. They are not displayed publicly.</p></div></div><form className="form-card" onSubmit={submit}><span className="section-kicker">SEND A MESSAGE</span>{state === 'done' && <div className="success-message"><Check size={18} /> Your message was saved for the creator.</div>}{state === 'error' && <div className="error-message" role="alert">{error}</div>}<label>Name<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label>Message<textarea required minLength={10} rows={5} value={message} onChange={e => setMessage(e.target.value)} /></label><button className="button button-primary full-width" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'} <ArrowRight size={16} /></button><p className="form-footnote">No tracking pixels. Only the details needed to reply.</p></form></div>;
}

function SuggestPage() {
  const settings = useSiteSettings();
  const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setState('sending'); setError(''); try { await api.suggest({ title, url, reason }); setState('done'); setTitle(''); setUrl(''); setReason(''); } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Recommendation could not be saved.'); } }
  return <div className="page-wrap section-wrap contact-layout page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">{siteCopy(settings, 'suggest.eyebrow', 'COMMUNITY / RECOMMENDATIONS')} <span className="eyebrow-rule" /></div><h1>{siteCopy(settings, 'suggest.title', 'Found something good?')}</h1><p>{siteCopy(settings, 'suggest.intro', 'Recommend a website, video, book, project, or resource that deserves a spot in the archive.')}</p><div className="contact-note"><ShieldCheck size={17} /><p>Recommendations go to a private moderation queue. They are never published automatically.</p></div></div><form className="form-card" onSubmit={submit}><span className="section-kicker">MAKE A RECOMMENDATION</span>{state === 'done' && <div className="success-message"><Check size={18} /> Recommendation submitted for review.</div>}{state === 'error' && <div className="error-message" role="alert">{error}</div>}<label>Title<input required maxLength={240} value={title} onChange={e => setTitle(e.target.value)} placeholder="What should we check out?" /></label><label>URL<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label><label>Why is it worth saving?<textarea rows={5} value={reason} onChange={e => setReason(e.target.value)} placeholder="A short reason is helpful (optional)." /></label><button className="button button-primary full-width" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Submitting…' : 'Submit recommendation'} <ArrowRight size={16} /></button><p className="form-footnote">Submissions are reviewed before appearing publicly.</p></form></div>;
}

function PrivacyPage() { const settings = useSiteSettings(); return <div className="page-wrap section-wrap legal-page page-enter"><div className="eyebrow">{siteCopy(settings, 'privacy.eyebrow', 'PLAIN-LANGUAGE NOTICE')} <span className="eyebrow-rule" /></div><h1>{siteCopy(settings, 'privacy.title', 'Privacy.')}</h1><p>ALIB is a creator-managed content library. The live privacy practices depend on which services the site owner configures.</p><h2>What the site stores</h2><p>When enabled, contact forms and visitor recommendations are stored so the creator can review them. Content that is saved as a draft, marked private, or uploaded to private storage should not be available to anonymous visitors.</p><h2>Cookies and sessions</h2><p>The interface stores a light/dark theme preference in your browser. The admin panel uses server-managed authentication cookies when configured. Do not enter passwords outside the official sign-in page.</p><h2>External websites</h2><p>Links to other websites follow their own privacy policies. ALIB only displays supported metadata or embeds and links back to the original source.</p><h2>Contact</h2><p>Use the <Link to="/contact">contact form</Link> for privacy-related questions. The site owner should update this page to reflect any analytics, newsletter, or storage integrations enabled for production.</p></div>; }

function NotFoundPage() { return <div className="page-wrap section-wrap not-found page-enter"><span className="not-found-code">404</span><h1>That page wandered off.</h1><p>It may have moved, or it may not be public yet.</p><Link className="button button-primary" to="/">Return home <ArrowRight size={16} /></Link></div>; }

function ResetPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get('uid') || '';
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function requestReset(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setState('');
    try { const result = await api.requestPasswordReset(email); setState(result.detail); }
    catch (e) { setError(e instanceof Error ? e.message : 'The reset email could not be sent.'); }
    finally { setBusy(false); }
  }
  async function confirmReset(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setState('');
    if (password !== confirmation) { setBusy(false); setError('Passwords do not match.'); return; }
    try { const result = await api.confirmPasswordReset(uid, token, password); setState(result.detail); setPassword(''); setConfirmation(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Password reset failed.'); }
    finally { setBusy(false); }
  }
  return <div className="page-wrap section-wrap reset-page page-enter"><div className="page-hero page-hero-small"><div className="eyebrow">ACCOUNT RECOVERY <span className="eyebrow-rule" /></div><h1>{uid && token ? 'Choose a new password.' : 'Back into your studio.'}</h1><p>{uid && token ? 'Choose a unique password with at least 12 characters.' : 'Enter the email address for your Creator Studio staff account. If email delivery is configured, a one-use link will be sent.'}</p></div><form className="form-card reset-form" onSubmit={uid && token ? confirmReset : requestReset}>{error && <div className="error-message" role="alert">{error}</div>}{state && <div className="success-message" role="status">{state}</div>}{uid && token ? <><label>New password<input type="password" minLength={12} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><label>Confirm new password<input type="password" minLength={12} autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button className="button button-primary full-width" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></> : <><label>Staff account email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className="button button-primary full-width" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button></>}<Link className="back-link" to="/admin"><ArrowLeft size={15} /> Back to sign in</Link></form></div>;
}

function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null); const [checking, setChecking] = useState(true); const [authError, setAuthError] = useState('');
  useEffect(() => { api.session().then(result => setUser(result.authenticated && result.user ? result.user : null)).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  async function signOut() { try { await api.logout(); } finally { setUser(null); } }
  if (checking) return <div className="admin-page"><div className="admin-loading"><div className="spinner" /><p>Checking your session…</p></div></div>;
  if (!user) return <AdminLogin onLogin={setUser} error={authError} setError={setAuthError} />;
  return <AdminShell user={user} onSignOut={signOut} />;
}

function AdminLogin({ onLogin, error, setError }: { onLogin: (u: AdminUser) => void; error: string; setError: (s: string) => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [challenge, setChallenge] = useState(''); const [authenticatorCode, setAuthenticatorCode] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { if (challenge) { onLogin(await api.verifyTwoFactorLogin(challenge, authenticatorCode)); return; } const result = await api.login(username, password); if (result.requires_two_factor && result.challenge) { setChallenge(result.challenge); setPassword(''); setError(''); } else if (result.user) { onLogin(result.user); } else { throw new Error(result.detail || 'Sign-in could not be completed.'); } } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed. Check your credentials and try again.'); } finally { setBusy(false); } }
  return <div className="admin-auth-wrap"><div className="admin-auth-art"><Link to="/" className="brand"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link><div><span className="eyebrow">PRIVATE WORKSPACE</span><h1>Make room<br /><em>for the good stuff.</em></h1><p>Your ideas, projects, and digital archive — managed in one place.</p></div><span className="auth-art-stamp">CREATOR STUDIO<br />BUILD / SAVE / PUBLISH</span></div><div className="admin-auth-form"><Link to="/" className="back-link"><ArrowLeft size={15} /> Back to ALIB</Link><div className="admin-auth-form-inner"><span className="section-kicker">WELCOME BACK</span><h2>Sign in to your studio</h2><p>Use the administrator account created with Django.</p>{error && <div className="error-message" role="alert">{error}</div>}<form onSubmit={submit}>{challenge ? <><p>Enter the six-digit code from your authenticator app. This login challenge expires in five minutes and a code cannot be reused.</p><label>Authenticator code<input inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} value={authenticatorCode} onChange={e => setAuthenticatorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /></label><button className="button button-primary full-width" disabled={busy || authenticatorCode.length !== 6}>{busy ? 'Verifying…' : 'Verify and sign in'} <ArrowRight size={16} /></button><button type="button" className="button button-outline full-width" disabled={busy} onClick={() => { setChallenge(''); setAuthenticatorCode(''); setError(''); }}>Back to password</button></> : <><label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button button-primary full-width" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button></>}</form>{!challenge && <p className="forgot-password"><Link to="/reset-password">Forgot your password?</Link></p>}<div className="secure-note"><ShieldCheck size={16} /><p>Protected by the Django server. Reset email delivery requires a configured email provider.</p></div></div><span className="auth-copyright">ALIB · PRIVATE BY DESIGN</span></div></div>;
}

function MediaThumbnail({ asset }: { asset: MediaAsset }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!asset.mime_type.startsWith('image/')) return;
    let cancelled = false;
    api.signedMediaUrl(asset.id).then(result => { if (!cancelled) setSrc(result.url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [asset.id, asset.mime_type]);
  if (asset.mime_type.startsWith('image/') && src) return <img loading="lazy" src={src} alt={asset.alt_text || asset.title || asset.original_filename} />;
  if (asset.mime_type.startsWith('video/')) return <Video size={29} />;
  if (asset.mime_type.startsWith('audio/')) return <MessageCircle size={29} />;
  return <FileText size={29} />;
}

function AdminShell({ user, onSignOut }: { user: AdminUser; onSignOut: () => void }) {
  const [tab, setTab] = useState<'overview' | 'content' | 'editor' | 'media' | 'settings' | 'profile' | 'collections' | 'inbox' | 'analytics' | 'moderation' | 'comments' | 'team' | 'audit' | 'newsletter' | 'security'>('overview');
  type SidebarMode = 'full' | 'small' | 'hidden';
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = safeStorageGet('alib-studio-sidebar-mode');
    if (saved === 'full' || saved === 'small' || saved === 'hidden') return saved;
    return safeStorageGet('alib-studio-sidebar-collapsed') === 'true' ? 'small' : 'full';
  });
  const [stats, setStats] = useState<AdminStats | null>(null); const [items, setItems] = useState<ContentItem[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [media, setMedia] = useState<MediaAsset[]>([]); const [mediaDrafts, setMediaDrafts] = useState<Record<number, { title: string; description: string; alt_text: string }>>({}); const [uploadProgress, setUploadProgress] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [editId, setEditId] = useState<number | undefined>();
  const emptyForm = { title: '', slug: '', summary: '', body: '', content_type: 'article' as ContentType, source_url: '', cover_image_url: '', status: 'draft', visibility: 'public', featured: false, allow_download: false, scheduled_for: '', category_id: '', tag_ids: [] as number[] };
  const [form, setForm] = useState(emptyForm);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const role = user.role || 'editor';
  const canManage = role === 'administrator' || role === 'editor';
  const canModerate = role === 'administrator' || role === 'moderator';
  const isAdmin = role === 'administrator';
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [collectionCreateRequest, setCollectionCreateRequest] = useState(0);
  useEffect(() => {
    try { safeStorageSet('alib-studio-sidebar-mode', sidebarMode); } catch { /* The layout still works when storage is unavailable. */ }
  }, [sidebarMode]);
  useEffect(() => {
    try {
      const saved = safeStorageGet('alib-editor-draft');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.form && !editId) {
        setForm({ ...emptyForm, ...parsed.form });
        setMessage('Recovered an unsaved local draft. Save it to keep it in the database.');
        setTab('editor');
      }
    } catch { safeStorageRemove('alib-editor-draft'); }
  }, []);
  useEffect(() => {
    if (tab === 'editor' && hasUnsavedEdits) {
      const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
      window.addEventListener('beforeunload', warn);
      return () => window.removeEventListener('beforeunload', warn);
    }
  }, [tab, hasUnsavedEdits]);
  useEffect(() => {
    if (tab === 'editor' && hasUnsavedEdits) {
      const draftKey = editId ? `alib-editor-draft-${editId}` : 'alib-editor-draft';
      try { safeStorageSet(draftKey, JSON.stringify({ editId: editId ?? null, form, savedAt: new Date().toISOString() })); } catch { /* Autosave is a convenience, not a requirement for editing. */ }
    }
  }, [form, tab, editId, hasUnsavedEdits]);
  async function reload() { setBusy(true); try { const [s, c] = await Promise.all([api.adminStats(), api.adminContent({ page_size: '100' })]); setStats(s); setItems(c.results); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load dashboard data.'); } finally { setBusy(false); } }
  useEffect(() => { void reload(); api.categories().then(r => setCategories(r.results)).catch(() => setCategories([])); api.tags().then(r => setTags(r.results)).catch(() => setTags([])); }, []);
  async function loadMedia() { try { const result = await api.media(); setMedia(result.results); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load the media library.'); } }
  async function uploadMediaFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', file.name);
    setUploadProgress(0);
    try {
      await api.uploadMedia(fd, progress => setUploadProgress(progress));
      setUploadProgress(100);
      setMessage('Asset uploaded and saved.');
      await loadMedia();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploadProgress(null);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  }
  function refreshActivePanel() {
    window.dispatchEvent(new CustomEvent('alib-admin-header-refresh', { detail: tab }));
  }
  function mediaDraft(asset: MediaAsset) { return mediaDrafts[asset.id] ?? { title: asset.title, description: asset.description ?? '', alt_text: asset.alt_text ?? '' }; }
  function editMediaDraft(asset: MediaAsset, patch: Partial<{ title: string; description: string; alt_text: string }>) { setMediaDrafts(prev => ({ ...prev, [asset.id]: { ...mediaDraft(asset), ...patch } })); }
  async function saveMediaField(asset: MediaAsset, field: 'title' | 'description' | 'alt_text', label: string) { try { await api.updateMedia(asset.id, { [field]: mediaDraft(asset)[field] }); setMessage(`Media ${label} saved.`); } catch (e) { setMessage(e instanceof Error ? e.message : `Media ${label} could not be saved.`); } }
  async function removeMedia(asset: MediaAsset) { if (!window.confirm(`Delete “${asset.title || asset.original_filename}”? The stored file is removed with it and this cannot be undone.`)) return; try { await api.deleteMedia(asset.id); setMessage('Media asset deleted.'); await loadMedia(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Media asset could not be deleted.'); } }
  function newItem() {
    setEditId(undefined);
    let nextForm = emptyForm;
    try {
      const saved = safeStorageGet('alib-editor-draft');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.form) nextForm = { ...emptyForm, ...parsed.form };
    } catch { safeStorageRemove('alib-editor-draft'); }
    setForm(nextForm);
    setHasUnsavedEdits(false);
    setMessage('');
    setTab('editor');
  }
  function editItem(item: ContentItem) { let nextForm = { title: item.title, slug: item.slug, summary: item.summary || '', body: item.body || '', content_type: item.content_type, source_url: item.source_url || '', cover_image_url: item.cover_image_url || '', status: item.status, visibility: item.visibility, featured: item.featured, allow_download: item.allow_download, scheduled_for: item.scheduled_for ? item.scheduled_for.slice(0, 16) : '', category_id: item.category?.id ? String(item.category.id) : '', tag_ids: item.tags.map(tag => tag.id) }; let hasDraft = false; try { const saved = safeStorageGet(`alib-editor-draft-${item.id}`); const parsed = saved ? JSON.parse(saved) : null; if (parsed?.form && parsed.editId === item.id) { nextForm = { ...nextForm, ...parsed.form }; hasDraft = true; } } catch { safeStorageRemove(`alib-editor-draft-${item.id}`); } setEditId(item.id); setHasUnsavedEdits(hasDraft); setForm(nextForm); setMessage(hasDraft ? 'Recovered this item’s unsaved browser draft.' : ''); setTab('editor'); }
  async function saveItem(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage(''); try { const payload = { ...form, scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null, category_id: form.category_id ? Number(form.category_id) : null, tag_ids: form.tag_ids }; await api.saveContent(payload as Partial<ContentItem>, editId); safeStorageRemove('alib-editor-draft'); if (editId) safeStorageRemove(`alib-editor-draft-${editId}`); setHasUnsavedEdits(false); setMessage(form.status === 'published' ? 'Content published. Public pages will now show it.' : form.status === 'scheduled' ? 'Scheduled content saved. Ensure the publish_scheduled command is run by a scheduler.' : 'Draft saved successfully.'); await reload(); setTab('content'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save content.'); } finally { setBusy(false); } }
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
  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) { setHasUnsavedEdits(true); setForm(prev => ({ ...prev, [key]: value })); }
  return <div className={`admin-page admin-layout sidebar-${sidebarMode}`}><aside className={`admin-sidebar${sidebarMode === 'small' ? ' is-collapsed' : ''}${sidebarMode === 'hidden' ? ' is-hidden' : ''}`}><div className="admin-sidebar-header"><Link to="/" className="brand" title="ALIB home"><span className="brand-mark">A<span>.</span></span><span className="brand-word">ALIB</span></Link><button type="button" className="icon-button sidebar-toggle" onClick={() => setSidebarMode(mode => mode === 'full' ? 'small' : mode === 'small' ? 'hidden' : 'full')} aria-label={sidebarMode === 'full' ? 'Collapse sidebar' : 'Hide sidebar'} title={sidebarMode === 'full' ? 'Collapse sidebar' : 'Hide sidebar'}>{sidebarMode === 'full' ? <ChevronLeft size={17} /> : <ChevronsLeft size={17} />}</button></div><div className="studio-caption"><span className="status-dot" /> CREATOR STUDIO</div><div className="admin-workspace-label">WORKSPACE</div><nav className="admin-menu" aria-label="Creator Studio navigation">
      <button title="Overview" className={tab === 'overview' ? 'selected' : ''} onClick={() => setTab('overview')}><Compass size={17} /> Overview</button>
      <button title="Account security" className={tab === 'security' ? 'selected' : ''} onClick={() => setTab('security')}><ShieldCheck size={17} /> Account security</button>
      {canManage && <button title="All content" className={tab === 'content' ? 'selected' : ''} onClick={() => setTab('content')}><FileText size={17} /> All content <span className="nav-count">{items.length}</span></button>}
      {canManage && <button title="New content" className={tab === 'editor' ? 'selected' : ''} onClick={newItem}><Plus size={17} /> New content</button>}
      {canManage && <button title="Media library" className={tab === 'media' ? 'selected' : ''} onClick={() => { setTab('media'); void loadMedia(); }}><FolderOpen size={17} /> Media library</button>}
      {canManage && <button title="Collections" className={tab === 'collections' ? 'selected' : ''} onClick={() => setTab('collections')}><Layers3 size={17} /> Collections</button>}
      {canManage && <button title="Creator profile" className={tab === 'profile' ? 'selected' : ''} onClick={() => setTab('profile')}><UserRound size={17} /> Creator profile</button>}
      {isAdmin && <button title="Site settings" className={tab === 'settings' ? 'selected' : ''} onClick={() => setTab('settings')}><Settings2 size={17} /> Site settings</button>}
      {canModerate && <button title="Contact inbox" className={tab === 'inbox' ? 'selected' : ''} onClick={() => setTab('inbox')}><Inbox size={17} /> Contact inbox</button>}
      <button title="Analytics" className={tab === 'analytics' ? 'selected' : ''} onClick={() => setTab('analytics')}><BarChart3 size={17} /> Analytics</button>
      {canModerate && <button title="Suggestions" className={tab === 'moderation' ? 'selected' : ''} onClick={() => setTab('moderation')}><ShieldCheck size={17} /> Suggestions</button>}
      {canModerate && <button title="Comments" className={tab === 'comments' ? 'selected' : ''} onClick={() => setTab('comments')}><MessageCircle size={17} /> Comments</button>}
      {isAdmin && <button title="Team access" className={tab === 'team' ? 'selected' : ''} onClick={() => setTab('team')}><Users size={17} /> Team access</button>}
      {isAdmin && <button title="Audit history" className={tab === 'audit' ? 'selected' : ''} onClick={() => setTab('audit')}><ClipboardList size={17} /> Audit history</button>}
      {isAdmin && <button title="Newsletter" className={tab === 'newsletter' ? 'selected' : ''} onClick={() => setTab('newsletter')}><AtSign size={17} /> Newsletter</button>}
      <Link to="/" title="View public site" className="admin-menu-link"><Globe2 size={17} /> View public site <ArrowUpRight size={14} /></Link>
    </nav><div className="admin-sidebar-bottom"><div className="admin-avatar">{user.username.slice(0, 1).toUpperCase()}</div><div className="admin-user-meta"><strong>{user.username}</strong><span>{({ administrator: 'Administrator', editor: 'Editor', moderator: 'Moderator', support: 'Support' } as Record<TeamRole, string>)[role]}</span></div><button className="icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button></div></aside>
    <div className="admin-main"><header className="admin-topbar"><div>{sidebarMode === 'hidden' && <button type="button" className="icon-button sidebar-restore" onClick={() => setSidebarMode('full')} aria-label="Show sidebar" title="Show sidebar"><ChevronRight size={17} /></button>}<span className="section-kicker">ALIB / WORKSPACE</span><span className="admin-breadcrumb">{({ overview: 'Overview', security: 'Account security', content: 'All content', editor: editId ? 'Edit content' : 'New content', media: 'Media library', settings: 'Site settings', profile: 'Creator profile', collections: 'Collections', inbox: 'Contact inbox', analytics: 'Analytics', moderation: 'Suggestions', comments: 'Comments', team: 'Team access', audit: 'Audit history', newsletter: 'Newsletter' } as Record<string, string>)[tab]}</span></div><div className="admin-topbar-actions"><input ref={mediaInputRef} className="admin-hidden-file-input" id="admin-media-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/mpeg,audio/mp4,video/mp4,video/webm" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void uploadMediaFile(file); }} /><span className="admin-live-status"><span className="status-dot" /> Connected as {user.username}</span>{(tab === 'overview' || tab === 'content') && canManage && <button className="button button-primary button-small" onClick={newItem}><Plus size={15} /> Create content</button>}
  {tab === 'media' && canManage && <button className="button button-primary button-small" onClick={() => mediaInputRef.current?.click()}><Upload size={15} /> Upload asset</button>}
  {tab === 'collections' && canManage && <button className="button button-primary button-small" onClick={() => setCollectionCreateRequest(value => value + 1)}><Plus size={15} /> New collection</button>}
  {tab === 'profile' && canManage && <button className="button button-primary button-small" type="submit" form="creator-profile-form"><Check size={15} /> Save profile</button>}
  {tab === 'settings' && isAdmin && <button className="button button-primary button-small" type="submit" form="site-settings-form"><Check size={15} /> Save site settings</button>}
  {tab === 'editor' && canManage && <button className="button button-primary button-small" type="submit" form="admin-content-editor-form"><Check size={15} /> Save content</button>}
  {tab === 'team' && isAdmin && <button className="button button-primary button-small" type="submit" form="team-invite-form"><Plus size={15} /> Invite member</button>}
  {tab === 'newsletter' && isAdmin && <a className="button button-primary button-small" href="/api/v1/admin/newsletter/?export=csv"><ArrowDown size={15} /> Export CSV</a>}
  {['inbox', 'analytics', 'moderation', 'comments', 'audit'].includes(tab) && <button className="button button-outline button-small" onClick={refreshActivePanel}><Clock3 size={15} /> Refresh</button>}</div></header>
      <div className="admin-content-area">{message && <div className={message.toLowerCase().includes('could not') || message.toLowerCase().includes('unable') ? 'error-message' : 'success-message'} role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15} /></button></div>}
      {tab === 'overview' && <><div className="admin-welcome"><div><span className="section-kicker">YOUR DIGITAL HOME</span><h1>Good to see you, {user.username}.</h1><p>Here’s what’s happening in your archive.</p></div><button className="button button-outline" onClick={() => void reload()} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh data'} <Clock3 size={15} /></button></div><div className="admin-stat-grid"><AdminStat icon={<FileText size={18} />} label="Published" value={stats?.published ?? '—'} hint="Visible to visitors" /><AdminStat icon={<PenLine size={18} />} label="Drafts" value={stats?.drafts ?? '—'} hint="Still in the studio" /><AdminStat icon={<Clock3 size={18} />} label="Scheduled" value={stats?.scheduled ?? '—'} hint="Waiting to publish" /><AdminStat icon={<FolderOpen size={18} />} label="Media assets" value={stats?.assets ?? '—'} hint="Stored asset records" /></div><div className="admin-overview-grid"><section className="admin-panel recent-content-panel"><div className="admin-panel-heading"><div><span className="section-kicker">THE ARCHIVE</span><h2>Recent content</h2></div><button className="text-link" onClick={() => setTab('content')}>View all <ArrowRight size={15} /></button></div>{items.slice(0, 5).length ? <div className="admin-recent-list">{items.slice(0, 5).map(item => <div key={item.id} className="admin-recent-row"><div className="admin-recent-icon"><FileText size={17} /></div><div className="admin-recent-meta"><strong>{item.title}</strong><span>{labelType(item.content_type)} · updated {formatDate(item.updated_at)}</span></div><StatusPill status={item.status} /><button className="icon-button" aria-label={`Edit ${item.title}`} onClick={() => editItem(item)}><ArrowUpRight size={16} /></button></div>)}</div> : <div className="admin-empty"><PenLine size={22} /><h3>Your content starts here.</h3><p>Create a draft or publish a first item. Publicly published items become discoverable automatically.</p><button className="button button-primary" onClick={newItem}><Plus size={15} /> Create first item</button></div>}</section><section className="admin-panel quick-actions-panel"><div className="admin-panel-heading"><div><span className="section-kicker">QUICK ACTIONS</span><h2>Keep things moving</h2></div><Command size={19} /></div><button className="quick-action" onClick={newItem}><span className="quick-action-icon"><Plus size={17} /></span><span><strong>Write something new</strong><small>Create an article, link, project, or resource.</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={() => { setTab('media'); void loadMedia(); }}><span className="quick-action-icon"><Upload size={17} /></span><span><strong>Add a media asset</strong><small>Manage covers and permitted downloads.</small></span><ArrowRight size={16} /></button><Link className="quick-action" to="/" target="_blank"><span className="quick-action-icon"><Globe2 size={17} /></span><span><strong>Preview the public site</strong><small>See the visitor experience.</small></span><ArrowUpRight size={16} /></Link><div className="security-note"><ShieldCheck size={16} /><span>Publishing is controlled by your account permissions. Drafts are not shown to anonymous visitors.</span></div></section></div></>}
      {tab === 'content' && <section className="admin-panel content-management-panel"><div className="admin-panel-heading"><div><span className="section-kicker">CONTENT MANAGER</span><h2>Everything in the archive</h2><p>{items.length} items returned by the API</p></div><button className="button button-primary" onClick={newItem}><Plus size={15} /> New item</button></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Visibility</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="table-title"><span className="table-thumb"><FileText size={16} /></span><span><strong>{item.title}</strong><small>/{item.slug}</small></span></div></td><td>{labelType(item.content_type)}</td><td><StatusPill status={item.status} /></td><td><span className="visibility-label">{item.visibility}</span></td><td>{formatDate(item.updated_at)}</td><td><div className="table-actions"><button className="icon-button" onClick={() => editItem(item)} aria-label={`Edit ${item.title}`}><PenLine size={15} /></button><button className="icon-button danger-icon" onClick={() => void removeItem(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!items.length && <div className="table-empty"><FolderOpen size={22} /><p>No items have been added yet.</p><button className="button button-outline" onClick={newItem}><Plus size={15} /> Create your first item</button></div>}</div></section>}
      {tab === 'editor' && <section className="admin-editor-layout"><form id="admin-content-editor-form" className="admin-panel editor-panel" onSubmit={saveItem}><div className="admin-panel-heading"><div><span className="section-kicker">{editId ? 'EDIT AN ENTRY' : 'NEW ENTRY'}</span><h2>{editId ? 'Shape this content.' : 'What would you like to share?'}</h2><p>Save a draft while you work, or publish to make it discoverable.</p></div><span className="editor-badge"><PenLine size={15} /> Editor</span></div><label>Title<input required value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Give it a clear title" /></label><div className="form-two-col"><label>Content type<select value={form.content_type} onChange={e => setField('content_type', e.target.value as ContentType)}>{(['article', 'note', 'link', 'project', 'video', 'book', 'resource', 'file', 'gallery', 'podcast'] as ContentType[]).map(type => <option key={type} value={type}>{labelType(type)}</option>)}</select></label><label>URL slug<input value={form.slug} onChange={e => setField('slug', e.target.value)} placeholder="Generated from title if empty" /></label></div><label>Short summary<textarea rows={2} value={form.summary} onChange={e => setField('summary', e.target.value)} placeholder="A useful one- or two-sentence introduction" /></label><div className="form-two-col"><label>Category<select value={form.category_id} onChange={e => setField('category_id', e.target.value)}><option value="">Uncategorized</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Tags<select multiple value={form.tag_ids.map(String)} onChange={e => setField('tag_ids', Array.from(e.target.selectedOptions, option => Number(option.value)))} aria-label="Select content tags">{tags.map(tag => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select><small>Use Ctrl (Windows) or Command (Mac) to select multiple tags.</small></label></div><label>Body / description
    <div className="editor-toolbar" role="toolbar" aria-label="Content formatting">
      <button type="button" onClick={() => insertMarkup('## ')} aria-label="Insert heading">H2</button>
      <button type="button" onClick={() => insertMarkup('**', '**')} aria-label="Bold selected text"><strong>B</strong></button>
      <button type="button" onClick={() => insertMarkup('*', '*')} aria-label="Italic selected text"><em>I</em></button>
      <button type="button" onClick={() => insertMarkup('- ')} aria-label="Bullet list">• List</button>
      <button type="button" onClick={() => insertMarkup('> ')} aria-label="Quote">Quote</button>
      <button type="button" onClick={() => insertMarkup('[', '](https://example.com)')} aria-label="Link">Link</button><button type="button" onClick={() => insertMarkup('```text\n', '\n```')} aria-label="Code block">Code</button><button type="button" onClick={() => insertMarkup('![Alt text](', ')')} aria-label="Image with alt text">Image</button><button type="button" onClick={() => insertMarkup('\n---\n')} aria-label="Horizontal divider">Divider</button>
    </div>
    <textarea ref={bodyRef} rows={9} value={form.body} onChange={e => setField('body', e.target.value)} placeholder="Write content in Markdown: ## headings, **bold**, bullet lists, > quotes, and [links](https://…). Blank lines start new paragraphs." />
  </label>
  <div className="editor-live-preview"><span className="section-kicker">LIVE PREVIEW</span><ContentBody body={form.body || 'Your formatted article preview appears here as you write.'} /></div><label>Original source URL<input type="url" value={form.source_url} onChange={e => setField('source_url', e.target.value)} placeholder="https://…" /></label><label>Cover image URL<input type="url" value={form.cover_image_url} onChange={e => setField('cover_image_url', e.target.value)} placeholder="https://… (optional)" /></label>{form.status === 'scheduled' && <label>Publish date and time<input type="datetime-local" required value={form.scheduled_for} onChange={e => setField('scheduled_for', e.target.value)} /></label>}<div className="editor-options"><label className="check-field"><input type="checkbox" checked={form.featured} onChange={e => setField('featured', e.target.checked)} /> Feature on the homepage</label><label className="check-field"><input type="checkbox" checked={form.allow_download} onChange={e => setField('allow_download', e.target.checked)} /> Allow downloads (where supported)</label></div><div className="form-two-col"><label>Publication status<select value={form.status} onChange={e => setField('status', e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled (needs scheduler secrets configured)</option><option value="archived">Archived</option></select></label><label>Visibility<select value={form.visibility} onChange={e => setField('visibility', e.target.value)}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label></div><div className="editor-submit-row">{editId && form.slug && <button type="button" className="button button-outline" onClick={() => window.open(`/content/${encodeURIComponent(form.slug)}`, '_blank', 'noopener,noreferrer')} title="Requires you to be signed in with edit access in the same browser">Preview saved version <ArrowUpRight size={15} /></button>}<button type="button" className="button button-outline" onClick={() => setTab('content')}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : form.status === 'published' ? 'Publish content' : 'Save content'} <ArrowRight size={15} /></button></div><p className="editor-disclaimer">Autosave keeps an unsubmitted draft in this browser. Scheduled posts publish after the configured scheduler calls the server-side publish_scheduled command.</p></form><aside className="editor-sidebar"><div className="admin-panel editor-help-panel"><span className="section-kicker">PUBLISHING GUIDE</span><h3>From idea to public</h3><ol><li><span>01</span><p>Fill in the title and relevant details.</p></li><li><span>02</span><p>Save as a draft to keep editing privately.</p></li><li><span>03</span><p>Choose Public and Published to show it on the site.</p></li><li><span>04</span><p>Preview on the public site after publishing.</p></li></ol></div>{editId && <RevisionHistoryPanel itemId={editId} itemSlug={form.slug} onRestored={item => { editItem(item); setMessage('Revision restored and saved as a new revision.'); }} />}<div className="admin-panel visibility-help"><LockKeyhole size={18} /><div><strong>Private means private</strong><p>The backend filters draft, private, and unpublished content from anonymous requests.</p></div></div></aside></section>}
      {tab === 'media' && <section className="admin-panel media-panel"><div className="admin-panel-heading"><div><span className="section-kicker">ASSET LIBRARY</span><h2>Media that supports the story</h2><p>Upload cover images or permitted files. Storage needs server-side Supabase credentials.</p></div></div>{uploadProgress !== null && <div className="upload-progress" role="status"><progress max={100} value={uploadProgress} /><span>{uploadProgress >= 100 ? 'Upload complete' : `Uploading asset… ${uploadProgress}%`}</span></div>}{media.length ? <div className="media-grid">{media.map(asset => <div className="media-asset-card" key={asset.id}><div className="media-asset-thumb"><MediaThumbnail asset={asset} /></div><div className="media-asset-meta"><strong className="media-title-edit"><input type="text" maxLength={200} aria-label={`Title for ${asset.original_filename}`} value={mediaDraft(asset).title} placeholder={asset.original_filename} onChange={e => editMediaDraft(asset, { title: e.target.value })} onBlur={() => void saveMediaField(asset, 'title', 'title')} /></strong><span>{asset.mime_type} · {formatBytes(asset.file_size)}</span><label className="media-visibility">Description<input type="text" maxLength={500} aria-label={`Description for ${asset.original_filename}`} value={mediaDraft(asset).description} placeholder="Optional description" onChange={e => editMediaDraft(asset, { description: e.target.value })} onBlur={() => void saveMediaField(asset, 'description', 'description')} /></label><label className="media-visibility">Alt text<input type="text" maxLength={300} aria-label={`Alt text for ${asset.original_filename}`} value={mediaDraft(asset).alt_text} onChange={e => editMediaDraft(asset, { alt_text: e.target.value })} onBlur={() => void saveMediaField(asset, 'alt_text', 'alt text')} /></label><label className="media-visibility">Visibility<select aria-label={`Visibility for ${asset.title || asset.original_filename}`} value={asset.visibility} onChange={async e => { try { await api.updateMedia(asset.id, { visibility: e.target.value }); setMessage('Media visibility updated.'); await loadMedia(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not update visibility.'); } }}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label><label className="media-download-check"><input type="checkbox" checked={asset.downloadable} onChange={async e => { try { await api.updateMedia(asset.id, { downloadable: e.target.checked }); setMessage('Download permission updated.'); await loadMedia(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not update download permission.'); } }} /> Allow download</label></div><div className="media-asset-actions"><button className="button button-outline button-small" onClick={async () => { try { const signed = await api.signedMediaUrl(asset.id); window.open(signed.url, '_blank', 'noopener,noreferrer'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not preview asset.'); } }}>Preview <ArrowUpRight size={14} /></button><button className="button button-outline button-small media-delete" aria-label={`Delete ${asset.title || asset.original_filename}`} onClick={() => void removeMedia(asset)}>Delete <Trash2 size={14} /></button></div></div>)}</div> : <div className="table-empty"><FolderOpen size={22} /><p>No media assets have been uploaded.</p><p className="muted-small">Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET on the backend to enable uploads.</p></div>}</section>}
      </div>
    </div>

      {tab === 'settings' && <SiteSettingsPanel onMessage={setMessage} />}
      {tab === 'profile' && canManage && <CreatorProfilePanel onMessage={setMessage} />}
      {tab === 'team' && isAdmin && <TeamManagementPanel isOwner={Boolean(user.is_superuser)} currentUserId={user.id} onMessage={setMessage} />}
      {tab === 'security' && <TwoFactorSecurityPanel onMessage={setMessage} />}
      {tab === 'audit' && isAdmin && <AuditHistoryPanel onMessage={setMessage} />}
      {tab === 'newsletter' && isAdmin && <NewsletterSubscribersPanel onMessage={setMessage} />}
      {tab === 'collections' && <CollectionsManagerPanel items={items} onMessage={setMessage} createRequest={collectionCreateRequest} />}
      {tab === 'inbox' && <ContactInboxPanel onMessage={setMessage} />}
      {tab === 'analytics' && <AnalyticsPanel onMessage={setMessage} />}
      {tab === 'moderation' && <SuggestionModerationPanel onMessage={setMessage} />}
      {tab === 'comments' && <CommentModerationPanel onMessage={setMessage} />}
  </div>;
}

function useAdminHeaderRefresh(tab: string, refresh: () => void) {
  useEffect(() => {
    const handler = (event: Event) => { if ((event as CustomEvent<string>).detail === tab) refresh(); };
    window.addEventListener('alib-admin-header-refresh', handler);
    return () => window.removeEventListener('alib-admin-header-refresh', handler);
  });
}

function AuditHistoryPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [objectType, setObjectType] = useState('');
  const [loading, setLoading] = useState(true);
  async function reload() { setLoading(true); try { setEvents(await api.auditEvents({ ...(actionFilter ? { action: actionFilter } : {}), ...(objectType ? { object_type: objectType } : {}) })); } catch (e) { onMessage(e instanceof Error ? e.message : 'Audit history could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  useAdminHeaderRefresh('audit', () => { void reload(); });
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">OWNER-ONLY SECURITY HISTORY</span><h2>Administrative audit trail</h2><p>Recent content changes, moderation, team invitations and settings activity. Sensitive detail is only shown to administrators.</p></div><ClipboardList size={19} /></div>
    <form className="audit-filters" onSubmit={e => { e.preventDefault(); void reload(); }}><label>Action contains<input value={actionFilter} onChange={e => setActionFilter(e.target.value)} placeholder="content.updated" /></label><label>Object type<input value={objectType} onChange={e => setObjectType(e.target.value)} placeholder="ContentItem" /></label><button className="button button-outline button-small">Apply filters</button></form>
    {loading ? <div className="admin-empty">Loading audit history…</div> : events.length ? <div className="admin-inbox-list">{events.map(event => <article className="audit-event-row" key={event.id}><div><strong>{event.action}</strong><span>{event.actor} · {event.object_type || 'System'} {event.object_id && `#${event.object_id}`} · {formatDate(event.created_at)}</span>{Object.keys(event.details || {}).length > 0 && <details><summary>View event details</summary><pre>{JSON.stringify(event.details, null, 2)}</pre></details>}</div></article>)}</div> : <div className="admin-empty"><ClipboardList size={22} /><h3>No audit events match those filters.</h3></div>}</section>;
}

function NewsletterSubscribersPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriberItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  async function reload() { setLoading(true); try { setSubscribers(await api.newsletterSubscribers(filter)); } catch (e) { onMessage(e instanceof Error ? e.message : 'Subscribers could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, [filter]);
  const confirmed = subscribers.filter(row => row.is_active).length;
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">OPT-IN AUDIENCE</span><h2>Newsletter subscribers</h2><p>Only confirmed subscriptions are active. The export contains email addresses and must be treated as private data.</p></div><AtSign size={19} /></div>
    <div className="newsletter-admin-controls"><label>Subscription status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option><option value="true">Confirmed</option><option value="false">Pending / inactive</option></select></label><a className="button button-primary button-small" href="/api/v1/admin/newsletter/?export=csv"><ArrowDown size={14} /> Export CSV</a></div>
    <div className="admin-stat-grid"><AdminStat icon={<AtSign size={18} />} label="Loaded subscribers" value={subscribers.length} hint="Filtered list, up to 500" /><AdminStat icon={<Check size={18} />} label="Confirmed in view" value={confirmed} hint="Active opt-ins only" /></div>
    {loading ? <div className="admin-empty">Loading subscribers…</div> : subscribers.length ? <div className="admin-inbox-list">{subscribers.map(row => <article className="subscriber-row" key={row.id}><div><strong>{row.email}</strong><span>{row.is_active ? 'Confirmed subscription' : 'Pending / inactive'}</span><time>Added {formatDate(row.created_at)}{row.confirmed_at ? ` · Confirmed ${formatDate(row.confirmed_at)}` : ''}</time></div><span className={`status-pill ${row.is_active ? 'status-published' : 'status-draft'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></article>)}</div> : <div className="admin-empty"><AtSign size={22} /><h3>No subscribers found.</h3><p>Newsletter confirmation emails require SMTP to be configured on the server.</p></div>}</section>;
}
function TwoFactorSecurityPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [state, setState] = useState<TwoFactorStatus | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  async function reload() { setLoading(true); try { setState(await api.twoFactorStatus()); } catch (e) { onMessage(e instanceof Error ? e.message : 'Two-factor status could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  async function enable(e: FormEvent) { e.preventDefault(); setBusy(true); try { const result = await api.enableTwoFactor(code); onMessage(result.detail); setCode(''); await reload(); } catch (e) { onMessage(e instanceof Error ? e.message : 'Two-factor setup failed.'); } finally { setBusy(false); } }
  async function disable(e: FormEvent) { e.preventDefault(); setBusy(true); try { const result = await api.disableTwoFactor(code, password); onMessage(result.detail); setCode(''); setPassword(''); await reload(); } catch (e) { onMessage(e instanceof Error ? e.message : 'Two-factor could not be disabled.'); } finally { setBusy(false); } }
  if (loading) return <div className="admin-panel admin-empty">Loading account security…</div>;
  return <section className="admin-panel security-panel"><div className="admin-panel-heading"><div><span className="section-kicker">OWNER AND STAFF SIGN-IN</span><h2>Authenticator-app verification</h2><p>Use a TOTP-compatible authenticator app. Codes are time-based, expire quickly, and are only accepted once per step.</p></div><ShieldCheck size={20} /></div>
    {state?.enabled ? <form className="settings-form" onSubmit={disable}><div className="security-enabled-state"><Check size={19} /><div><strong>Two-factor authentication is enabled</strong><p>Your next sign-in requires your password and a fresh authenticator code.</p></div></div><label>Current password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><label>Authenticator code<input inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label><button className="button button-outline" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Disable two-factor'}</button></form> : <form className="settings-form" onSubmit={enable}><div className="security-setup-step"><span>01</span><div><strong>Add ALIB to your authenticator app</strong><p>In your authenticator, add an account using the manual key below or the provisioning URI. The URI can include the secret; do not share it or paste it into public sites.</p></div></div><label>Manual setup key<input readOnly value={state?.secret || ''} onFocus={e => e.currentTarget.select()} /></label><label>Provisioning URI<input readOnly value={state?.otpauth_uri || ''} onFocus={e => e.currentTarget.select()} /></label><div className="security-setup-step"><span>02</span><div><strong>Verify before enabling</strong><p>Enter the six-digit code shown in the app. ALIB will enforce the code at each subsequent sign-in.</p></div></div><label>Authenticator code<input inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label><button className="button button-primary" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Enable two-factor authentication'} <ShieldCheck size={15} /></button></form>}</section>;
}
function TeamManagementPanel({ isOwner, currentUserId, onMessage }: { isOwner: boolean; currentUserId: number; onMessage: (message: string) => void }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('editor');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  async function reload() { setLoading(true); try { setMembers(await api.team()); } catch (e) { onMessage(e instanceof Error ? e.message : 'Team list could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  async function invite(e: FormEvent) {
    e.preventDefault(); setInviting(true);
    try { const result = await api.inviteTeamMember({ username, email, role }); onMessage(result.detail); setUsername(''); setEmail(''); await reload(); }
    catch (e) { onMessage(e instanceof Error ? e.message : 'Invitation could not be sent. Check the email provider settings.'); }
    finally { setInviting(false); }
  }
  async function update(member: TeamMember, payload: { role?: TeamRole; is_active?: boolean; reset_two_factor?: boolean }) {
    try { const saved = await api.updateTeamMember(member.id, payload); setMembers(current => current.map(row => row.id === saved.id ? saved : row)); onMessage(`Updated access for ${member.username}.`); }
    catch (e) { onMessage(e instanceof Error ? e.message : 'Team access could not be updated.'); await reload(); }
  }
  return <div className="team-management-layout">
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">STAFF ACCESS</span><h2>Invite a teammate</h2><p>A setup link is emailed to the invited member. SMTP must be configured on the server.</p></div><Users size={19} /></div>
      <form id="team-invite-form" className="settings-form" onSubmit={invite}>
        <label>Username<input required maxLength={150} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" /></label>
        <label>Work email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Access role<select value={role} onChange={e => setRole(e.target.value as TeamRole)}><option value="editor">Editor — content and media</option><option value="moderator">Moderator — comments, suggestions and contact inbox</option><option value="support">Support — overview and analytics</option>{isOwner && <option value="administrator">Administrator — full access</option>}</select></label>
        <button className="button button-primary" disabled={inviting}>{inviting ? 'Sending invitation…' : 'Invite teammate'} <Mail size={15} /></button>
      </form>
    </section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">TEAM DIRECTORY</span><h2>Current team</h2><p>Least-privilege roles control the APIs as well as which sections appear here.</p></div><button className="button button-outline button-small" onClick={() => void reload()} disabled={loading}>Refresh</button></div>
      {loading ? <div className="admin-empty">Loading team…</div> : members.map(member => <article className="team-member-row" key={member.id}>
        <div className="team-member-identity"><span className="admin-avatar">{member.username.slice(0,1).toUpperCase()}</span><div><strong>{member.username}</strong><a href={`mailto:${member.email}`}>{member.email || 'No email address'}</a><small>{member.is_superuser ? 'Owner superuser' : member.is_active ? 'Active staff account' : 'Deactivated account'}</small></div></div>
        <div className="team-member-controls"><label className="sr-only" htmlFor={`team-role-${member.id}`}>Role for {member.username}</label><select id={`team-role-${member.id}`} value={member.role === 'none' ? 'editor' : member.role} disabled={member.is_superuser || (!isOwner && member.role === 'administrator')} onChange={e => void update(member, { role: e.target.value as TeamRole })}><option value="editor">Editor</option><option value="moderator">Moderator</option><option value="support">Support</option>{isOwner && <option value="administrator">Administrator</option>}</select>
          {!member.is_superuser && <button className="button button-outline button-small" onClick={() => void update(member, { is_active: !member.is_active })}>{member.is_active ? 'Deactivate' : 'Reactivate'}</button>}{isOwner && !member.is_superuser && member.id !== currentUserId && <button className="button button-outline button-small" onClick={() => { if (window.confirm(`Reset two-factor setup for ${member.username}? They will need to enrol a new authenticator at their next sign-in.`)) void update(member, { reset_two_factor: true }); }}>Reset 2FA</button>}
        </div>
      </article>)}
    </section>
  </div>;
}

function RevisionHistoryPanel({ itemId, itemSlug, onRestored }: { itemId: number; itemSlug: string; onRestored: (item: ContentItem) => void }) {
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [current, setCurrent] = useState<ContentItem | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  useEffect(() => {
    api.revisions(itemId).then(rows => { setRevisions(rows); if (rows.length) setSelectedRevisionId(rows[0].id); }).catch(e => setError(e instanceof Error ? e.message : 'Revision history unavailable.'));
  }, [itemId]);
  useEffect(() => { if (itemSlug) api.contentDetail(itemSlug).then(setCurrent).catch(() => setCurrent(null)); }, [itemId, itemSlug]);

  async function restore(id: number) {
    if (!window.confirm('Restore this revision? The current version will be retained as another revision.')) return;
    setBusyId(id); setError('');
    try { onRestored(await api.restoreRevision(itemId, id)); const updated = await api.revisions(itemId); setRevisions(updated); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not restore revision.'); }
    finally { setBusyId(null); }
  }
  const selected = revisions.find(revision => revision.id === selectedRevisionId);
  const snapshot = selected?.snapshot || {};
  const currentSnapshot: Record<string, unknown> = current ? { title: current.title, slug: current.slug, summary: current.summary, body: current.body, content_type: current.content_type, source_url: current.source_url, cover_image_url: current.cover_image_url, visibility: current.visibility, status: current.status, featured: current.featured, allow_download: current.allow_download, scheduled_for: current.scheduled_for, metadata: current.metadata } : {};
  const diffKeys = ['title', 'slug', 'summary', 'body', 'content_type', 'source_url', 'cover_image_url', 'visibility', 'status', 'featured', 'allow_download', 'scheduled_for', 'metadata'].filter(key => JSON.stringify(snapshot[key]) !== JSON.stringify(currentSnapshot[key]));
  return <section className="admin-panel revision-panel"><div className="admin-panel-heading"><div><span className="section-kicker">VERSION HISTORY</span><h2>Saved revisions</h2><p>Compare a saved snapshot with the current database version before restoring it.</p></div><History size={18} /></div>{error && <p className="error-message">{error}</p>}{revisions.length ? <><div className="revision-select-row"><label>Revision to compare<select value={selectedRevisionId ?? ''} onChange={e => setSelectedRevisionId(Number(e.target.value))}>{revisions.slice(0, 20).map(rev => <option value={rev.id} key={rev.id}>Revision {rev.revision_number} — {formatDate(rev.created_at)} — {String(rev.snapshot.title || 'Untitled')}</option>)}</select></label>{selected && <button className="button button-outline button-small" disabled={busyId === selected.id} onClick={() => void restore(selected.id)}>{busyId === selected.id ? 'Restoring…' : 'Restore this revision'}</button>}</div>{selected && <div className="revision-compare"><div className="revision-compare-heading"><strong>Field comparison</strong><span>{diffKeys.length} changed field{diffKeys.length === 1 ? '' : 's'}</span></div>{diffKeys.map(key => <div className="revision-diff-row" key={key}><strong>{key.replaceAll('_', ' ')}</strong><div><span>Saved revision</span><pre>{JSON.stringify(snapshot[key] ?? null, null, 2) ?? 'null'}</pre></div><div><span>Current version</span><pre>{JSON.stringify(currentSnapshot[key] ?? null, null, 2) ?? 'null'}</pre></div></div>)}</div>}</> : !error && <p className="panel-muted">No saved revisions returned yet.</p>}</section>;
}

function CreatorProfilePanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [profile, setProfile] = useState<CreatorProfile>(fallbackProfile);
  const [socialJson, setSocialJson] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [, setSaving] = useState(false);
  useEffect(() => {
    api.profile().then(value => { setProfile(value); setSocialJson(JSON.stringify(value.social_links || {}, null, 2)); })
      .catch(e => onMessage(e instanceof Error ? e.message : 'Profile could not load.'))
      .finally(() => setLoading(false));
  }, []);
  function setField<K extends keyof CreatorProfile>(key: K, value: CreatorProfile[K]) { setProfile(prev => ({ ...prev, [key]: value })); }
  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true);
    let links: Record<string, string>;
    try {
      const parsed = JSON.parse(socialJson);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || Object.values(parsed).some(value => typeof value !== 'string')) throw new Error('Social links must be a JSON object with text values.');
      links = parsed as Record<string, string>;
    } catch (e) { onMessage(e instanceof Error ? e.message : 'Social links must be valid JSON.'); setSaving(false); return; }
    try {
      const saved = await api.saveProfile({ ...profile, social_links: links });
      setProfile(saved); setSocialJson(JSON.stringify(saved.social_links || {}, null, 2));
      onMessage('Creator profile saved.');
    } catch (e) { onMessage(e instanceof Error ? e.message : 'Profile could not be saved.'); }
    finally { setSaving(false); }
  }
  return <section className="admin-panel settings-panel"><div className="admin-panel-heading"><div><span className="section-kicker">PUBLIC CREATOR PROFILE</span><h2>About the creator</h2><p>{loading ? 'Loading profile…' : 'These fields appear on the public site.'}</p></div><UserRound size={19} /></div><form id="creator-profile-form" className="settings-form" onSubmit={save}><div className="form-two-col"><label>Display name<input required maxLength={120} value={profile.display_name} onChange={e => setField('display_name', e.target.value)} /></label><label>Location<input maxLength={120} value={profile.location} onChange={e => setField('location', e.target.value)} placeholder="Optional" /></label></div><label>Headline<input required maxLength={240} value={profile.headline} onChange={e => setField('headline', e.target.value)} /></label><label>Biography<textarea rows={6} maxLength={5000} value={profile.biography} onChange={e => setField('biography', e.target.value)} /></label><label>Avatar image URL<input type="url" value={profile.avatar_url} onChange={e => setField('avatar_url', e.target.value)} placeholder="https://… (optional)" /></label><label>Social links (JSON object)<textarea rows={4} spellCheck={false} value={socialJson} onChange={e => setSocialJson(e.target.value)} placeholder={'{ "website": "https://example.com" }'} /></label></form></section>;
}

function SiteSettingsPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [settings, setSettings] = useState<SiteSettings>({ site_title: 'ALIB — Digital Home', logo_url: '', favicon_url: '', seo_description: '', homepage_sections: ['featured', 'latest', 'categories', 'collections'], theme_preferences: { primary: '#2563eb', secondary: '#facc15' }, owner_name: 'Mukamyi Izere Arcange', copyright_text: '© {year} {owner_name}. All rights reserved.', site_copy: {} });
  const [loading, setLoading] = useState(true);
  const [, setSaving] = useState(false);
  const [copyJson, setCopyJson] = useState('{}');
  const sectionOptions = [
    { key: 'featured', label: 'Featured content', help: 'Curated highlights near the top of the homepage.' },
    { key: 'latest', label: 'Latest content', help: 'Recently published articles and resources.' },
    { key: 'categories', label: 'Categories', help: 'Browse the archive by topic.' },
    { key: 'collections', label: 'Collections', help: 'Hand-curated groups of content.' },
  ] as const;
  useEffect(() => { api.settings().then(value => { setSettings(value); setCopyJson(JSON.stringify(value.site_copy || {}, null, 2)); }).catch(e => onMessage(e instanceof Error ? e.message : 'Could not load site settings.')).finally(() => setLoading(false)); }, []);
  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) { setSettings(prev => ({ ...prev, [key]: value })); }
  const visibleSections = settings.homepage_sections.filter((key, index, all) => sectionOptions.some(option => option.key === key) && all.indexOf(key) === index);
  const hiddenSections = sectionOptions.filter(option => !visibleSections.includes(option.key));
  function moveSection(key: string, delta: number) {
    setSettings(previous => {
      const sections = previous.homepage_sections.filter((item, index, all) => sectionOptions.some(option => option.key === item) && all.indexOf(item) === index);
      const index = sections.indexOf(key);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return previous;
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...previous, homepage_sections: sections };
    });
  }
  function toggleSection(key: string, enabled: boolean) {
    setSettings(previous => {
      const sections = previous.homepage_sections.filter((item, index, all) => sectionOptions.some(option => option.key === item) && all.indexOf(item) === index);
      return { ...previous, homepage_sections: enabled ? [...sections, key] : sections.filter(item => item !== key) };
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    let siteCopyValue: Record<string, string>;
    try {
      const parsed: unknown = JSON.parse(copyJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.entries(parsed).some(([key, value]) => !key.trim() || typeof value !== 'string')) throw new Error('Use a JSON object with non-empty keys and text values.');
      siteCopyValue = parsed as Record<string, string>;
    } catch (error) {
      onMessage(error instanceof Error ? 'Website copy JSON is invalid: ' + error.message : 'Website copy JSON is invalid.');
      return;
    }
    setSaving(true);
    try {
      const saved = await api.saveSettings({ ...settings, owner_name: settings.owner_name.trim() || 'Mukamyi Izere Arcange', site_copy: siteCopyValue });
      setSettings(saved); setCopyJson(JSON.stringify(saved.site_copy || {}, null, 2));
      window.dispatchEvent(new CustomEvent('alib-site-settings-updated', { detail: saved }));
      onMessage('Site settings saved. Public copy and copyright are updated.');
      document.title = saved.site_title;
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Settings could not be saved.'); }
    finally { setSaving(false); }
  }
  return <section className="admin-panel settings-panel"><div className="admin-panel-heading"><div><span className="section-kicker">SITE CONFIGURATION</span><h2>Brand, profile and homepage</h2><p>{loading ? 'Loading settings…' : 'These values are saved in the database.'}</p></div><Settings2 size={19} /></div><form id="site-settings-form" className="settings-form" onSubmit={save}><label>Site title<input required maxLength={140} value={settings.site_title} onChange={e => set('site_title', e.target.value)} /></label><label>SEO description<textarea rows={3} maxLength={300} value={settings.seo_description} onChange={e => set('seo_description', e.target.value)} /></label><div className="form-two-col"><label>Logo URL<input type="url" value={settings.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://… (optional)" /></label><label>Favicon URL<input type="url" value={settings.favicon_url} onChange={e => set('favicon_url', e.target.value)} placeholder="https://… (optional)" /></label></div>
    <div className="form-two-col"><label>Website owner<input required maxLength={160} value={settings.owner_name} onChange={e => set('owner_name', e.target.value)} /></label><label>Copyright template<input maxLength={240} value={settings.copyright_text} onChange={e => set('copyright_text', e.target.value)} placeholder="© {year} {owner_name}. All rights reserved." /></label></div>
    <p className="settings-help-text">Use <code>{'{year}'}</code> for the current year and <code>{'{owner_name}'}</code> for the website owner. The public copyright automatically updates each year.</p>
    <div className="site-copy-editor"><div><span className="section-kicker">PUBLIC WEBSITE WORDING</span><h3>Edit public copy</h3><p>Edit displayed wording across the homepage, navigation, About, Contact, Recommendations, and footer. Keep keys unchanged and edit their string values. Additional keys are saved for future copy-controlled areas.</p></div><label>Website text (JSON)<textarea rows={18} spellCheck={false} aria-label="Editable public website copy as JSON" value={copyJson} onChange={e => setCopyJson(e.target.value)} /></label><p className="settings-help-text">Common keys: <code>home.hero.intro</code>, <code>home.intro.heading</code>, <code>about.title</code>, <code>contact.intro</code>, <code>suggest.intro</code>, <code>footer.description</code>, and <code>nav.home</code>.</p></div>
    <div className="homepage-section-controls"><div><span className="section-kicker">HOMEPAGE SECTIONS</span><p>Choose what appears on the public homepage. Move visible sections up or down to change their order.</p></div>
      {visibleSections.length ? visibleSections.map((key, index) => { const option = sectionOptions.find(section => section.key === key)!; return <div className="homepage-section-row" key={key}><div><strong>{index + 1}. {option.label}</strong><small>{option.help}</small></div><div className="homepage-section-actions"><button type="button" className="button button-outline button-small" disabled={index === 0} aria-label={`Move ${option.label} up`} onClick={() => moveSection(key, -1)}>Up</button><button type="button" className="button button-outline button-small" disabled={index === visibleSections.length - 1} aria-label={`Move ${option.label} down`} onClick={() => moveSection(key, 1)}>Down</button><button type="button" className="button button-outline button-small homepage-hide-button" onClick={() => toggleSection(key, false)}>Hide</button></div></div>; }) : <p className="homepage-sections-empty">All homepage sections are hidden. Add one below to show content to visitors.</p>}
      {hiddenSections.length > 0 && <div className="homepage-section-additions"><span className="section-kicker">HIDDEN SECTIONS</span>{hiddenSections.map(option => <button type="button" key={option.key} className="button button-outline button-small" onClick={() => toggleSection(option.key, true)}>Show {option.label}</button>)}</div>}
    </div><div className="settings-theme"><div><strong>Primary blue</strong><span>#2563EB</span></div><div><strong>Accent yellow</strong><span>#FACC15</span></div><p>ALIB uses the established blue-and-yellow palette.</p></div></form></section>;
}

function ContactInboxPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [rows, setRows] = useState<ContactInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  async function reload(archived = showArchived) { setLoading(true); try { setRows(await api.contactInbox(archived)); } catch (e) { onMessage(e instanceof Error ? e.message : 'Inbox could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(showArchived); }, [showArchived]);
  async function mark(row: ContactInboxItem) { try { await api.reviewContact(row.id, !row.reviewed); await reload(); } catch (e) { onMessage(e instanceof Error ? e.message : 'Message could not be updated.'); } }
  async function archive(row: ContactInboxItem) { try { await api.archiveContact(row.id, !row.archived); onMessage(row.archived ? 'Message restored to the inbox.' : 'Message archived.'); await reload(); } catch (e) { onMessage(e instanceof Error ? e.message : 'Message could not be archived.'); } }
  async function remove(row: ContactInboxItem) { if (!window.confirm(`Permanently delete the message from ${row.name}? This cannot be undone.`)) return; try { await api.deleteContact(row.id); onMessage('Message deleted.'); await reload(); } catch (e) { onMessage(e instanceof Error ? e.message : 'Message could not be deleted.'); } }
  useAdminHeaderRefresh('inbox', () => { void reload(); });
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">PRIVATE CONTACT MESSAGES</span><h2>{showArchived ? 'Archived messages' : 'Creator inbox'}</h2><p>Contact messages are only available to signed-in staff.</p></div><button className="button button-outline button-small" onClick={() => setShowArchived(value => !value)}>{showArchived ? 'Back to inbox' : 'View archive'}</button></div>{loading ? <div className="admin-empty">Loading inbox…</div> : rows.length ? <div className="admin-inbox-list">{rows.map(row => <article className={`inbox-row ${row.reviewed ? 'is-reviewed' : ''}`} key={row.id}><div><strong>{row.name}</strong><a href={`mailto:${row.email}`}>{row.email}</a><time>{formatDate(row.created_at)}</time><p>{row.message}</p></div><div className="inbox-row-actions"><button className="button button-outline button-small" onClick={() => void mark(row)}>{row.reviewed ? 'Mark unread' : 'Mark reviewed'}</button><button className="button button-outline button-small" onClick={() => void archive(row)}>{row.archived ? 'Restore' : 'Archive'}</button><button className="button button-outline button-small inbox-delete-button" onClick={() => void remove(row)}>Delete</button></div></article>)}</div> : <div className="admin-empty"><Mail size={22} /><h3>{showArchived ? 'No archived messages.' : 'No messages yet.'}</h3><p>{showArchived ? 'Messages you archive appear here until deleted.' : 'Messages from the public Contact page appear here.'}</p></div>}</section>;
}

function AnalyticsPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');
  async function reload() { setError(''); try { setData(await api.adminAnalytics()); } catch (e) { const message = e instanceof Error ? e.message : 'Analytics could not load.'; setError(message); onMessage(message); } }
  useEffect(() => { void reload(); }, []);
  useAdminHeaderRefresh('analytics', () => { void reload(); });
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">REAL EVENTS ONLY / LAST 30 DAYS</span><h2>Audience analytics</h2><p>Counts come from actual page and outbound events recorded by the API.</p></div><BarChart3 size={19} /></div>{error && <p className="error-message">{error}</p>}{data && <><div className="admin-stat-grid"><AdminStat icon={<BarChart3 size={18} />} label="Page views" value={data.page_views} hint="Recorded events" /><AdminStat icon={<ExternalLink size={18} />} label="Outbound clicks" value={data.outbound_clicks} hint="Source links opened" /><AdminStat icon={<Search size={18} />} label="Searches" value={data.searches} hint="Search activity" /><AdminStat icon={<Heart size={18} />} label="Daily visitors" value={data.unique_daily_visitors_approx} hint="Approximate, privacy-salted" /></div><div className="admin-inbox-list">{data.popular_paths.map(row => <div className="analytics-path-row" key={row.path}><code>{row.path}</code><strong>{row.views} views</strong></div>)}</div></>}</section>;
}

function SuggestionModerationPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [suggestions, setSuggestions] = useState<Array<{ id: number; title: string; url: string; reason: string; status: string; created_at: string }>>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  async function reload() { setLoading(true); try { const result = await api.adminSuggestions(); setSuggestions(result.results); setSelected(current => current.filter(id => result.results.some(row => row.id === id))); } catch (e) { onMessage(e instanceof Error ? e.message : 'Suggestions could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  async function review(id: number, status: 'approved' | 'rejected') { try { await api.reviewSuggestion(id, status); await reload(); onMessage(`Suggestion ${status}.`); } catch (e) { onMessage(e instanceof Error ? e.message : 'Suggestion could not be reviewed.'); } }
  async function bulkReview(status: 'approved' | 'rejected') {
    if (!selected.length) return;
    setBusy(true);
    try { const result = await api.bulkReviewSuggestions(selected, status); setSelected([]); await reload(); onMessage(`${result.updated} suggestion(s) ${status}.`); }
    catch (e) { onMessage(e instanceof Error ? e.message : 'Bulk moderation failed.'); }
    finally { setBusy(false); }
  }
  useAdminHeaderRefresh('moderation', () => { void reload(); });
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">COMMUNITY QUEUE</span><h2>Suggestions for review</h2><p>Approval records moderation only; it does not publish content automatically. Duplicate links are blocked.</p></div><ShieldCheck size={19} /></div>
    {suggestions.length > 0 && <div className="bulk-moderation-toolbar"><label className="check-field"><input type="checkbox" checked={suggestions.length > 0 && selected.length === suggestions.length} onChange={e => setSelected(e.target.checked ? suggestions.map(row => row.id) : [])} /> Select all visible ({suggestions.length})</label><span>{selected.length} selected</span><button className="button button-primary button-small" disabled={busy || !selected.length} onClick={() => void bulkReview('approved')}>{busy ? 'Working…' : 'Approve selected'}</button><button className="button button-outline button-small" disabled={busy || !selected.length} onClick={() => void bulkReview('rejected')}>Reject selected</button></div>}
    {loading ? <div className="admin-empty">Loading suggestions…</div> : suggestions.length ? <div className="admin-inbox-list">{suggestions.map(row => <article className="inbox-row" key={row.id}><label className="moderation-select"><input type="checkbox" checked={selected.includes(row.id)} onChange={e => setSelected(current => e.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} /><span className="sr-only">Select {row.title}</span></label><div><strong>{row.title}</strong><a href={row.url} target="_blank" rel="noreferrer">{row.url}</a><time>{formatDate(row.created_at)} · {row.status}</time>{row.reason && <p>{row.reason}</p>}</div><div className="moderation-actions"><button className="button button-primary button-small" onClick={() => void review(row.id, 'approved')}>Approve</button><button className="button button-outline button-small" onClick={() => void review(row.id, 'rejected')}>Reject</button></div></article>)}</div> : <div className="admin-empty"><Check size={22} /><h3>The moderation queue is clear.</h3></div>}</section>;
}

function CommentModerationPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(true);
  async function reload() { setLoading(true); try { const result = await api.comments(); setComments(result.results); } catch (e) { onMessage(e instanceof Error ? e.message : 'Comments could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  async function moderate(id: number, status: 'approved' | 'rejected') { try { await api.moderateComment(id, status); await reload(); onMessage(`Comment ${status}.`); } catch (e) { onMessage(e instanceof Error ? e.message : 'Comment could not be moderated.'); } }
  useAdminHeaderRefresh('comments', () => { void reload(); });
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">COMMENT MODERATION</span><h2>Reader conversations</h2><p>Review pending comments before they appear on public pages.</p></div><MessageCircle size={19} /></div>{loading ? <div className="admin-empty">Loading comments…</div> : comments.length ? <div className="admin-inbox-list">{comments.map(row => <article className="inbox-row" key={row.id}><div><strong>{row.name}</strong><time>{formatDate(row.created_at)} · {row.status}</time><p>{row.body}</p></div><div className="moderation-actions"><button className="button button-primary button-small" onClick={() => void moderate(row.id, 'approved')}>Approve</button><button className="button button-outline button-small" onClick={() => void moderate(row.id, 'rejected')}>Reject</button></div></article>)}</div> : <div className="admin-empty"><MessageCircle size={22} /><h3>No comments waiting.</h3></div>}</section>;
}

function CollectionsManagerPanel({ items, onMessage, createRequest }: { items: ContentItem[]; onMessage: (message: string) => void; createRequest: number }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  async function reload() { setLoading(true); try { const result = await api.collections(); setCollections(result.results); } catch (e) { onMessage(e instanceof Error ? e.message : 'Collections could not load.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  function editCollection(row: Collection) { setCollectionId(row.id); setTitle(row.title); setDescription(row.description || ''); setCover(row.cover_image_url || ''); setVisibility(row.visibility || 'public'); setSelectedIds(row.current_item_ids || items.filter(x => x.collection_slugs?.includes(row.slug)).map(x => x.id)); }
  function reset() { setCollectionId(undefined); setTitle(''); setDescription(''); setCover(''); setVisibility('public'); setSelectedIds([]); }
  useEffect(() => { if (createRequest > 0) reset(); }, [createRequest]);
  useEffect(() => { if (createRequest > 0) reset(); }, [createRequest]);
  async function save(e: FormEvent) { e.preventDefault(); setSaving(true); try { await api.saveCollection({ title, description, cover_image_url: cover, visibility, item_ids: selectedIds }, collectionId); onMessage('Collection saved.'); reset(); await reload(); } catch (e) { onMessage(e instanceof Error ? e.message : 'Collection could not be saved.'); } finally { setSaving(false); } }
  function move(id: number, delta: number) { setSelectedIds(prev => { const index = prev.indexOf(id); const next = [...prev]; const target = index + delta; if (index < 0 || target < 0 || target >= next.length) return prev; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">CURATION</span><h2>Collections manager</h2><p>Create public collections and persist the reading order of their items.</p></div><Layers3 size={19} /></div><div className="collection-admin-layout"><div className="collection-admin-list">{loading ? <p>Loading collections…</p> : collections.map(row => <button key={row.id} className={collectionId === row.id ? 'collection-admin-item selected' : 'collection-admin-item'} onClick={() => editCollection(row)}><strong>{row.title}</strong><span>{row.visibility} · {row.item_count ?? 0} public items</span></button>)}</div><form className="settings-form" onSubmit={save}><label>Collection title<input required value={title} onChange={e => setTitle(e.target.value)} /></label><label>Description<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Cover image URL<input type="url" value={cover} onChange={e => setCover(e.target.value)} /></label><label>Visibility<select value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'unlisted' | 'private')}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label><div className="collection-content-picker"><span className="section-kicker">ORDERED ITEMS — USE ARROWS TO REORDER</span>{items.map(item => <label key={item.id} className="check-field"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} />{item.title}{selectedIds.includes(item.id) && <span className="order-buttons"><button type="button" aria-label={`Move ${item.title} up`} onClick={e => { e.preventDefault(); move(item.id, -1); }}>↑</button><button type="button" aria-label={`Move ${item.title} down`} onClick={e => { e.preventDefault(); move(item.id, 1); }}>↓</button></span>}</label>)}</div><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save collection'}</button></form></div></section>;
}

function AdminStat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number | string; hint: string }) { return <div className="admin-stat-card"><span className="admin-stat-icon">{icon}</span><span className="admin-stat-label">{label}</span><strong>{value}</strong><span className="admin-stat-hint">{hint}</span></div>; }
function StatusPill({ status }: { status: string }) { return <span className={`status-pill status-${status}`}><span />{status}</span>; }

function labelType(type: ContentType | string) { const names: Record<string, string> = { article: 'Article', note: 'Note', link: 'Website', project: 'Project', video: 'Video', book: 'Book', resource: 'Resource', file: 'File', gallery: 'Gallery', podcast: 'Podcast' }; return names[type] || type; }
function formatDate(value: string | null | undefined) { if (!value) return 'Not dated'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Not dated' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d); }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }

export default App;
