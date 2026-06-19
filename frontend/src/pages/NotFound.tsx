import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-[#f59e0b]/20 blur-2xl rounded-full w-24 h-24 mx-auto animate-pulse" />
        <div className="relative w-20 h-20 bg-gray-100 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/5 text-[#f59e0b] rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(245,158,11,0.1)]">
          <ShieldAlert size={40} />
        </div>
      </div>
      <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Page Not Found</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-8">
        The page you are looking for does not exist, has been removed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black uppercase tracking-wider text-xs rounded-xl transition shadow-[0_0_30px_rgba(245,158,11,0.2)] active:scale-95 duration-200"
      >
        Go back home
      </Link>
    </div>
  );
};

export default NotFound;
