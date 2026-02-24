import { useState } from "react";
import axios from "axios";
import { User, Lock, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LeaderLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/leader/login`, { email, password });
      const { token, account, leader } = response.data;

      localStorage.setItem("leader_token", token);
      localStorage.setItem("leader_account", JSON.stringify(account));
      localStorage.setItem("leader_info", JSON.stringify(leader));

      toast.success(`Karibu, ${leader?.name || account?.leader_name}!`);
      window.location.href = "/leader/dashboard";
    } catch (error) {
      const message = error.response?.data?.detail || "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-violet-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Gracefy Leaders</h1>
          <p className="text-zinc-400">Portal ya Viongozi wa Dini</p>
        </div>

        {/* Login Form */}
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800 p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Ingia kwenye Akaunti Yako</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Barua Pepe</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="barua@mfano.com"
                  className="pl-11 bg-zinc-950 border-zinc-800 h-12"
                  required
                  data-testid="leader-email-input"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Neno la Siri</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-11 bg-zinc-950 border-zinc-800 h-12"
                  required
                  data-testid="leader-password-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-semibold"
              disabled={loading}
              data-testid="leader-login-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Inaingia...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Ingia <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">
              Huna akaunti?{" "}
              <a href="mailto:support@gracefy.com" className="text-violet-400 hover:underline">
                Wasiliana na Msimamizi
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-zinc-500 text-sm">
          <p>© 2026 Gracefy. Haki zote zimehifadhiwa.</p>
        </div>
      </div>
    </div>
  );
}
