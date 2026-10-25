import React, { useEffect, useState } from 'react';
import api from '../../api';

type ExplainRow = {
  id: number;
  name: string;
  slug: string;
  url_slug?: string;
  price: string;
  image: string | null;
  category: string;
  seller: string;
  score: number;
  slot: string;
  reason: string;
  breakdown: Record<string, number>;
};
type ReasonBlock = { id: string; kind: string; title: string; shelf_score: number | null; items: ExplainRow[] };
type NamedId = { id: number; name: string };
type Signals = {
  recent: NamedId[];
  liked: NamedId[];
  purchased: NamedId[];
  vehicle_id: number | null;
  vehicle: string | null;
  region: string;
  gender: string;
  top_categories: { id: number; name: string; affinity: number }[];
};
type InspectPayload = {
  signals: Signals;
  reasons: ReasonBlock[];
  generated_at: string;
  cached?: boolean;
  user?: { id: number; username: string; name: string };
};
type UserRow = {
  id: number;
  username: string;
  name: string;
  last_login: string | null;
  recent_views: number;
  likes: number;
  orders: number;
  vehicle_id: number | null;
  region: string;
};
type ProductInspect = {
  product: { id: number; name: string; slug: string; price: string; category: string };
  stats: Record<string, string | number | boolean | null> | null;
  recs_computed_at: string | null;
  reasons: ReasonBlock[];
};
type Health = {
  window_days: number;
  surfaces: { surface: string; impressions: number; clicks: number; ctr: number }[];
  active_products: number;
  products_with_stats: number;
  products_with_recs: number;
  catalog_coverage_pct: number;
  last_recs_build: string | null;
  last_stats_refresh: string | null;
  users_with_rec_profile: number;
  generated_at: string;
};
type Tab = 'users' | 'product' | 'simulate' | 'health';

const CARD = 'bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border p-4';
const INPUT = 'w-full rounded-btn border border-surface-border dark:border-surface-dark-border bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white';
const BTN = 'px-3 py-2 rounded-btn text-sm font-semibold bg-brand-500 text-white hover:opacity-90 disabled:opacity-50';

const formatPrice = (p: string): string => {
  const n = Number(p);
  return Number.isFinite(n) ? `TSh ${n.toLocaleString()}` : p;
};
const formatDate = (d: string | null | undefined): string => (d ? new Date(d).toLocaleString() : '—');

const BreakdownBars: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const entries = Object.entries(data || {}).filter(([, v]) => typeof v === 'number' && v !== 0);
  if (entries.length === 0) return <span className="text-xs text-gray-400">—</span>;
  const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.0001);
  return (
    <div className="space-y-0.5 min-w-[200px]">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-[11px]">
          <span className="w-36 truncate text-gray-500" title={k}>{k}</span>
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded">
            <div className="h-1.5 bg-brand-500 rounded" style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono text-gray-700 dark:text-gray-300">{v.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
};

