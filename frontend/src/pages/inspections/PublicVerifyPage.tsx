import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import inspectionApi from '../../api/inspectionApi';
import { STATUS_COLORS, VERDICT_COLORS, fmtDate } from '../../types/inspection';
import { CardListSkeleton } from '../../components/Skeleton';

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {text}
  </span>
);

const PublicVerifyPage: React.FC = () => {
  const { t } = useTranslation();
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

  const hasSecondaryColumn = Boolean(
    result && (
      (result.has_post_inspection_changes && result.post_inspection_events?.length > 0) ||
      (result.is_verified && (result.summary || result.quality_score || result.grade)) ||
      (result.flagged_items?.length > 0)
    )
  );

  return (
    <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto py-8 sm:py-10 px-4">
      <div className="text-center">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('verify_inspection', 'Verify Inspection')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('enter_inspection_id_desc', 'Enter an Inspection ID to verify its authenticity')}
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              className="input"
              placeholder={t('inspection_id_placeholder', 'e.g. OKO-AUT-20240424-00001')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary px-4 py-2 shrink-0">
              <Search size={16} />
            </button>
          </form>
        </div>

        {loading && <div className="mt-6 text-left"><CardListSkeleton count={1} /></div>}

        {searched && !loading && !result && (
          <div className="mt-6 p-4 rounded-lg text-red-500 dark:text-red-500 text-sm">
            {t('no_inspection_found_id', 'No inspection found with this ID.')}
          </div>
        )}

        {result && (
          <div className="mt-6 p-5 sm:p-6 rounded-xl text-left">
            <div className="flex items-center gap-2 mb-4">
              {result.is_verified
                ? <CheckCircle size={20} className="text-green-500 shrink-0" />
                : <Clock size={20} className="text-yellow-500 shrink-0" />}
              <span className={`font-bold ${result.is_verified ? 'text-green-500 dark:text-green-500' : 'text-yellow-500 dark:text-yellow-500'}`}>
                {result.is_verified ? t('verified_inspection', 'Verified Inspection') : t('inspection_in_progress', 'Inspection In Progress')}
              </span>
            </div>

            <div className={`grid grid-cols-1 ${hasSecondaryColumn ? 'md:grid-cols-2 md:gap-8' : ''} gap-5 items-start`}>
              {/* Left Column: Core Verification Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{t('id', 'ID')}</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white text-right break-all">{result.inspection_id}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{t('category', 'Category')}</span>
                  <span className="text-gray-700 dark:text-gray-300 text-right">{result.category}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{t('status', 'Status')}</span>
                  <Badge text={result.status} className={STATUS_COLORS[result.status] || 'text-gray-500 dark:text-gray-400'} />
                </div>
                {result.verdict && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 shrink-0">{t('verdict', 'Verdict')}</span>
                    <Badge text={result.verdict.toUpperCase()} className={VERDICT_COLORS[result.verdict]} />
                  </div>
                )}
                {result.report_hash && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 shrink-0">{t('report_hash', 'Report Hash')}</span>
                    <span className="font-mono text-xs text-gray-400 text-right">{result.report_hash.slice(0, 20)}…</span>
                  </div>
                )}
                {result.inspected_stock !== null && result.inspected_stock !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 shrink-0">{t('inspected_stock', 'Inspected Stock')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-right">{result.inspected_stock} {t('units', 'units')}</span>
                  </div>
                )}
                {result.inspected_at && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 shrink-0">{t('inspected', 'Inspected')}</span>
                    <span className="text-gray-700 dark:text-gray-300 text-right">{fmtDate(result.inspected_at)}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Post-Inspection Activity & Quality Report Summary */}
              {hasSecondaryColumn && (
                <div className="space-y-5">
                  {/* Post-Inspection Activity Notice */}
                  {result.has_post_inspection_changes && result.post_inspection_events && result.post_inspection_events.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('activity_after_inspection', 'Activity Recorded After Inspection ({{count}})', { count: result.post_inspection_events.length })}
                      </div>
                      <p className="text-2xs text-gray-500 dark:text-gray-400">
                        {t('stock_updated_after_cert', 'Stock or details were updated after this inspection certificate was issued:')}
                      </p>
                      <div className="space-y-1.5">
                        {result.post_inspection_events.map((ev: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800/50 text-xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{ev.title}</span>
                              <span className="text-2xs text-gray-400">
                                {fmtDate(ev.created_at)}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Render full report if verified */}
                  {result.is_verified && result.summary && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        {result.quality_score && (
                          <div className="text-center shrink-0">
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{parseFloat(result.quality_score).toFixed(1)}%</div>
                            <div className="text-[10px] uppercase font-bold text-gray-500">{t('score', 'Score')}</div>
                          </div>
                        )}
                        {result.grade && (
                          <div className="text-center shrink-0">
                            <div className={`text-2xl font-black ${
                              result.grade.startsWith('A') ? 'text-green-500' :
                              result.grade.startsWith('B') ? 'text-blue-500' :
                              result.grade.startsWith('C') ? 'text-amber-500' : 'text-red-500'
                            }`}>{result.grade}</div>
                            <div className="text-[10px] uppercase font-bold text-gray-500">{t('grade', 'Grade')}</div>
                          </div>
                        )}
                        <div className="flex-1 min-w-[160px]">
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{result.summary}"</p>
                        </div>
                      </div>

                      {result.flagged_items && result.flagged_items.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('flagged_issues', 'Flagged Issues ({{count}})', { count: result.flagged_items.length })}
                          </p>
                          <div className="space-y-2">
                            {result.flagged_items.map((fi: any, idx: number) => (
                              <div key={idx} className="py-1.5 flex items-start gap-3">
                                <AlertTriangle size={14} className={
                                  fi.severity === 'critical' ? 'text-red-500 mt-0.5 shrink-0' :
                                  fi.severity === 'major' ? 'text-amber-500 mt-0.5 shrink-0' : 'text-blue-500 mt-0.5 shrink-0'
                                } />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm text-gray-900 dark:text-white">{fi.label}</span>
                                    <span className="text-[9px] font-bold uppercase text-gray-400 dark:text-gray-500">
                                      {fi.severity}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {t('found', 'Found:')} <span className="font-medium text-gray-800 dark:text-gray-200">{fi.response}</span>
                                  </p>
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
        )}
      </div>
    </div>
  );
};

export default PublicVerifyPage;
