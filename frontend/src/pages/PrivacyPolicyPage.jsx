import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { ChevronLeft, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage = () => {
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const content = {
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last Updated: March 21, 2026',
      sections: [
        {
          title: '1. Introduction',
          content: 'Gracefy ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application and website.'
        },
        {
          title: '2. Information We Collect',
          subsections: [
            {
              title: '2.1 Information You Provide:',
              items: [
                'Account information (email, name) when you register',
                'Playlist and library preferences',
                'Payment information for premium subscriptions (processed by secure third-party providers)'
              ]
            },
            {
              title: '2.2 Automatically Collected Information:',
              items: [
                'Device information (device type, operating system)',
                'Usage data (songs played, features used)',
                'Log data for app performance'
              ]
            }
          ]
        },
        {
          title: '3. How We Use Your Information',
          items: [
            'Provide and improve our music streaming service',
            'Personalize your listening experience',
            'Process transactions and subscriptions',
            'Send important service updates',
            'Analyze app usage to improve features'
          ]
        },
        {
          title: '4. Data Sharing',
          content: 'We do not sell your personal information. We may share data with:',
          items: [
            'Service providers who help operate our app',
            'Payment processors for subscription handling',
            'Legal authorities when required by law'
          ]
        },
        {
          title: '5. Data Security',
          content: 'We implement industry-standard security measures to protect your data, including:',
          items: [
            'Encrypted data transmission (SSL/TLS)',
            'Secure data storage',
            'Regular security audits'
          ]
        },
        {
          title: '6. Your Rights',
          items: [
            'Access your personal data',
            'Request data deletion',
            'Opt-out of marketing communications',
            'Update your account information'
          ]
        },
        {
          title: '7. Children\'s Privacy',
          content: 'Gracefy is suitable for all ages. We do not knowingly collect personal information from children under 13 without parental consent.'
        },
        {
          title: '8. Changes to This Policy',
          content: 'We may update this Privacy Policy periodically. We will notify you of significant changes through the app or email.'
        },
        {
          title: '9. Contact Us',
          content: 'For privacy-related questions, contact us at:',
          contact: { email: 'privacy@gracefy.net', website: 'https://gracefy.net' }
        }
      ],
      footer: 'By using Gracefy, you agree to this Privacy Policy.'
    },
    sw: {
      title: 'Sera ya Faragha',
      lastUpdated: 'Imesasishwa: Machi 21, 2026',
      sections: [
        {
          title: '1. Utangulizi',
          content: 'Gracefy ("sisi" au "yetu") imejitolea kulinda faragha yako. Sera hii ya Faragha inaeleza jinsi tunavyokusanya, kutumia, na kulinda taarifa zako unapotumia programu yetu ya simu na tovuti.'
        },
        {
          title: '2. Taarifa Tunazokusanya',
          subsections: [
            {
              title: '2.1 Taarifa Unazotoa:',
              items: [
                'Taarifa za akaunti (barua pepe, jina) unaposajili',
                'Mapendeleo ya orodha za nyimbo na maktaba',
                'Taarifa za malipo kwa usajili wa premium (zinashughulikiwa na watoa huduma salama wa nje)'
              ]
            },
            {
              title: '2.2 Taarifa Zinazokusanywa Moja kwa Moja:',
              items: [
                'Taarifa za kifaa (aina ya kifaa, mfumo wa uendeshaji)',
                'Data ya matumizi (nyimbo zilizochezwa, vipengele vilivyotumika)',
                'Data ya kumbukumbu kwa utendaji wa programu'
              ]
            }
          ]
        },
        {
          title: '3. Jinsi Tunavyotumia Taarifa Zako',
          items: [
            'Kutoa na kuboresha huduma yetu ya kusambaza muziki',
            'Kubinafsisha uzoefu wako wa kusikiliza',
            'Kushughulikia miamala na usajili',
            'Kutuma sasisho muhimu za huduma',
            'Kuchambua matumizi ya programu kuboresha vipengele'
          ]
        },
        {
          title: '4. Kushiriki Data',
          content: 'Hatuuzi taarifa zako za kibinafsi. Tunaweza kushiriki data na:',
          items: [
            'Watoa huduma wanaosaidia kuendesha programu yetu',
            'Wasindikaji wa malipo kwa kushughulikia usajili',
            'Mamlaka za kisheria zinapohitajika na sheria'
          ]
        },
        {
          title: '5. Usalama wa Data',
          content: 'Tunatekeleza hatua za usalama za kiwango cha sekta kulinda data yako, ikiwemo:',
          items: [
            'Uhamishaji wa data uliosimbwa (SSL/TLS)',
            'Uhifadhi salama wa data',
            'Ukaguzi wa mara kwa mara wa usalama'
          ]
        },
        {
          title: '6. Haki Zako',
          items: [
            'Kupata taarifa zako za kibinafsi',
            'Kuomba kufutwa kwa data',
            'Kujiondoa kwenye mawasiliano ya uuzaji',
            'Kusasisha taarifa za akaunti yako'
          ]
        },
        {
          title: '7. Faragha ya Watoto',
          content: 'Gracefy inafaa kwa umri wote. Hatukusanyi taarifa za kibinafsi kutoka kwa watoto chini ya miaka 13 bila idhini ya mzazi.'
        },
        {
          title: '8. Mabadiliko ya Sera Hii',
          content: 'Tunaweza kusasisha Sera hii ya Faragha mara kwa mara. Tutakujulisha kuhusu mabadiliko makubwa kupitia programu au barua pepe.'
        },
        {
          title: '9. Wasiliana Nasi',
          content: 'Kwa maswali yanayohusiana na faragha, wasiliana nasi:',
          contact: { email: 'privacy@gracefy.net', website: 'https://gracefy.net' }
        }
      ],
      footer: 'Kwa kutumia Gracefy, unakubali Sera hii ya Faragha.'
    }
  };

  const currentContent = content[language] || content.en;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">{currentContent.title}</h1>
          <button 
            onClick={() => changeLanguage(language === 'en' ? 'sw' : 'en')}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
            title={language === 'en' ? 'Badili kwa Kiswahili' : 'Switch to English'}
          >
            <Globe size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-zinc-400 text-center mb-8">{currentContent.lastUpdated}</p>
        
        <div className="space-y-8">
          {currentContent.sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="text-xl font-semibold text-emerald-400 mb-4">{section.title}</h2>
              
              {section.content && (
                <p className="text-zinc-300 leading-relaxed mb-3">{section.content}</p>
              )}
              
              {section.subsections && section.subsections.map((sub, subIdx) => (
                <div key={subIdx} className="mb-4">
                  <h3 className="text-lg font-medium text-white mb-2">{sub.title}</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2">
                    {sub.items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              
              {section.items && !section.subsections && (
                <ul className="list-disc list-inside text-zinc-300 space-y-2">
                  {section.items.map((item, itemIdx) => (
                    <li key={itemIdx}>{item}</li>
                  ))}
                </ul>
              )}
              
              {section.contact && (
                <div className="bg-zinc-900 rounded-lg p-4 mt-4">
                  <p className="text-zinc-300"><strong>Email:</strong> {section.contact.email}</p>
                  <p className="text-zinc-300"><strong>Website:</strong> {section.contact.website}</p>
                </div>
              )}
            </section>
          ))}
        </div>
        
        <div className="border-t border-zinc-800 pt-8 mt-8">
          <p className="text-zinc-400 text-center">{currentContent.footer}</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
