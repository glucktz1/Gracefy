import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  CreditCard, Search, Download, RefreshCw, Filter, Calendar,
  CheckCircle, XCircle, Clock, AlertCircle, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Gateway logos
const GATEWAY_LOGOS = {
  azampay: "https://azampay.com/images/azampay-logo.svg",
  mpesa: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/M-PESA_LOGO-01.svg/512px-M-PESA_LOGO-01.svg.png",
  tigopesa: "https://www.tigo.co.tz/sites/default/files/2020-01/tigo-pesa-logo.png",
  airtel: "https://www.airtel.co.tz/assets/images/airtel-money-logo.png",
  halopesa: "https://www.hfrbank.co.tz/assets/images/halopesa-logo.png",
  stripe: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/512px-Stripe_Logo%2C_revised_2016.svg.png",
  paypal: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/512px-PayPal.svg.png",
};

const STATUS_COLORS = {
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  refunded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const STATUS_ICONS = {
  completed: CheckCircle,
  pending: Clock,
  processing: RefreshCw,
  failed: XCircle,
  refunded: AlertCircle,
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({});
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (gatewayFilter) params.append("gateway", gatewayFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      params.append("skip", page * limit);
      params.append("limit", limit);

      const response = await axios.get(`${API}/admin/transactions?${params}`, { withCredentials: true });
      setTransactions(response.data.transactions || []);
      setStats(response.data.stats || {});
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, gatewayFilter, startDate, endDate, page]);

  const fetchGateways = async () => {
    try {
      const response = await axios.get(`${API}/admin/payment/gateways`, { withCredentials: true });
      setGateways(response.data.gateways || []);
    } catch (error) {
      console.error("Error fetching gateways:", error);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleExport = async (format = "csv") => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (gatewayFilter) params.append("gateway", gatewayFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      params.append("format", format);

      const response = await axios.get(`${API}/admin/transactions/export?${params}`, { 
        withCredentials: true,
        responseType: format === "csv" ? "blob" : "json"
      });

      if (format === "csv") {
        const blob = new Blob([response.data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Transactions exported");
      } else {
        console.log("Export data:", response.data);
        toast.success(`Exported ${response.data.count} transactions`);
      }
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const filteredTransactions = transactions.filter(txn => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      txn.transaction_id?.toLowerCase().includes(query) ||
      txn.user_email?.toLowerCase().includes(query) ||
      txn.phone_number?.includes(query) ||
      txn.external_ref?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount, currency) => {
    if (!amount) return "-";
    return `${currency || "TZS"} ${amount.toLocaleString()}`;
  };

  // Calculate summary stats
  const totalCompleted = stats.completed?.total || 0;
  const totalPending = stats.pending?.total || 0;
  const totalFailed = stats.failed?.total || 0;

  return (
    <div className="p-6 space-y-6" data-testid="transactions-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="text-emerald-400" /> Transactions
          </h1>
          <p className="text-zinc-400 mt-1">Monitor and manage payment transactions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => fetchTransactions()} 
            variant="outline" 
            className="border-zinc-700 text-zinc-300"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> 
            Refresh
          </Button>
          <Button 
            onClick={() => handleExport("csv")} 
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={exporting}
          >
            <Download size={16} className="mr-2" /> 
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
              <CreditCard size={32} className="text-zinc-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Completed Revenue</p>
                <p className="text-2xl font-bold text-emerald-400">
                  TZS {totalCompleted.toLocaleString()}
                </p>
              </div>
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-amber-400">
                  TZS {totalPending.toLocaleString()}
                </p>
              </div>
              <Clock size={32} className="text-amber-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">
                  TZS {totalFailed.toLocaleString()}
                </p>
              </div>
              <XCircle size={32} className="text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-zinc-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={16} />
                <Input
                  placeholder="Transaction ID, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
            </div>
            
            <div className="w-40">
              <label className="text-xs text-zinc-500 mb-1 block">Status</label>
              <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <label className="text-xs text-zinc-500 mb-1 block">Gateway</label>
              <Select value={gatewayFilter || "all"} onValueChange={(v) => setGatewayFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="All Gateways" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">All Gateways</SelectItem>
                  {gateways.map(gw => (
                    <SelectItem key={gw.code} value={gw.code}>{gw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <label className="text-xs text-zinc-500 mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <div className="w-40">
              <label className="text-xs text-zinc-500 mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setStatusFilter("");
                setGatewayFilter("");
                setStartDate("");
                setEndDate("");
                setSearchQuery("");
              }}
              className="border-zinc-700 text-zinc-300"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="animate-spin text-zinc-500" size={32} />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Transaction ID</TableHead>
                    <TableHead className="text-zinc-400">Date</TableHead>
                    <TableHead className="text-zinc-400">User</TableHead>
                    <TableHead className="text-zinc-400">Gateway</TableHead>
                    <TableHead className="text-zinc-400">Plan</TableHead>
                    <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((txn) => {
                    const StatusIcon = STATUS_ICONS[txn.status] || Clock;
                    return (
                      <TableRow key={txn.transaction_id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell className="font-mono text-xs text-zinc-300">
                          {txn.transaction_id}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-400">
                          {formatDate(txn.initiated_at)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-white">{txn.user_email || "-"}</p>
                            {txn.phone_number && (
                              <p className="text-xs text-zinc-500">{txn.phone_number}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <img 
                              src={GATEWAY_LOGOS[txn.payment_method] || ""} 
                              alt={txn.gateway_name}
                              className="w-6 h-4 object-contain"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                            <span className="text-sm text-zinc-300">{txn.gateway_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-300">
                          {txn.plan_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-white">
                            {formatAmount(txn.amount, txn.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[txn.status] || STATUS_COLORS.pending} border`}>
                            <StatusIcon size={12} className="mr-1" />
                            {txn.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-500">
                Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="border-zinc-700 text-zinc-300"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="border-zinc-700 text-zinc-300"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
