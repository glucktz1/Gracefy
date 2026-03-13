import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useBranding, BrandLogo } from "@/context/BrandingContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loginMethod, setLoginMethod] = useState("email"); // "email" or "google"
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
        if (response.data) {
          // Check if user has admin role
          if (response.data.role === 'admin') {
            navigate("/dashboard", { replace: true });
          } else {
            // Non-admin users should be redirected to user app
            navigate("/app", { replace: true });
          }
        }
      } catch (error) {
        // Not authenticated, show login
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleGoogleLogin = () => {
    // Admin login uses email/password only for security
    toast.info("Admin login requires email and password");
    setLoginMethod("email");
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error("Please enter email");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/admin/users/login`, formData, { 
        withCredentials: true 
      });
      
      if (response.data.token) {
        // Store admin session
        document.cookie = `admin_token=${response.data.token}; path=/; max-age=86400`;
        document.cookie = `admin_email=${formData.email}; path=/; max-age=86400`;
        toast.success("Login successful!");
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 to-zinc-950 pointer-events-none" />
        
        {/* Login card */}
        <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <BrandLogo type="icon" className="w-20 h-20 object-contain" alt="Logo" />
            </div>
            <h1 className="text-2xl font-bold text-white font-[Figtree]">Gracefy</h1>
            <p className="text-zinc-400 text-sm mt-2">Admin Dashboard</p>
          </div>

          {/* Welcome message */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Welcome Back</h2>
            <p className="text-zinc-500 text-sm">
              Sign in to manage your Christian app content, users, and community.
            </p>
          </div>

          {/* Login Method Tabs */}
          <div className="flex mb-6 bg-zinc-800/50 rounded-lg p-1">
            <button
              onClick={() => setLoginMethod("email")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                loginMethod === "email" 
                  ? "bg-violet-600 text-white" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Email
            </button>
            <button
              onClick={() => setLoginMethod("google")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                loginMethod === "google" 
                  ? "bg-violet-600 text-white" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Google
            </button>
          </div>

          {loginMethod === "email" ? (
            /* Email/Password Form */
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
                  data-testid="email-input"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (optional)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6 rounded-xl font-medium transition-all duration-200"
                data-testid="login-btn"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          ) : (
            /* Google Login */
            <Button
              onClick={handleGoogleLogin}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-3"
              data-testid="google-login-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-zinc-600 text-xs">
              By signing in, you agree to manage content responsibly.
            </p>
          </div>
        </div>

        {/* Features preview */}
        <div className="relative mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-violet-400 text-lg mb-1">🎵</div>
            <p className="text-zinc-500 text-xs">Manage Music</p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-emerald-400 text-lg mb-1">⛪</div>
            <p className="text-zinc-500 text-xs">Churches</p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-amber-400 text-lg mb-1">💝</div>
            <p className="text-zinc-500 text-xs">Donations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
