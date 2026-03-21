import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { ChevronLeft, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfServicePage = () => {
  const { language, changeLanguage } = useLanguage();
  const navigate = useNavigate();

  const content = {
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last Updated: March 21, 2026',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: 'By accessing or using Gracefy ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.'
        },
        {
          title: '2. Description of Service',
          content: 'Gracefy is a Christian music streaming platform that provides access to gospel music, teachings, radio stations, and related content. The Service is available through our mobile applications and website.'
        },
        {
          title: '3. User Accounts',
          items: [
            'You must provide accurate and complete information when creating an account',
            'You are responsible for maintaining the security of your account credentials',
            'You must be at least 13 years old to create an account',
            'One person may not maintain more than one account'
          ]
        },
        {
          title: '4. Acceptable Use',
          content: 'You agree NOT to:',
          items: [
            'Copy, distribute, or share content without authorization',
            'Use the Service for any illegal purpose',
            'Attempt to bypass any security measures',
            'Upload harmful or malicious content',
            'Impersonate others or provide false information',
            'Use automated systems to access the Service'
          ]
        },
        {
          title: '5. Content and Intellectual Property',
          content: 'All content on Gracefy, including music, images, and text, is protected by copyright and other intellectual property laws. You may stream content for personal, non-commercial use only. Downloading is permitted only through official app features for offline listening.'
        },
        {
          title: '6. Subscriptions and Payments',
          items: [
            'Some features require a paid subscription',
            'Subscription fees are billed in advance on a recurring basis',
            'You can cancel your subscription at any time',
            'Refunds are handled according to the app store\'s refund policy',
            'We reserve the right to change pricing with reasonable notice'
          ]
        },
        {
          title: '7. Termination',
          content: 'We may suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service will immediately cease. You may also delete your account at any time through the app settings.'
        },
        {
          title: '8. Disclaimer of Warranties',
          content: 'The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service. We are not responsible for any content uploaded by third-party artists or users.'
        },
        {
          title: '9. Limitation of Liability',
          content: 'To the maximum extent permitted by law, Gracefy shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.'
        },
        {
          title: '10. Changes to Terms',
          content: 'We reserve the right to modify these Terms at any time. We will notify users of significant changes. Continued use of the Service after changes constitutes acceptance of the new Terms.'
        },
        {
          title: '11. Contact Information',
          content: 'For questions about these Terms, please contact us at:',
          contact: { email: 'support@gracefy.net', website: 'https://gracefy.net' }
        }
      ],
      footer: 'By using Gracefy, you acknowledge that you have read, understood, and agree to these Terms of Service.'
    },
    sw: {
      title: 'Masharti ya Huduma',
      lastUpdated: 'Imesasishwa: Machi 21, 2026',
      sections: [
        {
          title: '1. Kukubali Masharti',
          content: 'Kwa kufikia au kutumia Gracefy ("Huduma"), unakubali kufungwa na Masharti haya ya Huduma. Ikiwa hukubaliani na masharti haya, tafadhali usitumie Huduma yetu.'
        },
        {
          title: '2. Maelezo ya Huduma',
          content: 'Gracefy ni jukwaa la kusambaza muziki wa Kikristo linalotoa upatikanaji wa muziki wa injili, mafundisho, redio, na maudhui yanayohusiana. Huduma inapatikana kupitia programu zetu za simu na tovuti.'
        },
        {
          title: '3. Akaunti za Watumiaji',
          items: [
            'Lazima utoe taarifa sahihi na kamili unapounda akaunti',
            'Una jukumu la kudumisha usalama wa vithibitisho vya akaunti yako',
            'Lazima uwe na umri wa angalau miaka 13 kuunda akaunti',
            'Mtu mmoja hawezi kuwa na akaunti zaidi ya moja'
          ]
        },
        {
          title: '4. Matumizi Yanayokubalika',
          content: 'Unakubali KUTOFANYA:',
          items: [
            'Kunakili, kusambaza, au kushiriki maudhui bila idhini',
            'Kutumia Huduma kwa madhumuni yoyote haramu',
            'Kujaribu kupita hatua zozote za usalama',
            'Kupakia maudhui ya madhara au ya uhalifu',
            'Kujifanya mtu mwingine au kutoa taarifa za uongo',
            'Kutumia mifumo ya kiotomatiki kufikia Huduma'
          ]
        },
        {
          title: '5. Maudhui na Haki Miliki',
          content: 'Maudhui yote kwenye Gracefy, ikiwemo muziki, picha, na maandishi, yanalindwa na hakimiliki na sheria nyingine za mali ya akili. Unaweza kusambaza maudhui kwa matumizi ya kibinafsi, yasiyo ya kibiashara tu. Kupakua kunaruhusiwa tu kupitia vipengele rasmi vya programu kwa kusikiliza nje ya mtandao.'
        },
        {
          title: '6. Usajili na Malipo',
          items: [
            'Baadhi ya vipengele vinahitaji usajili wa malipo',
            'Ada za usajili zinalipwa mapema kwa msingi wa mara kwa mara',
            'Unaweza kughairi usajili wako wakati wowote',
            'Marejesho yanashughulikiwa kulingana na sera ya duka la programu',
            'Tunahifadhi haki ya kubadilisha bei kwa taarifa ya kutosha'
          ]
        },
        {
          title: '7. Kusitishwa',
          content: 'Tunaweza kusimamisha au kusitisha akaunti yako ikiwa unakiuka Masharti haya. Baada ya kusitishwa, haki yako ya kutumia Huduma itakoma mara moja. Unaweza pia kufuta akaunti yako wakati wowote kupitia mipangilio ya programu.'
        },
        {
          title: '8. Kukataa Dhamana',
          content: 'Huduma inatolewa "kama ilivyo" bila dhamana za aina yoyote. Hatudhamini huduma isiyokatizwa au bila makosa. Hatuwajibiki kwa maudhui yoyote yaliyopakiwa na wasanii au watumiaji wa nje.'
        },
        {
          title: '9. Kikomo cha Dhima',
          content: 'Kwa kiwango cha juu kinachoruhusiwa na sheria, Gracefy haitawajibika kwa uharibifu wowote usio wa moja kwa moja, wa bahati mbaya, maalum, au wa matokeo unaotokana na matumizi yako ya Huduma.'
        },
        {
          title: '10. Mabadiliko ya Masharti',
          content: 'Tunahifadhi haki ya kurekebisha Masharti haya wakati wowote. Tutawajulisha watumiaji kuhusu mabadiliko makubwa. Kuendelea kutumia Huduma baada ya mabadiliko kunajumuisha kukubali Masharti mapya.'
        },
        {
          title: '11. Taarifa za Mawasiliano',
          content: 'Kwa maswali kuhusu Masharti haya, tafadhali wasiliana nasi:',
          contact: { email: 'support@gracefy.net', website: 'https://gracefy.net' }
        }
      ],
      footer: 'Kwa kutumia Gracefy, unakubali kuwa umesoma, kuelewa, na kukubaliana na Masharti haya ya Huduma.'
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
              
              {section.items && (
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

export default TermsOfServicePage;