const ReasonTable: React.FC<{ block: ReasonBlock }> = ({ block }) => (
  <div className={CARD}>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{block.title}</h4>
        <p className="text-[11px] text-gray-400 font-mono">
          {block.kind} · {block.id}
          {block.shelf_score !== null && block.shelf_score !== undefined ? ` · shelf score ${block.shelf_score}` : ''}
        </p>
      </div>
      <span className="text-xs text-gray-400">{block.items.length} items</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-gray-400">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Product</th>
            <th className="py-1 pr-2">Score</th>
            <th className="py-1 pr-2">Slot</th>
            <th className="py-1">Why (score parts)</th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((r, i) => (
            <tr key={`${block.id}-${r.id}`} className="border-t border-gray-100 dark:border-neutral-800 align-top">
              <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  {r.image ? (
                    <img src={r.image} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-neutral-800" />
                  )}
                  <div className="min-w-0">
                    <a href={`/product/${r.url_slug || r.slug}`} target="_blank" rel="noreferrer" className="font-medium text-gray-900 dark:text-white hover:underline line-clamp-1">
                      {r.name}
                    </a>
                    <p className="text-[11px] text-gray-400">{r.category} · @{r.seller} · {formatPrice(r.price)}</p>
                  </div>
                </div>
              </td>
              <td className="py-2 pr-2 font-mono">{r.score.toFixed(3)}</td>
              <td className="py-2 pr-2">
                {r.slot ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.slot === 'sponsored' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                    {r.slot}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">organic</span>
                )}
              </td>
              <td className="py-2"><BreakdownBars data={r.breakdown} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SignalList: React.FC<{ label: string; items: NamedId[] }> = ({ label, items }) => (
  <div>
    <p className="text-[11px] uppercase font-bold text-gray-400 mb-1">{label} ({items.length})</p>
    {items.length === 0 ? (
      <p className="text-xs text-gray-400">none</p>
    ) : (
      <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5 max-h-32 overflow-y-auto">
        {items.map((it) => (
          <li key={`${label}-${it.id}`} className="truncate">#{it.id} · {it.name}</li>
        ))}
      </ul>
    )}
  </div>
);

const SignalsCard: React.FC<{ signals: Signals }> = ({ signals }) => (
  <div className={CARD}>
    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Signals used</h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SignalList label="Recently viewed" items={signals.recent} />
      <SignalList label="Liked" items={signals.liked} />
      <SignalList label="Purchased" items={signals.purchased} />
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800">Vehicle: {signals.vehicle || '—'}</span>
      <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800">Region: {signals.region || '—'}</span>
      <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800">Gender: {signals.gender || 'unknown'}</span>
      {signals.top_categories.map((c) => (
        <span key={c.id} className="px-2 py-1 rounded-full bg-brand-500/10 text-brand-500">{c.name} {Math.round(c.affinity * 100)}%</span>
      ))}
    </div>
  </div>
);

const InspectView: React.FC<{ data: InspectPayload }> = ({ data }) => (
  <div className="space-y-4">
    <SignalsCard signals={data.signals} />
    {data.reasons.length === 0 ? (
      <div className={CARD}><p className="text-sm text-gray-500">No recommendations could be generated for these signals.</p></div>
    ) : (
      data.reasons.map((r) => <ReasonTable key={r.id} block={r} />)
    )}
    <p className="text-[11px] text-gray-400">
      Generated {formatDate(data.generated_at)}{data.cached ? ' (cached up to 5 min — use Refresh live)' : ''}
    </p>
  </div>
);

const UsersTab: React.FC = () => {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ count: number; results: UserRow[] }>({ count: 0, results: [] });
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<InspectPayload | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoadingList(true);
    const timer = window.setTimeout(() => {
      api.get('/api/recs/admin/users/', { params: { q, page } })
        .then((res) => { if (alive) setList(res.data); })
        .catch(() => { if (alive) setError('Could not load users'); })
        .finally(() => { if (alive) setLoadingList(false); });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, page]);

  const openUser = (id: number, refresh: boolean) => {
    setSelected(id);
    setLoadingDetail(true);
    setError('');
    api.get(`/api/recs/admin/users/${id}/`, { params: refresh ? { refresh: 1 } : {} })
      .then((res) => setDetail(res.data))
      .catch(() => setError('Could not load recommendations for this user'))
      .finally(() => setLoadingDetail(false));
  };

  const pages = Math.max(1, Math.ceil(list.count / 20));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
      <div className={CARD}>
        <input className={INPUT} placeholder="Search username, email, name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <div className="mt-3 divide-y divide-gray-100 dark:divide-neutral-800">
          {loadingList && <p className="text-xs text-gray-400 py-2">Loading…</p>}
          {list.results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => openUser(u.id, false)}
              className={`w-full text-left py-2 px-2 rounded ${selected === u.id ? 'bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-neutral-900'}`}
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">@{u.username}{u.name ? ` · ${u.name}` : ''}</p>
              <p className="text-[11px] text-gray-400">
                {u.recent_views} views · {u.likes} likes · {u.orders} orders{u.vehicle_id ? ' · vehicle' : ''}{u.region ? ` · ${u.region}` : ''}
              </p>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <button type="button" className="px-2 py-1 rounded border border-surface-border disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="text-gray-500">Page {page} / {pages}</span>
          <button type="button" className="px-2 py-1 rounded border border-surface-border disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
      <div>
        {error && <div className={`${CARD} text-red-500 text-sm mb-4`}>{error}</div>}
        {selected === null && (
          <div className={CARD}>
            <p className="text-sm text-gray-500">Select a user to see their signals and the top 5 recommendations for every reason, with full score breakdowns. Guests are anonymous — use the Simulate tab for them.</p>
          </div>
        )}
        {selected !== null && loadingDetail && <div className={CARD}><p className="text-sm text-gray-400">Computing…</p></div>}
        {selected !== null && !loadingDetail && detail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">@{detail.user?.username}</h3>
              <button type="button" className={BTN} onClick={() => openUser(selected, true)}>Refresh live</button>
            </div>
            <InspectView data={detail} />
          </div>
        )}
      </div>
    </div>
  );
};

