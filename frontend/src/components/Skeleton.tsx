

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700/50 rounded ${className}`}>
    <div className="absolute inset-0 animate-shimmer" />
  </div>
);

export const ProductCardSkeleton = ({ viewMode = 'grid' }: { viewMode?: 'grid' | 'list' }) => {
  if (viewMode === 'list') {
    return (
      <div className="card overflow-hidden flex flex-row items-center p-2 gap-4 border border-surface-border dark:border-surface-dark-border">
        <Skeleton className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-lg" />
        <div className="flex-1 min-w-0 py-1">
          <div className="flex gap-2 mb-2">
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-12 h-3" />
          </div>
          <Skeleton className="w-3/4 h-5 mb-2" />
          <Skeleton className="w-1/2 h-3 mb-4 hidden md:block" />
          <div className="flex items-end justify-between">
            <Skeleton className="w-24 h-6" />
            <Skeleton className="w-16 h-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden flex flex-col h-full bg-white dark:bg-gray-800 border border-surface-border dark:border-surface-dark-border">
      {/* Image box */}
      <Skeleton className="aspect-[4/3] rounded-none" />
      
      {/* Body */}
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex justify-between mb-2">
          <Skeleton className="w-12 h-2.5" />
          <Skeleton className="w-8 h-2.5" />
        </div>
        <Skeleton className="w-full h-4 mb-1.5" />
        <Skeleton className="w-2/3 h-3 mb-4" />
        
        <div className="mt-auto">
          <Skeleton className="w-20 h-5" />
        </div>
        
        {/* Footer */}
        <div className="border-t border-surface-border/40 dark:border-surface-dark-border/40 pt-2.5 mt-2.5 flex justify-between">
          <Skeleton className="w-16 h-2.5" />
          <Skeleton className="w-6 h-2.5" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
