import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const GlobalTermsModal: React.FC = () => {
  const { user, isAuthenticated, logout, acceptTerms } = useAuth();
  const [loading, setLoading] = useState(false);

  // If not authenticated, or if terms are already accepted, don't show the modal
  if (!isAuthenticated || !user || user.terms_accepted) {
    return null;
  }

  const handleAccept = async () => {
    try {
      setLoading(true);
      await api.post('/api/auth/accept-terms/');
      acceptTerms(); // Update local context state
      toast.success('Thank you for accepting the Terms and Conditions.');
    } catch (error) {
      toast.error('Failed to accept terms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    logout();
    toast('You must accept the terms to continue using the platform.', { icon: 'ℹ️' });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
        >
          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16   text-brand-500 rounded-full flex items-center justify-center">
                <ShieldCheck size={32} />
              </div>
            </div>
            
            <h2 className="text-2xl font-black text-center text-gray-900 dark:text-white mb-4">Updated Terms & Privacy Policy</h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              Welcome back to SakoniMax! We've updated our Terms and Conditions and Privacy Policy. To continue using the platform, please review and accept our updated terms.
            </p>

            <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-6 text-sm text-gray-700 dark:text-gray-300 space-y-4 mb-8">
              <p>
                <strong>Key Highlights:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Clearer Seller Rules:</strong> Sellers are strictly liable for the items they sell and must not mislead customers.</li>
                <li><strong>Logistics Disclaimer:</strong> While we coordinate delivery, we are an intermediary; risk during transit is clearly outlined.</li>
                <li><strong>Data Privacy:</strong> We've clarified exactly what data we collect (like your delivery address in Dar es Salaam) and how it's securely used.</li>
              </ul>
              <p className="mt-4">
                You can read the full documents here:
              </p>
              <div className="flex gap-4 font-semibold text-brand-500 dark:text-brand-500">
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms and Conditions</a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-gray-50 dark:bg-neutral-800/50 border-t dark:border-neutral-800 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleDecline}
              disabled={loading}
              className="flex-1 btn bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700"
            >
              <LogOut size={18} className="mr-2" />
              Decline & Logout
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 btn btn-primary py-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'I Agree, Continue'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GlobalTermsModal;
