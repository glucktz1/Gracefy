import { useEffect, useState, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, NavLink } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

// Pages
import Dashboard from "@/pages/Dashboard";
import UsersPage from "@/pages/UsersPage";
import CategoriesPage from "@/pages/CategoriesPage";
import AlbumsPage from "@/pages/AlbumsPage";
import ChurchesPage from "@/pages/ChurchesPage";
import LeadersPage from "@/pages/LeadersPage";
import SingersPage from "@/pages/SingersPage";
import SeminarsPage from "@/pages/SeminarsPage";
import AudioRoomsPage from "@/pages/AudioRoomsPage";
import DonationsPage from "@/pages/DonationsPage";
import CommunityPage from "@/pages/CommunityPage";
import BookingsPage from "@/pages/BookingsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import LoginPage from "@/pages/LoginPage";
import RevenueAnalyticsPage from "@/pages/RevenueAnalyticsPage";
import ChoirAccountsPage from "@/pages/ChoirAccountsPage";
import WithdrawalsPage from "@/pages/WithdrawalsPage";
import ChoirLoginPage from "@/pages/ChoirLoginPage";
import ChoirDashboard from "@/pages/ChoirDashboard";
import ChoirManagementPage from "@/pages/ChoirManagementPage";
import ChoirDetailsPage from "@/pages/ChoirDetailsPage";
import MonetizationSettingsPage from "@/pages/MonetizationSettingsPage";
import LayoutManagementPage from "@/pages/LayoutManagementPage";
import EnhancedAnalyticsPage from "@/pages/EnhancedAnalyticsPage";
import UserStreamingApp from "@/pages/UserStreamingApp";
import RoleManagementPage from "@/pages/RoleManagementPage";
import SpecialMixesPage from "@/pages/SpecialMixesPage";
import ChurchLeaderLoginPage from "@/pages/ChurchLeaderLoginPage";
import ChurchLeaderDashboard from "@/pages/ChurchLeaderDashboard";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import ChoirRegistrationPage from "@/pages/ChoirRegistrationPage";

