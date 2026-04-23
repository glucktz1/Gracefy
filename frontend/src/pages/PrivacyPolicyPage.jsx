import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/utils/streamingHelpers';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Sera ya Faragha');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await axios.get(`${API}/legal/privacy_policy`);
        const data = res.data;
        setTitle(data.title_sw || data.title || 'Sera ya Faragha');
        setContent(data.content_sw || data.content || '');
      } catch (e) {
        console.error('Failed to fetch privacy policy:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  // Simple markdown to HTML
  const renderMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-6 mb-2 text-white">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-3 text-white">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4 text-white">$1</h1>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4 text-zinc-300">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-zinc-300 mb-3">')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
          <ChevronLeft size={20} />
          <span>Rudi</span>
        </button>

        <h1 className="text-3xl font-bold mb-8">{title}</h1>

        {loading ? (
          <div className="text-zinc-500">Loading...</div>
        ) : content ? (
          <div 
            className="prose prose-invert max-w-none" 
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} 
          />
        ) : (
          <p className="text-zinc-400">Content not available.</p>
        )}
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
