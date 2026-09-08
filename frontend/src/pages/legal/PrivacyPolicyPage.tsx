import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 sm:p-12 prose dark:prose-invert prose-brand max-w-none bg-white dark:bg-neutral-900 rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-4 mb-8 pb-8 border-b dark:border-neutral-800">
          <div className="w-16 h-16   text-brand-500 rounded-2xl flex items-center justify-center shrink-0">
            <Lock size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black m-0 text-gray-900 dark:text-white">Privacy Policy</h1>
            <p className="text-sm text-gray-500 font-bold tracking-wider uppercase mt-2">SakoniMax • Dar es Salaam, Tanzania</p>
          </div>
        </div>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">
          <p>
            At SakoniMax, accessible via our website and mobile application, the privacy of our visitors and users is of extreme importance to us. This Privacy Policy document outlines the types of personal information that is received and collected by SakoniMax and how it is used.
          </p>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">1. Information We Collect</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.1 Personal Data</h3>
                <p>When you register for an account, apply for a Seller Pro/Business Account, or make a purchase, we may collect:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Name and Contact Information (Email address, phone number).</li>
                  <li>Billing and Delivery Addresses within Tanzania (e.g., Dar es Salaam).</li>
                  <li>Payment Information (processed securely by third-party gateways).</li>
                  <li>Business details (for sellers).</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">1.2 Usage Data</h3>
                <p>We collect data on how the platform is accessed and used, including your IP address, browser type, device information, and pages visited.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">2. How We Use Your Information</h2>
            <p className="mt-4">We use the collected information for various purposes, including:</p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>To provide, maintain, and secure our Platform.</li>
              <li>To facilitate transactions between Customers and Sellers.</li>
              <li>To notify you about changes to our Service.</li>
              <li>To provide customer support and handle disputes.</li>
              <li>To monitor the usage of our Platform.</li>
              <li>To detect, prevent, and address technical issues or fraudulent behavior.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">3. Data Sharing and Disclosure</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.1 Between Users</h3>
                <p>To facilitate a transaction or delivery, we share necessary information between the Customer and the Seller (e.g., delivery address, contact number).</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.2 Service Providers</h3>
                <p>We may employ third-party companies and individuals in Tanzania or internationally to facilitate our Service (e.g., logistics/transportation partners, payment processors).</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">3.3 Legal Requirements</h3>
                <p>We may disclose your Personal Data if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency in Tanzania).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">4. Data Security</h2>
            <p className="mt-4">
              The security of your data is important to us. We implement commercially acceptable means to protect your Personal Data. However, remember that no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-neutral-800">5. Your Privacy Rights</h2>
            <p className="mt-4">
              You have the right to access, update, or delete the information we have on you. You can do this directly within your account settings section or by contacting us.
            </p>
          </section>

          <p className="pt-8 text-sm italic border-t dark:border-neutral-800 text-gray-500">
            For questions regarding this Privacy Policy, please contact our support team in Dar es Salaam.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicyPage;
