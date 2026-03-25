import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BrandLogo } from "@/context/BrandingContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function ChoirLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/choir/login`, formData, { withCredentials: true });
      const { account, token } = response.data;
      toast.success(`Welcome, ${account.choir_name}!`);
      // Store session token in localStorage as backup
      localStorage.setItem("choir_session", token);
      localStorage.setItem("choir_id", account.choir_id);
      localStorage.setItem("choir_name", account.choir_name);
      navigate("/choir/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 to-zinc-950 pointer-events-none" />
        
        {/* Login card */}
        <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <BrandLogo type="icon" className="w-20 h-20 object-contain" alt="Gracefy" />
            </div>
            <h1 className="text-2xl font-bold text-white font-[Figtree]">Choir Portal</h1>
            <p className="text-zinc-400 text-sm mt-2">Gracefy Revenue Dashboard</p>
          </div>

          {/* Welcome message */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Welcome Back</h2>
            <p className="text-zinc-500 text-sm">
              Sign in to view your revenue analytics and request withdrawals.
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="bg-zinc-950 border-zinc-800 text-white"
                required
                data-testid="choir-email-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="bg-zinc-950 border-zinc-800 text-white"
                required
                data-testid="choir-password-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 rounded-xl font-medium transition-all duration-200"
              data-testid="choir-login-btn"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center space-y-3">
            <p className="text-zinc-400 text-sm">
              New choir?{' '}
              <a href="/choir-register" className="text-emerald-400 hover:text-emerald-300 hover:underline">
                Register here
              </a>
            </p>
            <a href="/login" className="text-violet-400 text-sm hover:text-violet-300 inline-block">
              ← Back to Admin Login
            </a>
          </div>
        </div>

        {/* Features preview */}
        <div className="relative mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-emerald-400 text-lg mb-1">📊</div>
            <p className="text-zinc-500 text-xs">View Analytics</p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-amber-400 text-lg mb-1">💰</div>
            <p className="text-zinc-500 text-xs">Track Revenue</p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-violet-400 text-lg mb-1">💸</div>
            <p className="text-zinc-500 text-xs">Withdraw Funds</p>
          </div>
        </div>
      </div>
    </div>
  );
}