// Icons
import { 
  LayoutDashboard, Users, FolderTree, Music2, Church, 
  UserCheck, Mic2, Video, Radio, Heart, MessageSquare,
  CalendarCheck, CheckCircle, LogOut, Menu, X, TrendingUp, Wallet, CreditCard, Settings, Layout, Activity, Shield, Disc
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth context
export const AuthContext = ({ children }) => {
  return children;
};

// Sidebar component with permission-based rendering
const Sidebar = ({ user, userPermissions = [], onLogout, isOpen, setIsOpen }) => {
  // Map each nav item to required permissions
  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: [] }, // Always visible
    { path: "/analytics", icon: Activity, label: "Analytics", permissions: ["view_platform_analytics"] },
    { path: "/revenue", icon: TrendingUp, label: "Revenue", permissions: ["view_all_revenue_reports", "revenue_configuration"] },
    { path: "/monetization", icon: Settings, label: "Monetization", permissions: ["platform_settings", "revenue_configuration"] },
    { path: "/app-settings", icon: Settings, label: "App Settings", permissions: ["platform_settings"] },
    { path: "/roles", icon: Shield, label: "Role Management", permissions: ["role_assignment", "user_management"] },
    { path: "/layout-management", icon: Layout, label: "Layout Management", permissions: ["layout_promotion_control"] },
    { path: "/special-mixes", icon: Disc, label: "Special Mixes", permissions: ["create_albums", "layout_promotion_control"] },
    { path: "/admin/choirs", icon: Mic2, label: "Choir Management", permissions: ["choir_onboarding_approval", "user_management"] },
    { path: "/choir-accounts", icon: Wallet, label: "Choir Accounts", permissions: ["view_all_revenue_reports", "approve_payouts"] },
    { path: "/withdrawals", icon: CreditCard, label: "Withdrawals", permissions: ["approve_payouts"] },
    { path: "/users", icon: Users, label: "Users", permissions: ["user_management"] },
    { path: "/categories", icon: FolderTree, label: "Categories", permissions: ["platform_settings"] },
    { path: "/albums", icon: Music2, label: "Albums & Songs", permissions: ["content_moderation", "content_approval"] },
    { path: "/churches", icon: Church, label: "Churches", permissions: ["platform_settings"] },
    { path: "/leaders", icon: UserCheck, label: "Religious Leaders", permissions: ["user_management"] },
    { path: "/singers", icon: Mic2, label: "Singers & Choirs", permissions: ["user_management"] },
    { path: "/seminars", icon: Video, label: "Live Seminars", permissions: ["platform_settings"] },
    { path: "/audiorooms", icon: Radio, label: "Audio Rooms", permissions: ["platform_settings"] },
    { path: "/donations", icon: Heart, label: "Donations", permissions: ["view_all_revenue_reports"] },
    { path: "/community", icon: MessageSquare, label: "Community", permissions: ["content_moderation"] },
    { path: "/bookings", icon: CalendarCheck, label: "Bookings", permissions: ["platform_settings"] },
    { path: "/approvals", icon: CheckCircle, label: "Approvals", permissions: ["content_approval", "choir_onboarding_approval"] },
  ];

  // Filter nav items based on user permissions
  const filteredNavItems = navItems.filter(item => {
    // Items with no permissions are always visible
    if (!item.permissions || item.permissions.length === 0) return true;
    // Check if user has at least one of the required permissions
    return item.permissions.some(perm => userPermissions.includes(perm));
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
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-violet-500">♱</span> Spirit Songs
              </h1>
              <button 
                className="lg:hidden text-zinc-400 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Admin Dashboard</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {filteredNavItems.map((item) => (
                <li key={item.path}>
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
            navigate("/dashboard", { state: { user: response.data.user }, replace: true });
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
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 z-30 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-zinc-400 hover:text-white"
          data-testid="mobile-menu-btn"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold text-white ml-3 flex items-center gap-2">
          <span className="text-violet-500">♱</span> Spirit Songs
        </h1>
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
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* User Streaming App - Public */}
      <Route path="/app" element={<UserStreamingApp />} />
      
      {/* Admin Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/choir/login" element={<ChoirLoginPage />} />
      <Route path="/choir/dashboard" element={<ChoirDashboard />} />
      <Route path="/church/login" element={<ChurchLeaderLoginPage />} />
      <Route path="/church/dashboard" element={<ChurchLeaderDashboard />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><EnhancedAnalyticsPage /></ProtectedRoute>} />
      <Route path="/revenue" element={<ProtectedRoute><RevenueAnalyticsPage /></ProtectedRoute>} />
      <Route path="/monetization" element={<ProtectedRoute><MonetizationSettingsPage /></ProtectedRoute>} />
      <Route path="/app-settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><RoleManagementPage /></ProtectedRoute>} />
      <Route path="/layout-management" element={<ProtectedRoute><LayoutManagementPage /></ProtectedRoute>} />
      <Route path="/special-mixes" element={<ProtectedRoute><SpecialMixesPage /></ProtectedRoute>} />
      <Route path="/admin/choirs" element={<ProtectedRoute><ChoirManagementPage /></ProtectedRoute>} />
      <Route path="/admin/choirs/:choirId" element={<ProtectedRoute><ChoirDetailsPage /></ProtectedRoute>} />
      <Route path="/choir-accounts" element={<ProtectedRoute><ChoirAccountsPage /></ProtectedRoute>} />
      <Route path="/withdrawals" element={<ProtectedRoute><WithdrawalsPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
      <Route path="/albums" element={<ProtectedRoute><AlbumsPage /></ProtectedRoute>} />
      <Route path="/churches" element={<ProtectedRoute><ChurchesPage /></ProtectedRoute>} />
      <Route path="/leaders" element={<ProtectedRoute><LeadersPage /></ProtectedRoute>} />
      <Route path="/singers" element={<ProtectedRoute><SingersPage /></ProtectedRoute>} />
      <Route path="/seminars" element={<ProtectedRoute><SeminarsPage /></ProtectedRoute>} />
      <Route path="/audiorooms" element={<ProtectedRoute><AudioRoomsPage /></ProtectedRoute>} />
      <Route path="/donations" element={<ProtectedRoute><DonationsPage /></ProtectedRoute>} />
      <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/" element={<LoginPage />} />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
