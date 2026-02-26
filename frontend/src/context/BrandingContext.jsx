import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const defaultBranding = {
  app_name: 'Gracefy',
  tagline: 'Christian Music Streaming',
  logo_url: '/gracefy-icon.png',
  logo_with_text_url: '/gracefy-logo-dark.png',
  favicon_url: '/favicon.ico',
  primary_color: '#8b5cf6',
  secondary_color: '#06b6d4',
  theme: 'dark'
};

const BrandingContext = createContext({
  branding: defaultBranding,
  loading: true,
  refresh: () => {}
});

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(defaultBranding);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/branding`);
      setBranding(res.data);
      
      // Update favicon dynamically
      if (res.data.favicon_url) {
        const link = document.querySelector("link[rel~='icon']");
        if (link) {
          link.href = res.data.favicon_url.startsWith('http') 
            ? res.data.favicon_url 
            : res.data.favicon_url;
        }
      }
      
      // Update document title
      if (res.data.app_name) {
        document.title = res.data.app_name;
      }
    } catch (error) {
      console.error('Failed to fetch branding:', error);
      setBranding(defaultBranding);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const getLogoUrl = (type = 'icon') => {
    const url = type === 'full' ? branding.logo_with_text_url : branding.logo_url;
    if (!url) return type === 'full' ? '/gracefy-logo-dark.png' : '/gracefy-icon.png';
    return url;
  };

  return (
    <BrandingContext.Provider value={{ 
      branding, 
      loading, 
      refresh: fetchBranding,
      getLogoUrl,
      logoUrl: branding.logo_url || '/gracefy-icon.png',
      fullLogoUrl: branding.logo_with_text_url || '/gracefy-logo-dark.png',
      appName: branding.app_name || 'Gracefy'
    }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

// Simple logo component that auto-updates from branding
export function BrandLogo({ type = 'icon', className = '', alt = 'Logo' }) {
  const { getLogoUrl, loading } = useBranding();
  
  if (loading) {
    return <div className={`bg-zinc-800 animate-pulse rounded ${className}`} />;
  }
  
  return (
    <img 
      src={getLogoUrl(type)} 
      alt={alt}
      className={className}
      onError={(e) => {
        e.target.src = type === 'full' ? '/gracefy-logo-dark.png' : '/gracefy-icon.png';
      }}
    />
  );
}

export default BrandingContext;
