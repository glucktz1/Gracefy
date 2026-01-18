/**
 * Performance Monitoring Utilities
 * Tracks Core Web Vitals and other performance metrics
 */

// Performance thresholds (in ms)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Report performance metrics to backend
 */
async function reportMetric(metric) {
  // Only report in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Performance]', metric.name, metric.value);
    return;
  }
  
  try {
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    await fetch(`${BACKEND_URL}/api/analytics/performance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        url: window.location.pathname,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch (e) {
    // Silently fail - don't break the app for analytics
  }
}

/**
 * Initialize Core Web Vitals monitoring
 */
export function initWebVitals() {
  if (typeof window === 'undefined') return;
  
  // Use PerformanceObserver for modern browsers
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        const value = lastEntry.startTime;
        const rating = value <= THRESHOLDS.LCP.good ? 'good' : 
                       value <= THRESHOLDS.LCP.poor ? 'needs-improvement' : 'poor';
        reportMetric({ name: 'LCP', value, rating });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}
    
    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          const value = entry.processingStart - entry.startTime;
          const rating = value <= THRESHOLDS.FID.good ? 'good' : 
                         value <= THRESHOLDS.FID.poor ? 'needs-improvement' : 'poor';
          reportMetric({ name: 'FID', value, rating });
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {}
    
    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      
      // Report CLS on page unload
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          const rating = clsValue <= THRESHOLDS.CLS.good ? 'good' : 
                         clsValue <= THRESHOLDS.CLS.poor ? 'needs-improvement' : 'poor';
          reportMetric({ name: 'CLS', value: clsValue, rating });
        }
      });
    } catch (e) {}
  }
  
  // Time to First Byte (TTFB)
  if (performance.timing) {
    window.addEventListener('load', () => {
      const ttfb = performance.timing.responseStart - performance.timing.requestStart;
      const rating = ttfb <= THRESHOLDS.TTFB.good ? 'good' : 
                     ttfb <= THRESHOLDS.TTFB.poor ? 'needs-improvement' : 'poor';
      reportMetric({ name: 'TTFB', value: ttfb, rating });
    });
  }
}

/**
 * Track page load time
 */
export function trackPageLoad(pageName) {
  if (typeof window === 'undefined') return;
  
  const startTime = performance.now();
  
  return () => {
    const loadTime = performance.now() - startTime;
    reportMetric({ 
      name: 'PageLoad', 
      value: loadTime, 
      rating: loadTime < 1000 ? 'good' : loadTime < 3000 ? 'needs-improvement' : 'poor',
      page: pageName 
    });
  };
}

/**
 * Track API call performance
 */
export function trackApiCall(endpoint, duration, status) {
  reportMetric({
    name: 'APICall',
    value: duration,
    rating: duration < 200 ? 'good' : duration < 1000 ? 'needs-improvement' : 'poor',
    endpoint,
    status,
  });
}

export default {
  initWebVitals,
  trackPageLoad,
  trackApiCall,
};
