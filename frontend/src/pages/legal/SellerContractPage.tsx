import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase } from 'lucide-react';

const SellerContractPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 sm:p-12 prose dark:prose-invert prose-brand max-w-none bg-white dark:bg-neutral-900 rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-4 mb-8 pb-8 border-b dark:border-neutral-800">
          <div className="w-16 h-16   text-brand-500 rounded-2xl flex items-center justify-center shrink-0">
            <Briefcase size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black m-0 text-gray-900 dark:text-white">Seller Upgrade Agreement</h1>
            <p className="text-sm text-gray-500 font-bold tracking-wider uppercase mt-2">Pro & Business Tiers</p>
          </div>
        </div>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">
          <p>
            This Seller Account Upgrade Agreement ("Agreement") is a legally binding contract entered into by and between SakoniMax ("Platform," "we," "us") and the upgraded seller ("Seller," "you"). By applying for or paying to upgrade your account to a Pro or Business tier, you agree strictly to the following terms.
          </p>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">1. Seller Liability & Ethics</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.1 Strict Product Liability</h3>
                <p>As an upgraded Seller, you are entirely and solely liable for the items you list and sell on the Platform. You must not, under any circumstances, sell goods that are defective, counterfeit, dangerous, or illegal.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.2 Prohibition on Misleading Customers</h3>
                <p>You agree to provide accurate, truthful, and complete descriptions and images of your goods. Misleading the Customer in any way regarding the specifications, origin, condition, or authenticity of a product is a material breach of this Agreement.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.3 Good Faith and Reasonableness</h3>
                <p>You agree to act reasonably and in good faith when dealing with Customers. You must respond to inquiries promptly and attempt to resolve disputes amicably.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">2. Platform Limitations</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">2.1 Medium Only</h3>
                <p>SakoniMax serves exclusively as an intermediary medium for you to reach Customers. We do not endorse your products and are not a party to the actual sales contract between you and the Customer.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">2.2 Indemnity</h3>
                <p>SakoniMax is not liable for any wrongful acts, omissions, or breaches of contract committed by you. You agree to fully indemnify and hold SakoniMax harmless against any claims, losses, or legal actions resulting from your actions as a Seller.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">3. Logistics and Transportation</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.1 Transit Liability Disclaimer</h3>
                <p>If SakoniMax facilitates the transportation of your sold goods to the Customer, our liability is strictly limited. After you have handed over the items to our transportation partners or logistics network, SakoniMax is not liable for the loss, destruction, or damage of goods in the event of accidents or unforeseen circumstances.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.2 Packaging Requirements</h3>
                <p>It is your responsibility as the Seller to pack the goods securely and appropriately to withstand standard transit conditions.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">4. Account Suspension and Termination</h2>
            <p className="mt-4">
              SakoniMax reserves the right to immediately suspend, demote, or terminate your upgraded Seller account without refund if you violate any terms of this Agreement, including but not limited to selling defective goods, misleading customers, or failing to resolve customer disputes reasonably.
            </p>
          </section>

          <div className="mt-12 p-6   rounded-xl border border-brand-500 dark:border-brand-500">
            <h3 className="font-bold text-brand-500 dark:text-brand-500 mb-2">Acknowledgment</h3>
            <p className="text-brand-500 dark:text-brand-500 text-sm">
              By checking the agreement box during the upgrade process, you electronically sign this Agreement and acknowledge that you have read, understood, and agreed to be bound by all its terms.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SellerContractPage;
