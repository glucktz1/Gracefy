import { useEffect, useState, useRef, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, NavLink } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { BrandingProvider, useBranding, BrandLogo } from "@/context/BrandingContext";
import AdminNotifications from "@/components/AdminNotifications";

// Loading component for lazy-loaded pages
import { PageLoader } from "@/components/GracefyLoader";

// Critical pages - loaded immediately
import Dashboard from "@/pages/Dashboard";
import LoginPage from "@/pages/LoginPage";
import UserStreamingApp from "@/pages/UserStreamingApp";
import { LanguageProvider } from "@/context/LanguageContext";

// Lazy-loaded pages - loaded on demand
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const AlbumsPage = lazy(() => import("@/pages/AlbumsPage"));
const ChurchesPage = lazy(() => import("@/pages/ChurchesPage"));
const SingersPage = lazy(() => import("@/pages/SingersPage"));
const SeminarsPage = lazy(() => import("@/pages/SeminarsPage"));
const AudioRoomsPage = lazy(() => import("@/pages/AudioRoomsPage"));
const DonationsPage = lazy(() => import("@/pages/DonationsPage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const BookingsPage = lazy(() => import("@/pages/BookingsPage"));
const ApprovalsPage = lazy(() => import("@/pages/ApprovalsPage"));
const TeachingsPage = lazy(() => import("@/pages/TeachingsPage"));
const RevenueAnalyticsPage = lazy(() => import("@/pages/RevenueAnalyticsPage"));
const ChoirAccountsPage = lazy(() => import("@/pages/ChoirAccountsPage"));
const WithdrawalsPage = lazy(() => import("@/pages/WithdrawalsPage"));
const ChoirLoginPage = lazy(() => import("@/pages/ChoirLoginPage"));
const ChoirDashboard = lazy(() => import("@/pages/ChoirDashboard"));
const ChoirManagementPage = lazy(() => import("@/pages/ChoirManagementPage"));
const ChoirDetailsPage = lazy(() => import("@/pages/ChoirDetailsPage"));
const MonetizationSettingsPage = lazy(() => import("@/pages/MonetizationSettingsPage"));
const LayoutManagementPage = lazy(() => import("@/pages/LayoutManagementPage"));
const EnhancedAnalyticsPage = lazy(() => import("@/pages/EnhancedAnalyticsPage"));
const LocationAnalyticsPage = lazy(() => import("@/pages/LocationAnalyticsPage"));
const BrandingSettingsPage = lazy(() => import("@/pages/BrandingSettingsPage"));
const LegalCompliancePage = lazy(() => import("@/pages/LegalCompliancePage"));
const RoleManagementPage = lazy(() => import("@/pages/RoleManagementPage"));
const SpecialMixesPage = lazy(() => import("@/pages/SpecialMixesPage"));
const ChurchLeaderLoginPage = lazy(() => import("@/pages/ChurchLeaderLoginPage"));
const ChurchLeaderDashboard = lazy(() => import("@/pages/ChurchLeaderDashboard"));
const AdminSettingsPage = lazy(() => import("@/pages/AdminSettingsPage"));
const ChoirRegistrationPage = lazy(() => import("@/pages/ChoirRegistrationPage"));
const ContentManagementPage = lazy(() => import("@/pages/ContentManagementPage"));
const SystemSettingsPage = lazy(() => import("@/pages/SystemSettingsPage"));
const BibleManagementPage = lazy(() => import("@/pages/BibleManagementPage"));
const CDNManagementPage = lazy(() => import("@/pages/CDNManagementPage"));
const SongCategoriesPage = lazy(() => import("@/pages/SongCategoriesPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage"));
const AdvertisingPage = lazy(() => import("@/pages/AdvertisingPage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const ChatManagementPage = lazy(() => import("@/pages/ChatManagementPage"));
const KnowledgeBankPage = lazy(() => import("@/pages/KnowledgeBankPage"));
const AppControlPage = lazy(() => import("@/pages/AppControlPage"));
const RecommendationEnginePage = lazy(() => import("@/pages/RecommendationEnginePage"));
const AuthSettingsPage = lazy(() => import("@/pages/AuthSettingsPage"));
const SecuritySettingsPage = lazy(() => import("@/pages/SecuritySettingsPage"));
const RadioManagementPage = lazy(() => import("@/pages/RadioManagementPage"));
const GeoContentPage = lazy(() => import("@/pages/GeoContentPage"));
const ReligiousLeadersPage = lazy(() => import("@/pages/ReligiousLeadersPage"));
const LeaderLoginPage = lazy(() => import("@/pages/LeaderLoginPage"));
const LeaderDashboardPage = lazy(() => import("@/pages/LeaderDashboardPage"));
const SeeAllPage = lazy(() => import("@/pages/SeeAllPage"));

// Icons
import { 
  LayoutDashboard, Users, FolderTree, Music2, Church, 
  Mic2, Video, Radio, Heart, MessageSquare,
  CalendarCheck, CheckCircle, LogOut, Menu, X, TrendingUp, Wallet, CreditCard, Settings, Layout, Activity, Shield, Disc, BookOpen, Globe, Palette, FileText,
  ChevronDown, ChevronRight, UsersRound, BookMarked, Cloud, Tags, Megaphone, MessageCircle, Headphones, Brain, Smartphone, Sparkles, MapPin, Lock
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth context
export const AuthContext = ({ children }) => {
  return children;
};

// Sidebar component with permission-based rendering
const Sidebar = ({ user, userPermissions = [], onLogout, isOpen, setIsOpen }) => {
  const [expandedGroups, setExpandedGroups] = useState(['reports-analytics']); // Default expanded
  
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };
  
  // Map each nav item to required permissions
  // Organized into logical groups
  const navItems = [
    // Reports & Analytics Group
    { 
      groupId: "reports-analytics",
      icon: TrendingUp, 
      label: "Reports & Analytics", 
      permissions: ["view_platform_analytics", "view_all_revenue_reports", "approve_payouts"],
      children: [
        { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: [] },
        { path: "/admin/analytics", icon: Activity, label: "Analytics", permissions: ["view_platform_analytics"] },
        { path: "/admin/analytics/location", icon: MapPin, label: "Location Analytics", permissions: ["view_platform_analytics"] },
        { path: "/admin/revenue", icon: TrendingUp, label: "Revenue", permissions: ["view_all_revenue_reports", "revenue_configuration"] },
        { path: "/admin/transactions", icon: Activity, label: "Transactions", permissions: ["view_all_revenue_reports", "approve_payouts"] },
        { path: "/admin/withdrawals", icon: CreditCard, label: "Withdrawals", permissions: ["approve_payouts"] },
      ]
    },
    // Contents Group (Albums, Songs, Mafundisho, Bible, Special Mixes)
    { 
      groupId: "contents",
      icon: FolderTree, 
      label: "Contents", 
      permissions: ["content_moderation", "content_approval", "create_albums", "platform_settings", "layout_promotion_control"],
      children: [
        { path: "/admin/albums", icon: Music2, label: "Albums & Songs", permissions: ["content_moderation", "content_approval"] },
        { path: "/admin/teachings", icon: BookOpen, label: "Mafundisho", permissions: ["content_moderation", "platform_settings"] },
        { path: "/admin/bible", icon: BookMarked, label: "Biblia na Vitabu", permissions: ["content_moderation", "platform_settings"] },
        { path: "/admin/special-mixes", icon: Disc, label: "Special Mixes", permissions: ["create_albums", "layout_promotion_control"] },
        { path: "/admin/song-categories", icon: Tags, label: "Song Categories", permissions: ["content_moderation", "platform_settings"] },
      ]
    },
    // Control and Management Group (includes App Health Monitoring)
    { 
      groupId: "control-management",
      icon: Shield, 
      label: "Control & Management", 
      permissions: ["role_assignment", "user_management", "content_approval", "choir_onboarding_approval", "layout_promotion_control", "platform_settings"],
      children: [
        { path: "/admin/roles", icon: Shield, label: "Role Management", permissions: ["role_assignment", "user_management"] },
        { path: "/admin/approvals", icon: CheckCircle, label: "Approvals", permissions: ["content_approval", "choir_onboarding_approval"] },
        { path: "/admin/layout-management", icon: Layout, label: "Layout Management", permissions: ["layout_promotion_control"] },
        { path: "/admin/cdn", icon: Cloud, label: "CDN Management", permissions: ["platform_settings"] },
        { path: "/admin/app-health", icon: Smartphone, label: "App Health Monitoring", permissions: ["platform_settings"] },
      ]
    },
    // Settings Group (includes Auth Settings)
    { 
      groupId: "settings",
      icon: Settings, 
      label: "Settings", 
      permissions: ["platform_settings", "revenue_configuration", "role_assignment"],
      children: [
        { path: "/admin/system-settings", icon: Globe, label: "System Settings", permissions: ["platform_settings"] },
        { path: "/admin/app-settings", icon: Settings, label: "App Settings", permissions: ["platform_settings"] },
        { path: "/admin/branding", icon: Palette, label: "Branding", permissions: ["platform_settings"] },
        { path: "/admin/legal", icon: FileText, label: "Legal & Compliance", permissions: ["platform_settings"] },
        { path: "/admin/monetization", icon: CreditCard, label: "Monetization", permissions: ["platform_settings", "revenue_configuration"] },
        { path: "/admin/auth-settings", icon: Shield, label: "Auth Settings", permissions: ["platform_settings", "role_assignment"] },
        { path: "/admin/security", icon: Lock, label: "Security", permissions: [] },
      ]
    },
    // Advertising & Campaigns - Standalone Section
    { path: "/admin/advertising", icon: Megaphone, label: "Advertising & Campaigns", permissions: ["manage_ads", "manage_campaigns", "platform_settings"] },
    // Feedback Manager - Standalone Section
    { path: "/admin/feedback", icon: MessageCircle, label: "Feedback Manager", permissions: ["platform_settings", "content_moderation"] },
    // Chat & Support - Standalone Section
    { path: "/admin/chat-support", icon: Headphones, label: "Chat & Support", permissions: ["platform_settings", "content_moderation"] },
    // Knowledge Bank - AI Support Knowledge Base
    { path: "/admin/knowledge-bank", icon: Brain, label: "Knowledge Bank", permissions: ["platform_settings"] },
    // Recommendation Engine
    { path: "/admin/recommendations", icon: Sparkles, label: "Recommendations", permissions: ["platform_settings"] },
    // Geo-Content Management
    { path: "/admin/geo-content", icon: Globe, label: "Geo Content", permissions: ["platform_settings", "content_moderation"] },
    // Choir and Singers Group
    { 
      groupId: "choir-singers",
      icon: UsersRound, 
      label: "Choir & Singers", 
      permissions: ["choir_onboarding_approval", "user_management", "view_all_revenue_reports", "approve_payouts"],
      children: [
        { path: "/admin/singers", icon: Mic2, label: "Singers & Choirs", permissions: ["user_management"] },
        { path: "/admin/choirs", icon: Users, label: "Choir Management", permissions: ["choir_onboarding_approval", "user_management"] },
        { path: "/admin/choir-accounts", icon: Wallet, label: "Choir Accounts", permissions: ["view_all_revenue_reports", "approve_payouts"] },
      ]
    },
    { 
      groupId: "religious-leaders",
      icon: BookOpen, 
      label: "Religious Leaders", 
      permissions: ["user_management", "content_management"],
      children: [
        { path: "/admin/religious-leaders", icon: Users, label: "Leader Management", permissions: ["user_management"] },
        { path: "/admin/teachings", icon: BookMarked, label: "Teachings (Mafundisho)", permissions: ["content_management"] },
      ]
    },
    // Standalone items
    { path: "/admin/users", icon: Users, label: "App Users", permissions: ["user_management"] },
    { path: "/admin/admin-users", icon: Shield, label: "Admin Users", permissions: ["role_assignment", "user_management"] },
    { path: "/admin/churches", icon: Church, label: "Churches", permissions: ["platform_settings"] },
    { path: "/admin/seminars", icon: Video, label: "Live Seminars", permissions: ["platform_settings"] },
    { path: "/admin/radio", icon: Radio, label: "Live Radio", permissions: ["platform_settings"] },
    { path: "/admin/audiorooms", icon: Radio, label: "Audio Rooms", permissions: ["platform_settings"] },
    { path: "/admin/donations", icon: Heart, label: "Donations", permissions: ["view_all_revenue_reports"] },
    { path: "/admin/community", icon: MessageSquare, label: "Community", permissions: ["content_moderation"] },
    { path: "/admin/bookings", icon: CalendarCheck, label: "Bookings", permissions: ["platform_settings"] },
  ];

  // Filter nav items based on user permissions
  const filterItem = (item) => {
    if (!item.permissions || item.permissions.length === 0) return true;
    return item.permissions.some(perm => userPermissions.includes(perm));
  };
  
  const filteredNavItems = navItems.filter(item => {
    if (item.children) {
      // For grouped items, show if any child is visible
      const visibleChildren = item.children.filter(filterItem);
      return visibleChildren.length > 0;
    }
    return filterItem(item);
  }).map(item => {
    if (item.children) {
      return { ...item, children: item.children.filter(filterItem) };
    }
    return item;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 border-r border-zinc-800 bg-zinc-950/95 backdrop-blur-xl z-50 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo type="icon" className="w-10 h-10 object-contain" alt="Logo" />
                <div>
                  <h1 className="text-xl font-bold text-white">Gracefy</h1>
                  <p className="text-xs text-zinc-500">Admin Dashboard</p>
                </div>
              </div>
              <button 
                className="lg:hidden text-zinc-400 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {filteredNavItems.map((item) => (
                <li key={item.path || item.groupId}>
                  {item.children ? (
                    // Grouped menu item with children
                    <div>
                      <button
                        onClick={() => toggleGroup(item.groupId)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          expandedGroups.includes(item.groupId)
                            ? "bg-violet-600/10 text-violet-400"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon size={18} />
                          {item.label}
                        </div>
                        {expandedGroups.includes(item.groupId) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                      {/* Sub-items */}
                      {expandedGroups.includes(item.groupId) && (
                        <ul className="mt-1 ml-4 space-y-1 border-l border-zinc-800 pl-2">
                          {item.children.map((child) => (
                            <li key={child.path}>
                              <NavLink
                                to={child.path}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isActive
                                      ? "bg-violet-600/20 text-violet-400"
                                      : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
                                  }`
                                }
                              >
                                <child.icon size={16} />
                                {child.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    // Regular menu item
                    <NavLink
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-violet-600/20 text-violet-400 border-l-2 border-violet-500"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                        }`
                      }
                    >
                      <item.icon size={18} />
                      {item.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0) || "A"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || "Admin"}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email || ""}</p>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                data-testid="logout-btn"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// Auth callback component
const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await axios.post(`${API}/auth/session`, { session_id: sessionId }, { withCredentials: true });
          if (response.data.user) {
            // Check if user has admin role
            if (response.data.user.role === 'admin') {
              navigate("/dashboard", { state: { user: response.data.user }, replace: true });
            } else {
              // Non-admin users - redirect to /app with session_id so user app can process it
              // This ensures the user is also created in app_users collection
              navigate(`/app#session_id=${sessionId}`, { replace: true });
            }
          }
        } catch (error) {
          console.error("Auth error:", error);
          navigate("/login", { replace: true });
        }
      } else {
        navigate("/login", { replace: true });
      }
    };

    processAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
    </div>
  );
};

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If user data passed from AuthCallback, use it
    if (location.state?.user) {
      setUser(location.state.user);
      fetchUserPermissions(location.state.user);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
        // Check if user has admin role
        if (response.data.role !== 'admin') {
          // Non-admin users should be redirected to user app
          navigate("/app", { replace: true });
          return;
        }
        setUser(response.data);
        await fetchUserPermissions(response.data);
      } catch (error) {
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location.state]);

  const fetchUserPermissions = async (userData) => {
    try {
      // For admin users, get their role-based permissions
      const userId = userData?.admin_id || userData?.email;
      if (userId) {
        const response = await axios.get(`${API}/rbac/users/${userId}/permissions`, { withCredentials: true });
        setUserPermissions(response.data.permissions || []);
      } else {
        // Default to all permissions for backward compatibility with existing admin users
        setUserPermissions([
          "platform_settings", "role_assignment", "user_management", "choir_onboarding_approval",
          "create_albums", "upload_songs", "content_moderation", "content_approval", "set_content_monetization",
          "view_platform_analytics", "revenue_configuration", "view_all_revenue_reports",
          "approve_payouts", "layout_promotion_control", "access_free_content", "access_premium_content"
        ]);
      }
    } catch (error) {
      console.log("Error fetching permissions, using defaults");
      // Default to all permissions for existing admin users
      setUserPermissions([
        "platform_settings", "role_assignment", "user_management", "choir_onboarding_approval",
        "create_albums", "upload_songs", "content_moderation", "content_approval", "set_content_monetization",
        "view_platform_analytics", "revenue_configuration", "view_all_revenue_reports",
        "approve_payouts", "layout_promotion_control", "access_free_content", "access_premium_content"
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar user={user} userPermissions={userPermissions} onLogout={handleLogout} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 z-30 flex items-center justify-between px-4">
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-white"
            data-testid="mobile-menu-btn"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <BrandLogo type="icon" className="w-8 h-8 object-contain" alt="Logo" />
            <h1 className="text-lg font-bold text-white">Gracefy</h1>
          </div>
        </div>
        <AdminNotifications />
      </div>
      
      {/* Desktop notification bell - top right */}
      <div className="hidden lg:block fixed top-4 right-6 z-30">
        <AdminNotifications />
      </div>
      
      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
};

// App Router
function AppRouter() {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check URL fragment for session_id synchronously during render
  // Only intercept OAuth callback for admin routes, not for /app which handles its own OAuth
  if (location.hash?.includes('session_id=') && !location.pathname.startsWith('/app')) {
    return <AuthCallback />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* User Streaming App - Landing Page (Default) */}
        <Route path="/" element={<UserStreamingApp />} />
        <Route path="/app" element={<UserStreamingApp />} />
        <Route path="/app/see-all/:sectionId" element={<Suspense fallback={<PageLoader />}><SeeAllPage /></Suspense>} />
        
        {/* Public Choir Registration */}
        <Route path="/choir-register" element={<ChoirRegistrationPage />} />
        
        {/* Leader Portal Routes */}
        <Route path="/leader/login" element={<LeaderLoginPage />} />
        <Route path="/leader/dashboard" element={<LeaderDashboardPage />} />
        
        {/* Admin Routes - All under /admin prefix */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute><EnhancedAnalyticsPage /></ProtectedRoute>} />
        <Route path="/admin/analytics/location" element={<ProtectedRoute><LocationAnalyticsPage /></ProtectedRoute>} />
        <Route path="/admin/revenue" element={<ProtectedRoute><RevenueAnalyticsPage /></ProtectedRoute>} />
        <Route path="/admin/monetization" element={<ProtectedRoute><MonetizationSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/app-settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/system-settings" element={<ProtectedRoute><SystemSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/roles" element={<ProtectedRoute><RoleManagementPage /></ProtectedRoute>} />
        <Route path="/admin/layout-management" element={<ProtectedRoute><LayoutManagementPage /></ProtectedRoute>} />
        <Route path="/admin/special-mixes" element={<ProtectedRoute><SpecialMixesPage /></ProtectedRoute>} />
        <Route path="/admin/song-categories" element={<ProtectedRoute><SongCategoriesPage /></ProtectedRoute>} />
        <Route path="/admin/choirs" element={<ProtectedRoute><ChoirManagementPage /></ProtectedRoute>} />
        <Route path="/admin/choirs/:choirId" element={<ProtectedRoute><ChoirDetailsPage /></ProtectedRoute>} />
        <Route path="/admin/leaders" element={<ProtectedRoute><ReligiousLeadersPage /></ProtectedRoute>} />
        <Route path="/admin/religious-leaders" element={<ProtectedRoute><ReligiousLeadersPage /></ProtectedRoute>} />
        <Route path="/admin/choir-accounts" element={<ProtectedRoute><ChoirAccountsPage /></ProtectedRoute>} />
        <Route path="/admin/withdrawals" element={<ProtectedRoute><WithdrawalsPage /></ProtectedRoute>} />
        <Route path="/admin/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/admin/admin-users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/albums" element={<ProtectedRoute><AlbumsPage /></ProtectedRoute>} />
        <Route path="/admin/leader-content" element={<ProtectedRoute><ContentManagementPage /></ProtectedRoute>} />
        <Route path="/admin/bible" element={<ProtectedRoute><BibleManagementPage /></ProtectedRoute>} />
        <Route path="/admin/teachings" element={<ProtectedRoute><TeachingsPage /></ProtectedRoute>} />
        <Route path="/admin/cdn" element={<ProtectedRoute><CDNManagementPage /></ProtectedRoute>} />
        <Route path="/admin/advertising" element={<ProtectedRoute><AdvertisingPage /></ProtectedRoute>} />
        <Route path="/admin/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
        <Route path="/admin/chat-support" element={<ProtectedRoute><ChatManagementPage /></ProtectedRoute>} />
        <Route path="/admin/knowledge-bank" element={<ProtectedRoute><KnowledgeBankPage /></ProtectedRoute>} />
        <Route path="/admin/app-health" element={<ProtectedRoute><AppControlPage /></ProtectedRoute>} />
        <Route path="/admin/recommendations" element={<ProtectedRoute><RecommendationEnginePage /></ProtectedRoute>} />
        <Route path="/admin/geo-content" element={<ProtectedRoute><GeoContentPage /></ProtectedRoute>} />
        <Route path="/admin/auth-settings" element={<ProtectedRoute><AuthSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />
        <Route path="/admin/branding" element={<ProtectedRoute><BrandingSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/legal" element={<ProtectedRoute><LegalCompliancePage /></ProtectedRoute>} />
        <Route path="/admin/churches" element={<ProtectedRoute><ChurchesPage /></ProtectedRoute>} />
        <Route path="/admin/singers" element={<ProtectedRoute><SingersPage /></ProtectedRoute>} />
        <Route path="/admin/seminars" element={<ProtectedRoute><SeminarsPage /></ProtectedRoute>} />
        <Route path="/admin/radio" element={<ProtectedRoute><RadioManagementPage /></ProtectedRoute>} />
        <Route path="/admin/audiorooms" element={<ProtectedRoute><AudioRoomsPage /></ProtectedRoute>} />
        <Route path="/admin/donations" element={<ProtectedRoute><DonationsPage /></ProtectedRoute>} />
        <Route path="/admin/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="/admin/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
        <Route path="/admin/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
        
        {/* Legacy routes - redirect to new /admin paths for backward compatibility */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><EnhancedAnalyticsPage /></ProtectedRoute>} />
        <Route path="/analytics/location" element={<ProtectedRoute><LocationAnalyticsPage /></ProtectedRoute>} />
        <Route path="/revenue" element={<ProtectedRoute><RevenueAnalyticsPage /></ProtectedRoute>} />
        <Route path="/monetization" element={<ProtectedRoute><MonetizationSettingsPage /></ProtectedRoute>} />
        <Route path="/app-settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
        <Route path="/system-settings" element={<ProtectedRoute><SystemSettingsPage /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute><RoleManagementPage /></ProtectedRoute>} />
        <Route path="/layout-management" element={<ProtectedRoute><LayoutManagementPage /></ProtectedRoute>} />
        <Route path="/special-mixes" element={<ProtectedRoute><SpecialMixesPage /></ProtectedRoute>} />
        <Route path="/song-categories" element={<ProtectedRoute><SongCategoriesPage /></ProtectedRoute>} />
        <Route path="/choir-accounts" element={<ProtectedRoute><ChoirAccountsPage /></ProtectedRoute>} />
        <Route path="/withdrawals" element={<ProtectedRoute><WithdrawalsPage /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/albums" element={<ProtectedRoute><AlbumsPage /></ProtectedRoute>} />
        <Route path="/bible" element={<ProtectedRoute><BibleManagementPage /></ProtectedRoute>} />
        <Route path="/teachings" element={<ProtectedRoute><TeachingsPage /></ProtectedRoute>} />
        <Route path="/advertising" element={<ProtectedRoute><AdvertisingPage /></ProtectedRoute>} />
        <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
        <Route path="/chat-support" element={<ProtectedRoute><ChatManagementPage /></ProtectedRoute>} />
        <Route path="/knowledge-bank" element={<ProtectedRoute><KnowledgeBankPage /></ProtectedRoute>} />
        <Route path="/app-health" element={<ProtectedRoute><AppControlPage /></ProtectedRoute>} />
        <Route path="/recommendations" element={<ProtectedRoute><RecommendationEnginePage /></ProtectedRoute>} />
        <Route path="/geo-content" element={<ProtectedRoute><GeoContentPage /></ProtectedRoute>} />
        <Route path="/auth-settings" element={<ProtectedRoute><AuthSettingsPage /></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />
        <Route path="/branding" element={<ProtectedRoute><BrandingSettingsPage /></ProtectedRoute>} />
        <Route path="/legal" element={<ProtectedRoute><LegalCompliancePage /></ProtectedRoute>} />
        <Route path="/churches" element={<ProtectedRoute><ChurchesPage /></ProtectedRoute>} />
        <Route path="/singers" element={<ProtectedRoute><SingersPage /></ProtectedRoute>} />
        <Route path="/seminars" element={<ProtectedRoute><SeminarsPage /></ProtectedRoute>} />
        <Route path="/radio" element={<ProtectedRoute><RadioManagementPage /></ProtectedRoute>} />
        <Route path="/audiorooms" element={<ProtectedRoute><AudioRoomsPage /></ProtectedRoute>} />
        <Route path="/donations" element={<ProtectedRoute><DonationsPage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
        <Route path="/religious-leaders" element={<ProtectedRoute><ReligiousLeadersPage /></ProtectedRoute>} />
        
        {/* Choir Routes */}
        <Route path="/choir/login" element={<ChoirLoginPage />} />
        <Route path="/choir-login" element={<ChoirLoginPage />} />
        <Route path="/choir/dashboard" element={<ChoirDashboard />} />
        <Route path="/church/login" element={<ChurchLeaderLoginPage />} />
        <Route path="/church/dashboard" element={<ChurchLeaderDashboard />} />
        
        {/* Catch-all - redirect to user app */}
        <Route path="*" element={<UserStreamingApp />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <div className="App">
      <BrandingProvider>
        <LanguageProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </LanguageProvider>
      </BrandingProvider>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
