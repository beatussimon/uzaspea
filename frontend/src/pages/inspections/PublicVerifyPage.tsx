import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import inspectionApi from '../../api/inspectionApi';
import { STATUS_LABELS, VERDICT_COLORS, fmtDate } from '../../types/inspection';
import { CardListSkeleton } from '../../components/Skeleton';

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
    <div className="max-w-lg md:max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Header & Search */}
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('verify_inspection', 'Verify Inspection')}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          {t('enter_inspection_id_desc', 'Enter an Inspection ID to verify its authenticity')}
        </p>

        <form onSubmit={handleSearch} className="mt-5 flex items-center gap-2">
          <input
            className="input h-10 text-xs sm:text-sm font-mono tracking-wide"
            placeholder={t('inspection_id_placeholder', 'e.g. OKO-AUT-20240424-00001')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-primary h-10 w-10 p-0 shrink-0 flex items-center justify-center">
            <Search size={16} />
          </button>
        </form>
      </div>

      {loading && (
        <div className="mt-8 max-w-md mx-auto text-left">
          <CardListSkeleton count={1} />
        </div>
      )}

      {searched && !loading && !result && (
        <div className="mt-8 text-center text-red-500 dark:text-red-400 text-xs sm:text-sm font-medium">
          {t('no_inspection_found_id', 'No inspection found with this ID.')}
        </div>
      )}

      {result && (
        <div className="mt-8 sm:mt-10 w-full md:w-fit mx-auto text-left">
          <div className={`grid grid-cols-1 ${hasSecondaryColumn ? 'md:grid-cols-[minmax(360px,auto)_minmax(280px,340px)] md:gap-14 lg:gap-16' : 'max-w-md mx-auto'} gap-7 items-start`}>
            {/* Left Column: Status Header + Core Verification Metadata */}
            <div className="md:min-w-[370px] lg:min-w-[400px]">
              <div className="flex items-center gap-2 mb-5">
                {result.is_verified ? (
                  <CheckCircle size={18} className="text-green-500 shrink-0" />
                ) : (
                  <Clock size={18} className="text-amber-500 shrink-0" />
                )}
                <span className={`text-sm sm:text-base font-bold tracking-tight leading-none ${
                  result.is_verified ? 'text-green-500 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'
                }`}>
                  {result.is_verified
                    ? t('verified_inspection', 'Verified Inspection')
                    : t('inspection_in_progress', 'Inspection In Progress')}
                </span>
              </div>

              <div className="space-y-3 text-xs sm:text-[13px]">
                <div className="flex items-baseline justify-between gap-8 sm:gap-12 leading-none">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('id', 'ID')}</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white text-right break-all">
                    {result.inspection_id}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-8 sm:gap-12">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('category', 'Category')}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">
                    {result.category}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-8 sm:gap-12">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('status', 'Status')}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 capitalize text-right">
                    {STATUS_LABELS[result.status] || result.status?.replace(/_/g, ' ')}
                  </span>
                </div>

                {result.verdict && (
                  <div className="flex items-baseline justify-between gap-8 sm:gap-12">
                    <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('verdict', 'Inspection Verdict')}</span>
                    <span className={`font-bold uppercase tracking-wider text-right ${VERDICT_COLORS[result.verdict] || 'text-gray-900 dark:text-white'}`}>
                      {result.verdict.toUpperCase()}
                    </span>
                  </div>
                )}

                {result.inspected_stock !== null && result.inspected_stock !== undefined && (
                  <div className="flex items-baseline justify-between gap-8 sm:gap-12">
                    <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('inspected_stock', 'Inspected Stock')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-right">
                      {result.inspected_stock} {t('units', 'units')}
                    </span>
                  </div>
                )}

                {result.inspected_at && (
                  <div className="flex items-baseline justify-between gap-8 sm:gap-12">
                    <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('inspected', 'Inspected')}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300 text-right">
                      {fmtDate(result.inspected_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Quality Assessment & Post-Inspection Activity */}
            {hasSecondaryColumn && (
              <div className="space-y-6">
                {/* Quality Score, Grade & Summary */}
                {result.is_verified && (result.quality_score || result.grade || result.summary) && (
                  <div className="space-y-3">
                    {(result.quality_score || result.grade) && (
                      <div className="flex items-start gap-6">
                        {result.quality_score && (
                          <div>
                            <div className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-[0.75]">
                              {parseFloat(result.quality_score).toFixed(1)}%
                            </div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500 mt-2">
                              {t('score', 'Score')}
                            </div>
                          </div>
                        )}
                        {result.grade && (
                          <div>
                            <div className={`text-2xl sm:text-3xl font-black tracking-tight leading-[0.75] ${
                              result.grade.startsWith('A') ? 'text-green-500 dark:text-green-400' :
                              result.grade.startsWith('B') ? 'text-blue-500 dark:text-blue-400' :
                              result.grade.startsWith('C') ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
                            }`}>
                              {result.grade}
                            </div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500 mt-2">
                              {t('grade', 'Grade')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {result.summary && (
                      <p className="text-xs sm:text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                        {result.summary}
                      </p>
                    )}
                  </div>
                )}

                {/* Flagged Issues */}
                {result.flagged_items && result.flagged_items.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      {t('flagged_issues', 'Flagged Issues ({{count}})', { count: result.flagged_items.length })}
                    </div>
                    <div className="space-y-2">
                      {result.flagged_items.map((fi: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs">
                          <AlertTriangle size={14} className={
                            fi.severity === 'critical' ? 'text-red-500 mt-0.5 shrink-0' :
                            fi.severity === 'major' ? 'text-amber-500 mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0'
                          } />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white">{fi.label}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">
                                {fi.severity}
                              </span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                              {t('found', 'Found:')} <span className="font-medium text-gray-800 dark:text-gray-200">{fi.response}</span>
                            </p>
                            {fi.notes && <p className="text-gray-500 dark:text-gray-400 mt-0.5">{fi.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post-Inspection Activity Notice */}
                {result.has_post_inspection_changes && result.post_inspection_events && result.post_inspection_events.length > 0 ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs sm:text-[13px] font-semibold text-gray-900 dark:text-white">
                        {t('activity_after_inspection', 'Activity Recorded After Inspection ({{count}})', { count: result.post_inspection_events.length })}
                      </div>
                      <p className="text-2xs sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('stock_updated_after_cert', 'Stock or details were updated after this inspection certificate was issued:')}
                      </p>
                    </div>
                    <div className="space-y-2 pt-0.5">
                      {result.post_inspection_events.map((ev: any, idx: number) => (
                        <div key={idx} className="text-xs sm:text-[13px]">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{ev.title}</span>
                            <span className="text-2xs sm:text-xs text-gray-400 dark:text-gray-500 shrink-0">
                              {fmtDate(ev.created_at)}
                            </span>
                          </div>
                          {ev.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicVerifyPage;
