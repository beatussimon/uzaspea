import React from 'react';
import { motion } from 'framer-motion';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold tracking-wider uppercase mt-1.5">
            SakoniMax • Dar es Salaam, Tanzania
          </p>
        </div>

        <div className="space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed text-gray-700 dark:text-gray-300">
          <p>
            At SakoniMax, accessible via our website and mobile application, the privacy of our visitors and users is of extreme importance to us. This Privacy Policy document outlines the types of personal information that is received and collected by SakoniMax and how it is used.
          </p>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3">
              1. Information We Collect
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">1.1 Personal Data</h3>
                <p className="mt-1">When you register for an account, apply for a Seller Pro/Business Account, or make a purchase, we may collect:</p>
                <ul className="list-disc pl-5 space-y-1.5 mt-2 marker:text-brand-500">
                  <li>Name and Contact Information (Email address, phone number).</li>
                  <li>Billing and Delivery Addresses within Tanzania (e.g., Dar es Salaam).</li>
                  <li>Payment Information (processed securely by third-party gateways).</li>
                  <li>Business details (for sellers).</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">1.2 Usage Data</h3>
                <p className="mt-1">We collect data on how the platform is accessed and used, including your IP address, browser type, device information, and pages visited.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3">
              2. How We Use Your Information
            </h2>
            <p>We use the collected information for various purposes, including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 marker:text-brand-500">
              <li>To provide, maintain, and secure our Platform.</li>
              <li>To facilitate transactions between Customers and Sellers.</li>
              <li>To notify you about changes to our Service.</li>
              <li>To provide customer support and handle disputes.</li>
              <li>To monitor the usage of our Platform.</li>
              <li>To detect, prevent, and address technical issues or fraudulent behavior.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3">
              3. Data Sharing and Disclosure
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">3.1 Between Users</h3>
                <p className="mt-1">To facilitate a transaction or delivery, we share necessary information between the Customer and the Seller (e.g., delivery address, contact number).</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">3.2 Service Providers</h3>
                <p className="mt-1">We may employ third-party companies and individuals in Tanzania or internationally to facilitate our Service (e.g., logistics/transportation partners, payment processors).</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">3.3 Legal Requirements</h3>
                <p className="mt-1">We may disclose your Personal Data if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency in Tanzania).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3">
              4. Data Security
            </h2>
            <p>
              The security of your data is important to us. We implement commercially acceptable means to protect your Personal Data. However, remember that no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3">
              5. Your Privacy Rights
            </h2>
            <p>
              You have the right to access, update, or delete the information we have on you. You can do this directly within your account settings section or by contacting us.
            </p>
          </section>

          <p className="pt-4 text-xs sm:text-sm italic text-gray-500 dark:text-gray-400">
            For questions regarding this Privacy Policy, please contact our support team in Dar es Salaam.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicyPage;
