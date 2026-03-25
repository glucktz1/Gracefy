import { useEffect, useState } from "react";
import axios from "axios";
import { Wallet, Plus, Edit2, Check, X, Key, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function ChoirAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [singers, setSingers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    choir_id: "",
    email: "",
    password: ""
  });

  const fetchData = async () => {
    try {
      const [accountsRes, singersRes] = await Promise.all([
        axios.get(`${API}/choir/accounts`, { withCredentials: true }),
        axios.get(`${API}/singers`, { withCredentials: true })
      ]);
      setAccounts(accountsRes.data.accounts || []);
      setSingers(singersRes.data.singers || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load choir accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/choir/account/create`, formData, { withCredentials: true });
      toast.success("Choir account created successfully");
      setIsModalOpen(false);
      setFormData({ choir_id: "", email: "", password: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create account");
    }
  };

  const handleStatusChange = async (accountId, newStatus) => {
    try {
      await axios.put(`${API}/choir/account/${accountId}`, { status: newStatus }, { withCredentials: true });
      toast.success(`Account ${newStatus}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update account");
    }
  };

  // Get singers without accounts
  const singersWithoutAccounts = singers.filter(
    singer => !accounts.some(acc => acc.choir_id === singer.singer_id)
  );

  const getStatusBadge = (status) => {
    const styles = {
      approved: "badge-success",
      pending: "badge-warning",
      suspended: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="choir-accounts-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Choir Accounts</h1>
          <p className="page-subtitle">Manage login credentials for choirs to access their revenue dashboard</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          disabled={singersWithoutAccounts.length === 0}
          data-testid="create-choir-account-btn"
        >
          <Plus size={18} className="mr-2" />
          Create Choir Account
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-zinc-900 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Key size={20} className="text-emerald-400 mt-0.5" />
          <div>
            <p className="text-white font-medium">Choir Portal Access</p>
            <p className="text-sm text-zinc-400 mt-1">
              Create accounts for choirs so they can login to view their revenue analytics and request withdrawals.
              Choir login URL: <code className="bg-zinc-800 px-2 py-0.5 rounded text-emerald-400">/choir/login</code>
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <Wallet className="empty-state-icon" />
          <p className="empty-state-title">No choir accounts yet</p>
          <p className="empty-state-text">Create accounts for choirs to access their revenue portal</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.account_id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-semibold text-lg">
                      {account.choir_name?.charAt(0) || "C"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{account.choir_name}</h3>
                      <p className="text-sm text-zinc-500">{account.email}</p>
                    </div>
                  </div>
                  {getStatusBadge(account.status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Current Balance:</span>
                    <span className="text-emerald-400 font-semibold">TZS {(account.current_balance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Total Earned:</span>
                    <span className="text-white">TZS {(account.total_earned || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Total Withdrawn:</span>
                    <span className="text-zinc-400">TZS {(account.total_withdrawn || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-zinc-800">
                  {account.status === "approved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(account.account_id, "suspended")}
                      className="flex-1 border-red-600 text-red-400 hover:bg-red-600/20"
                    >
                      <X size={14} className="mr-1" /> Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(account.account_id, "approved")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Account Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Create Choir Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAccount}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Select Choir</label>
                <Select value={formData.choir_id} onValueChange={(value) => setFormData({ ...formData, choir_id: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select a choir/artist" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {singersWithoutAccounts.map(singer => (
                      <SelectItem key={singer.singer_id} value={singer.singer_id}>
                        {singer.name} ({singer.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {singersWithoutAccounts.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">All choirs already have accounts</p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="choir@email.com"
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create a secure password"
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  minLength={6}
                />
                <p className="text-xs text-zinc-500 mt-1">Share these credentials with the choir securely</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
