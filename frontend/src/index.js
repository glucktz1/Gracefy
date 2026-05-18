import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "@/index.css";
import App from "@/App";

// ============================================================
// PRODUCTION WORKAROUND: Force same-origin API calls on gracefy.net
//
// Emergent's build pipeline bakes REACT_APP_BACKEND_URL=https://www.gracefy.net
// into the production bundle, but the site is served from https://gracefy.net.
// Cloudflare 308-redirects www → non-www, which strips POST bodies + cookies
// and breaks admin login and monetization.
//
// This interceptor rewrites any www.gracefy.net request to the current origin
// so all API calls stay on the same host the user is on. No env var needed.
// ============================================================
axios.interceptors.request.use((config) => {
  try {
    if (typeof window !== 'undefined' && config.url) {
      const currentHost = window.location.host; // e.g. "gracefy.net"
      // Rewrite full URLs that don't match the current host
      // (only rewrite if the host is a www-variant of the current host)
      if (/^https?:\/\//i.test(config.url)) {
        const u = new URL(config.url);
        // If request goes to www.<currentHost> but user is on <currentHost> (or vice versa),
        // rewrite to the user's actual host to avoid the cross-origin redirect.
        const stripped = u.host.replace(/^www\./, '');
        const userStripped = currentHost.replace(/^www\./, '');
        if (stripped === userStripped && u.host !== currentHost) {
          u.host = currentHost;
          u.protocol = window.location.protocol;
          config.url = u.toString();
        }
      }
    }
  } catch (_) { /* never break a request because of this */ }
  return config;
}, (error) => Promise.reject(error));

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