const ProductTab: React.FC = () => {
  const [q, setQ] = useState('');
  const [data, setData] = useState<ProductInspect | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = () => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    api.get('/api/recs/admin/products/', { params: { q: q.trim() } })
      .then((res) => setData(res.data))
      .catch(() => { setData(null); setError('Product not found'); })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <div className={`${CARD} flex gap-2`}>
        <input className={INPUT} placeholder="Product ID or slug" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
        <button type="button" className={BTN} onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Inspect'}</button>
      </div>
      {error && <div className={`${CARD} text-red-500 text-sm`}>{error}</div>}
      {data && (
        <>
          <div className={CARD}>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{data.product.name}</h4>
            <p className="text-xs text-gray-400">#{data.product.id} · {data.product.category} · {formatPrice(data.product.price)} · lists built {formatDate(data.recs_computed_at)}</p>
            {data.stats && (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {['popularity', 'quality', 'views_7d', 'likes', 'orders_30d', 'rating_avg', 'inspection_pass'].map((k) => (
                  <span key={k} className="px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800">{k}: {String(data.stats?.[k] ?? '—')}</span>
                ))}
              </div>
            )}
          </div>
          {data.reasons.map((r) => <ReasonTable key={r.id} block={r} />)}
        </>
      )}
    </div>
  );
};

const SimulateTab: React.FC = () => {
  const [recent, setRecent] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [region, setRegion] = useState('');
  const [gender, setGender] = useState('');
  const [data, setData] = useState<InspectPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = () => {
    setLoading(true);
    setError('');
    api.post('/api/recs/admin/simulate/', { recent_ids: recent, vehicle_id: vehicle, region, gender })
      .then((res) => setData(res.data))
      .catch(() => setError('Simulation failed'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <div className={`${CARD} grid grid-cols-1 md:grid-cols-5 gap-2`}>
        <input className={`${INPUT} md:col-span-2`} placeholder="Viewed product IDs, most recent first (e.g. 425,388,17)" value={recent} onChange={(e) => setRecent(e.target.value)} />
        <input className={INPUT} placeholder="Vehicle ID (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <input className={INPUT} placeholder="Region (optional)" value={region} onChange={(e) => setRegion(e.target.value)} />
        <div className="flex gap-2">
          <select className={INPUT} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Gender: auto</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <button type="button" className={BTN} onClick={run} disabled={loading}>{loading ? '…' : 'Run'}</button>
        </div>
      </div>
      {error && <div className={`${CARD} text-red-500 text-sm`}>{error}</div>}
      {data && <InspectView data={data} />}
    </div>
  );
};

const HealthTab: React.FC = () => {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const load = (refresh: boolean) => {
    setLoading(true);
    api.get('/api/recs/admin/health/', { params: refresh ? { refresh: 1 } : {} })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(false);
  }, []);

  if (!data) return <div className={CARD}><p className="text-sm text-gray-400">{loading ? 'Loading…' : 'No data'}</p></div>;

  const kpis: [string, string | number][] = [
    ['Active products', data.active_products],
    ['With stats', data.products_with_stats],
    ['With rec lists', data.products_with_recs],
    ['Catalog coverage', `${data.catalog_coverage_pct}%`],
    ['Users with history', data.users_with_rec_profile],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(([label, value]) => (
          <div key={label} className={CARD}>
            <p className="text-[11px] uppercase text-gray-400 font-bold">{label}</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className={CARD}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Click-through rate by surface (last {data.window_days} days)</h4>
          <button type="button" className={BTN} onClick={() => load(true)} disabled={loading}>Refresh</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-gray-400">
              <th className="py-1">Surface</th><th className="py-1">Impressions</th><th className="py-1">Clicks</th><th className="py-1">CTR</th>
            </tr>
          </thead>
          <tbody>
            {data.surfaces.length === 0 && (
              <tr><td colSpan={4} className="py-2 text-xs text-gray-400">No events yet.</td></tr>
            )}
            {data.surfaces.map((s) => (
              <tr key={s.surface} className="border-t border-gray-100 dark:border-neutral-800">
                <td className="py-1 font-mono">{s.surface}</td>
                <td className="py-1">{s.impressions}</td>
                <td className="py-1">{s.clicks}</td>
                <td className="py-1 font-bold">{s.ctr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-400 mt-2">
          Lists built: {formatDate(data.last_recs_build)} · Stats refreshed: {formatDate(data.last_stats_refresh)} · Generated: {formatDate(data.generated_at)}
        </p>
      </div>
    </div>
  );
};

const RecommendationInspector: React.FC = () => {
  const [tab, setTab] = useState<Tab>('users');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'product', label: 'Product' },
    { key: 'simulate', label: 'Simulate visitor' },
    { key: 'health', label: 'Health & CTR' },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Recommendations Inspector</h2>
        <p className="text-sm text-gray-500">See exactly what each user is recommended and why. Scores are computed only when you open a page (no background cost).</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${tab === t.key ? 'bg-brand-500 text-white border-brand-500' : 'border-surface-border dark:border-surface-dark-border text-gray-600 dark:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'product' && <ProductTab />}
      {tab === 'simulate' && <SimulateTab />}
      {tab === 'health' && <HealthTab />}
    </div>
  );
};

export default RecommendationInspector;
