import { useEffect, useState } from "react";
import axios from "axios";
import { CreditCard, Check, X, Clock, DollarSign, Phone, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function WithdrawalsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");

  const fetchRequests = async () => {
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const response = await axios.get(`${API}/withdrawal/requests`, {
        params: { status },
        withCredentials: true
      });
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      toast.error("Failed to load withdrawal requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRequests();
  }, [activeTab]);

  const handleProcess = async (requestId, status) => {
    try {
      await axios.put(`${API}/withdrawal/${requestId}`, {
        status,
        admin_notes: adminNotes,
        processed_by: "admin"
      }, { withCredentials: true });
      toast.success(`Withdrawal ${status}`);
      setSelectedRequest(null);
      setAdminNotes("");
      fetchRequests();
    } catch (error) {
      toast.error("Failed to process withdrawal");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "badge-warning",
      approved: "badge-info",
      completed: "badge-success",
      rejected: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  const getPaymentIcon = (method) => {
    return method === "bank_transfer" ? <Building size={16} /> : <Phone size={16} />;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="withdrawals-page">
      <div className="page-header">
        <h1 className="page-title">Withdrawal Requests</h1>
        <p className="page-subtitle">Process choir withdrawal requests for their revenue earnings</p>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {["pending", "approved", "completed", "rejected", "all"].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <CreditCard className="empty-state-icon" />
          <p className="empty-state-title">No withdrawal requests</p>
          <p className="empty-state-text">
            {activeTab === "pending" ? "No pending requests to process" : `No ${activeTab} requests`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((request) => (
            <Card key={request.request_id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-white">{request.choir_name}</h3>
                    <p className="text-xs text-zinc-500">
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Amount</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      TZS {request.amount?.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    {getPaymentIcon(request.payment_method)}
                    <span className="capitalize">{request.payment_method?.replace("_", " ")}</span>
                  </div>
                  {request.payment_details && (
                    <div className="text-xs text-zinc-500 bg-zinc-800/30 p-2 rounded">
                      {request.payment_details.phone && (
                        <p>Phone: {request.payment_details.phone}</p>
                      )}
                      {request.payment_details.bank_name && (
                        <p>Bank: {request.payment_details.bank_name}</p>
                      )}
                      {request.payment_details.account_number && (
                        <p>Account: {request.payment_details.account_number}</p>
                      )}
                    </div>
                  )}
                </div>

                {request.admin_notes && (
                  <div className="text-xs text-zinc-500 mb-4 p-2 bg-zinc-800/30 rounded">
                    <p className="font-medium text-zinc-400 mb-1">Admin Notes:</p>
                    {request.admin_notes}
                  </div>
                )}

                {request.processed_at && (
                  <p className="text-xs text-zinc-600 mb-4">
                    Processed: {new Date(request.processed_at).toLocaleString()}
                  </p>
                )}

                {request.status === "pending" && (
                  <div className="flex gap-2 pt-3 border-t border-zinc-800">
                    <Button
                      size="sm"
                      onClick={() => setSelectedRequest(request)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check size={14} className="mr-1" /> Process
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setAdminNotes("");
                      }}
                      className="flex-1 border-red-600 text-red-400 hover:bg-red-600/20"
                    >
                      <X size={14} className="mr-1" /> Reject
                    </Button>
                  </div>
                )}

                {request.status === "approved" && (
                  <div className="pt-3 border-t border-zinc-800">
                    <Button
                      size="sm"
                      onClick={() => handleProcess(request.request_id, "completed")}
                      className="w-full bg-violet-600 hover:bg-violet-700"
                    >
                      <DollarSign size={14} className="mr-1" /> Mark as Paid
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Process Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Process Withdrawal Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="py-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
                <p className="text-zinc-400 mb-1">Choir: <span className="text-white">{selectedRequest.choir_name}</span></p>
                <p className="text-zinc-400 mb-1">Amount: <span className="text-emerald-400 font-bold">TZS {selectedRequest.amount?.toLocaleString()}</span></p>
                <p className="text-zinc-400">Method: <span className="text-white capitalize">{selectedRequest.payment_method?.replace("_", " ")}</span></p>
              </div>

              <div className="form-group">
                <label className="form-label">Admin Notes (optional)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this transaction..."
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)} className="border-zinc-700">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleProcess(selectedRequest?.request_id, "rejected")}
              className="border-red-600 text-red-400 hover:bg-red-600/20"
            >
              <X size={16} className="mr-1" /> Reject
            </Button>
            <Button
              onClick={() => handleProcess(selectedRequest?.request_id, "approved")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check size={16} className="mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
