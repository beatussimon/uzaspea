import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

const TermsAndConditionsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 sm:p-12 prose dark:prose-invert prose-brand max-w-none bg-white dark:bg-neutral-900 rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-4 mb-8 pb-8 border-b dark:border-neutral-800">
          <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-600 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black m-0 text-gray-900 dark:text-white">Terms and Conditions</h1>
            <p className="text-sm text-gray-500 font-bold tracking-wider uppercase mt-2">Effective Date: Upon Acceptance</p>
          </div>
        </div>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">
          <p>
            Welcome to <strong>SakoniMax</strong> (the "Platform"). These Terms and Conditions govern your access to and use of our website, mobile application, and any related services. By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Platform.
          </p>
          <p>
            These Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you," "User," "Customer," or "Seller"), and SakoniMax ("we," "us," or "our"), operating under the laws of the United Republic of Tanzania, including the Electronic Transactions Act (Cap. 442 R.E. 2023) and the Fair Competition Act.
          </p>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">1. Our Role as a Marketplace</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.1 Intermediary Service</h3>
                <p>SakoniMax provides a medium (an online marketplace) for Sellers to list and sell their goods, and for Customers to browse and purchase such goods.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.2 Limitation of Liability regarding Goods</h3>
                <p>We do not own, create, manufacture, sell, resell, or provide any of the goods listed on the Platform. The contract for sale is strictly between the Customer and the Seller. We are not liable for the quality, safety, morality, or legality of any aspect of the items listed, the truth or accuracy of the listings, or the ability of Sellers to sell items.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">2. Customer Obligations</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">2.1 Account Security</h3>
                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">2.2 Reasonable Conduct</h3>
                <p>Customers must act reasonably and in good faith when transacting on the Platform. Fraudulent behavior, including false claims of non-delivery or chargeback abuse, is strictly prohibited and will result in immediate account termination.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">3. Seller Obligations and Liability</h2>
            <p className="mt-4">Sellers on SakoniMax are held to a high standard of professional and ethical conduct.</p>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.1 Strict Liability for Goods</h3>
                <p>The Seller is solely liable for the goods they sell. You may not sell defective, counterfeit, stolen, or otherwise illegal items. You must not mislead the Customer regarding the nature, quality, or origin of the goods.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.2 Compliance with Consumer Protection</h3>
                <p>Sellers must comply with all applicable consumer protection laws in Tanzania, including ensuring goods are fit for purpose and matches the description provided on the Platform.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.3 Indemnification</h3>
                <p>Sellers agree to indemnify and hold harmless SakoniMax from any claims, damages, or legal actions brought by Customers arising from the Seller's goods, actions, or omissions.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">4. Transportation and Delivery Logistics</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">4.1 Delivery Facilitation</h3>
                <p>SakoniMax may facilitate the transportation of goods from the Seller to the Customer.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">4.2 Disclaimer of Transit Liability</h3>
                <p>While we strive to ensure secure and timely delivery, SakoniMax acts solely as a logistical coordinator. Once the Seller hands over the items for transit, we are not liable for loss, damage, or destruction of goods due to accidents, force majeure, or unforeseeable circumstances during transportation. Both Sellers and Customers acknowledge that they assume the risk during transit, subject to any specific insurance options provided at checkout.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">5. Prohibited Activities</h2>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>Violate any laws of the United Republic of Tanzania.</li>
              <li>Post false, inaccurate, misleading, defamatory, or libelous content.</li>
              <li>Distribute viruses or any other technologies that may harm the Platform or its users.</li>
              <li>Harvest or otherwise collect information about users without their consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">6. Limitation of Liability</h2>
            <p className="mt-4">
              To the fullest extent permitted by law, SakoniMax shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the Platform; (b) any conduct or content of any third party on the Platform, including without limitation, any defamatory, offensive or illegal conduct of other users or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">7. Governing Law and Dispute Resolution</h2>
            <p className="mt-4">
              These Terms shall be governed by and construed in accordance with the laws of the United Republic of Tanzania. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Tanzania.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">8. Changes to Terms</h2>
            <p className="mt-4">
              We reserve the right to modify these Terms at any time. We will provide notice of significant changes by posting an update on the Platform. Your continued use of the Platform after changes are posted constitutes your acceptance of the amended Terms.
            </p>
          </section>

          <p className="pt-8 text-sm italic border-t dark:border-neutral-800 text-gray-500">
            For any questions regarding these Terms, please contact us at our Dar es Salaam office.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default TermsAndConditionsPage;
