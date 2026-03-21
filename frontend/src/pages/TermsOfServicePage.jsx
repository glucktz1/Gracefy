import React from 'react';

const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-2">Terms of Service</h1>
        <p className="text-zinc-400 text-center mb-12">Last Updated: March 21, 2026</p>
        
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">1. Acceptance of Terms</h2>
            <p className="text-zinc-300 leading-relaxed">
              By accessing or using Gracefy ("the Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">2. Description of Service</h2>
            <p className="text-zinc-300 leading-relaxed">
              Gracefy is a Christian music streaming platform that provides access to gospel music, 
              teachings, radio stations, and related content. The Service is available through our 
              mobile applications and website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">3. User Accounts</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must be at least 13 years old to create an account</li>
              <li>One person may not maintain more than one account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">4. Acceptable Use</h2>
            <p className="text-zinc-300 mb-2">You agree NOT to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Copy, distribute, or share content without authorization</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to bypass any security measures</li>
              <li>Upload harmful or malicious content</li>
              <li>Impersonate others or provide false information</li>
              <li>Use automated systems to access the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">5. Content and Intellectual Property</h2>
            <p className="text-zinc-300 leading-relaxed">
              All content on Gracefy, including music, images, and text, is protected by copyright and 
              other intellectual property laws. You may stream content for personal, non-commercial use only. 
              Downloading is permitted only through official app features for offline listening.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">6. Subscriptions and Payments</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Some features require a paid subscription</li>
              <li>Subscription fees are billed in advance on a recurring basis</li>
              <li>You can cancel your subscription at any time</li>
              <li>Refunds are handled according to the app store's refund policy</li>
              <li>We reserve the right to change pricing with reasonable notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">7. Termination</h2>
            <p className="text-zinc-300 leading-relaxed">
              We may suspend or terminate your account if you violate these Terms. Upon termination, 
              your right to use the Service will immediately cease. You may also delete your account 
              at any time through the app settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-zinc-300 leading-relaxed">
              The Service is provided "as is" without warranties of any kind. We do not guarantee 
              uninterrupted or error-free service. We are not responsible for any content uploaded 
              by third-party artists or users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">9. Limitation of Liability</h2>
            <p className="text-zinc-300 leading-relaxed">
              To the maximum extent permitted by law, Gracefy shall not be liable for any indirect, 
              incidental, special, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">10. Changes to Terms</h2>
            <p className="text-zinc-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of 
              significant changes. Continued use of the Service after changes constitutes acceptance 
              of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">11. Contact Information</h2>
            <p className="text-zinc-300 leading-relaxed">
              For questions about these Terms, please contact us at:
            </p>
            <div className="bg-zinc-900 rounded-lg p-4 mt-4">
              <p className="text-zinc-300"><strong>Email:</strong> support@gracefy.net</p>
              <p className="text-zinc-300"><strong>Website:</strong> https://gracefy.net</p>
            </div>
          </section>

          <div className="border-t border-zinc-800 pt-8 mt-8">
            <p className="text-zinc-400 text-center">
              By using Gracefy, you acknowledge that you have read, understood, and agree to these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
