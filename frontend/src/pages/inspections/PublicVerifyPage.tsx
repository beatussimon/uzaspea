import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import inspectionApi from '../../api/inspectionApi';
import { STATUS_COLORS, VERDICT_COLORS, fmtDate } from '../../types/inspection';

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {text}
  </span>
);

const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
  </div>
);

const PublicVerifyPage: React.FC = () => {
  const { inspection_id } = useParams();
  const [query, setQuery] = useState(inspection_id || '');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await inspectionApi.requests.verify(q.trim());
      setResult(res.data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  useEffect(() => {
    if (inspection_id) doSearch(inspection_id);
  }, []);

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <div className="card p-8 text-center">
        <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-brand-600 dark:text-brand-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verify Inspection</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Enter an Inspection ID to verify its authenticity
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input className="input" placeholder="e.g. UZ-AUT-20240424-00001"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className="btn-primary px-4 py-2 shrink-0">
            <Search size={16} />
          </button>
        </form>

        {loading && <div className="mt-6"><Spinner /></div>}

        {searched && !loading && !result && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 text-sm">
            No inspection found with this ID.
          </div>
        )}

        {result && (
          <div className={`mt-6 p-5 rounded-xl border-2 text-left ${
            result.is_verified
              ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-700'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {result.is_verified
                ? <CheckCircle size={20} className="text-green-600" />
                : <Clock size={20} className="text-yellow-600" />}
              <span className={`font-bold ${result.is_verified ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                {result.is_verified ? 'Verified Inspection' : 'Inspection In Progress'}
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{result.inspection_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="text-gray-700 dark:text-gray-300">{result.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge text={result.status} className={STATUS_COLORS[result.status] || 'badge-gray'} />
              </div>
              {result.verdict && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Verdict</span>
                  <Badge text={result.verdict.toUpperCase()} className={VERDICT_COLORS[result.verdict]} />
                </div>
              )}
              {result.report_hash && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Report Hash</span>
                  <span className="font-mono text-xs text-gray-400">{result.report_hash.slice(0, 20)}…</span>
                </div>
              )}
              {result.inspected_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Inspected</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(result.inspected_at)}</span>
                </div>
              )}
            </div>

            {/* Render full report if verified */}
            {result.is_verified && result.summary && (
              <div className="mt-5 pt-5 border-t border-green-200 dark:border-green-800/50 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {result.quality_score && (
                    <div className="text-center shrink-0">
                      <div className="text-2xl font-black text-gray-900 dark:text-white">{parseFloat(result.quality_score).toFixed(1)}%</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500">Score</div>
                    </div>
                  )}
                  {result.grade && (
                    <div className="text-center shrink-0">
                      <div className={`text-2xl font-black ${
                        result.grade.startsWith('A') ? 'text-green-600' :
                        result.grade.startsWith('B') ? 'text-blue-600' :
                        result.grade.startsWith('C') ? 'text-amber-500' : 'text-red-500'
                      }`}>{result.grade}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500">Grade</div>
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{result.summary}"</p>
                  </div>
                </div>

                {result.flagged_items && result.flagged_items.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Flagged Issues ({result.flagged_items.length})</p>
                    <div className="divide-y divide-green-200/50 dark:divide-green-800/30">
                      {result.flagged_items.map((fi: any, idx: number) => (
                        <div key={idx} className="py-2.5 flex items-start gap-3">
                          <AlertTriangle size={14} className={
                            fi.severity === 'critical' ? 'text-red-500 mt-0.5 shrink-0' :
                            fi.severity === 'major' ? 'text-amber-500 mt-0.5 shrink-0' : 'text-blue-500 mt-0.5 shrink-0'
                          } />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">{fi.label}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                fi.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                                fi.severity === 'major' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                              }`}>{fi.severity}</span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Found: <span className="font-medium text-gray-800 dark:text-gray-200">{fi.response}</span></p>
                            {fi.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{fi.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicVerifyPage;
