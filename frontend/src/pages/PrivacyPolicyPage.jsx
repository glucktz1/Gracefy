import React from 'react';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-2">Privacy Policy</h1>
        <p className="text-zinc-400 text-center mb-12">Last Updated: March 21, 2026</p>
        
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">1. Introduction</h2>
            <p className="text-zinc-300 leading-relaxed">
              Gracefy ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, and safeguard your information when you use our mobile application 
              and website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-white mb-2">2.1 Information You Provide:</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Account information (email, name) when you register</li>
              <li>Playlist and library preferences</li>
              <li>Payment information for premium subscriptions (processed by secure third-party providers)</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-2">2.2 Automatically Collected Information:</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Device information (device type, operating system)</li>
              <li>Usage data (songs played, features used)</li>
              <li>Log data for app performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-300 mb-2">We use your information to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Provide and improve our music streaming service</li>
              <li>Personalize your listening experience</li>
              <li>Process transactions and subscriptions</li>
              <li>Send important service updates</li>
              <li>Analyze app usage to improve features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">4. Data Sharing</h2>
            <p className="text-zinc-300 mb-2">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Service providers who help operate our app</li>
              <li>Payment processors for subscription handling</li>
              <li>Legal authorities when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">5. Data Security</h2>
            <p className="text-zinc-300 mb-2">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Encrypted data transmission (SSL/TLS)</li>
              <li>Secure data storage</li>
              <li>Regular security audits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">6. Your Rights</h2>
            <p className="text-zinc-300 mb-2">You have the right to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Access your personal data</li>
              <li>Request data deletion</li>
              <li>Opt-out of marketing communications</li>
              <li>Update your account information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">7. Children's Privacy</h2>
            <p className="text-zinc-300 leading-relaxed">
              Gracefy is suitable for all ages. We do not knowingly collect personal information from 
              children under 13 without parental consent. If you believe we have collected information 
              from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">8. Changes to This Policy</h2>
            <p className="text-zinc-300 leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of significant changes 
              through the app or email. Your continued use of Gracefy after changes indicates acceptance 
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-emerald-400 mb-4">9. Contact Us</h2>
            <p className="text-zinc-300 leading-relaxed">
              For privacy-related questions or concerns, contact us at:
            </p>
            <div className="bg-zinc-900 rounded-lg p-4 mt-4">
              <p className="text-zinc-300"><strong>Email:</strong> privacy@gracefy.net</p>
              <p className="text-zinc-300"><strong>Website:</strong> https://gracefy.net</p>
            </div>
          </section>

          <div className="border-t border-zinc-800 pt-8 mt-8">
            <p className="text-zinc-400 text-center">
              By using Gracefy, you agree to this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
