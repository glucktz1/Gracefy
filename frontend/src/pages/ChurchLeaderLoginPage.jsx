import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Church, Mail, Lock, User, Phone } from "lucide-react";
import { BrandLogo } from "@/context/BrandingContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function ChurchLeaderLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    church_id: "",
    name: "",
    email: "",
    password: "",
    phone: ""
  });
  const [churches, setChurches] = useState([]);
  const [loadingChurches, setLoadingChurches] = useState(false);

  const fetchChurches = async () => {
    if (churches.length > 0) return;
    setLoadingChurches(true);
    try {
      const response = await axios.get(`${API}/churches?status=approved`);
      setChurches(response.data.churches || []);
    } catch (error) {
      console.error("Error fetching churches:", error);
    } finally {
      setLoadingChurches(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/church-leader/login`, loginForm, { withCredentials: true });
      toast.success(`Welcome, ${response.data.name}!`);
      localStorage.setItem("church_leader_session", response.data.session_token);
      localStorage.setItem("church_id", response.data.church_id);
      localStorage.setItem("church_name", response.data.church_name);
      localStorage.setItem("church_leader_name", response.data.name);
      navigate("/church/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/church-leader/register`, registerForm);
      toast.success("Registration submitted! Awaiting admin approval.");
      setActiveTab("login");
      setRegisterForm({ church_id: "", name: "", email: "", password: "", phone: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 to-zinc-950 pointer-events-none" />
        
        {/* Login/Register card */}
        <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <BrandLogo type="icon" className="w-16 h-16 object-contain" alt="Gracefy" />
            </div>
            <h1 className="text-2xl font-bold text-white font-[Figtree]">Church Portal</h1>
            <p className="text-zinc-400 text-sm mt-2">Manage announcements & church info</p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "register") fetchChurches(); }}>
            <TabsList className="w-full bg-zinc-800 mb-6">
              <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-violet-600">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-violet-600">Register</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      placeholder="your@email.com"
                      className="bg-zinc-950 border-zinc-800 text-white pl-10"
                      required
                      data-testid="church-leader-email-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="bg-zinc-950 border-zinc-800 text-white pl-10"
                      required
                      data-testid="church-leader-password-input"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6 rounded-xl font-medium transition-all duration-200"
                  data-testid="church-leader-login-btn"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Select Church *</label>
                  <select
                    value={registerForm.church_id}
                    onChange={(e) => setRegisterForm({ ...registerForm, church_id: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Select your church...</option>
                    {loadingChurches ? (
                      <option disabled>Loading churches...</option>
                    ) : (
                      churches.map((c) => (
                        <option key={c.church_id} value={c.church_id}>{c.name} - {c.location}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Your Name *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="text"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      placeholder="Fr. John Doe"
                      className="bg-zinc-950 border-zinc-800 text-white pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Email *</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder="your@email.com"
                      className="bg-zinc-950 border-zinc-800 text-white pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Phone</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="tel"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      placeholder="+255 xxx xxx xxx"
                      className="bg-zinc-950 border-zinc-800 text-white pl-10"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Password *</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      placeholder="Create a password"
                      className="bg-zinc-950 border-zinc-800 text-white pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6 rounded-xl font-medium"
                  data-testid="church-leader-register-btn"
                >
                  {loading ? "Registering..." : "Submit Registration"}
                </Button>
                <p className="text-xs text-zinc-500 text-center">
                  Registration requires admin approval
                </p>
              </form>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="mt-8 text-center">
            <Link to="/login" className="text-violet-400 text-sm hover:text-violet-300">
              ← Back to Admin Login
            </Link>
            <span className="mx-3 text-zinc-700">|</span>
            <Link to="/choir/login" className="text-emerald-400 text-sm hover:text-emerald-300">
              Choir Portal →
            </Link>
          </div>
        </div>

        {/* Features preview */}
        <div className="relative mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-violet-400 text-lg mb-1">📢</div>
            <p className="text-zinc-500 text-xs">Announcements</p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-amber-400 text-lg mb-1">📅</div>
            <p className="text-zinc-500 text-xs">Mass Schedule</p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-emerald-400 text-lg mb-1">👥</div>
            <p className="text-zinc-500 text-xs">Followers</p>
          </div>
        </div>
      </div>
    </div>
  );
}
