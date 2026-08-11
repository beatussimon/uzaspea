import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { X, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerId: number;
  sellerUsername: string;
}

const ProductRequestModal: React.FC<ProductRequestModalProps> = ({ isOpen, onClose, sellerId, sellerUsername }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      await api.post('/api/product-requests/', {
        name,
        description,
        seller_id: sellerId
      });
      toast.success(t('request_submitted', 'Your product request has been submitted.'));
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('error_submitting_request', 'Failed to submit request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('request_product', 'Request a Product')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {t('request_product_desc', 'Looking for something specific? Let ')}
            <span className="font-semibold">{sellerUsername}</span>
            {t('request_product_desc2', ' know what you need, and they might add it to their store!')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('product_name', 'Product Name')} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder={t('eg_spark_plug', 'e.g. Toyota Spark Plug')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('additional_details', 'Additional Details (Optional)')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
                placeholder={t('model_number_desc', 'Model numbers, specifications, or specific features...')}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('submitting', 'Submitting...') : t('submit_request', 'Submit Request')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductRequestModal;
