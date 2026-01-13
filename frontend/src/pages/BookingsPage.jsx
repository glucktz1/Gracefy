import { useEffect, useState } from "react";
import axios from "axios";
import { CalendarCheck, Check, X, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        params: { status: activeTab === "all" ? undefined : activeTab },
        withCredentials: true
      });
      setBookings(response.data.bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBookings();
  }, [activeTab]);

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      await axios.put(`${API}/bookings/${bookingId}`, { status: newStatus }, { withCredentials: true });
      toast.success(`Booking ${newStatus}`);
      fetchBookings();
    } catch (error) {
      toast.error("Failed to update booking");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "badge-warning",
      confirmed: "badge-success",
      completed: "badge-violet",
      cancelled: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="bookings-page">
      <div className="page-header">
        <h1 className="page-title">Priest Bookings</h1>
        <p className="page-subtitle">Manage priest consultation and meeting bookings</p>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {["pending", "confirmed", "completed", "cancelled", "all"].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Bookings */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <CalendarCheck className="empty-state-icon" />
          <p className="empty-state-title">No bookings found</p>
          <p className="empty-state-text">
            {activeTab === "pending" ? "No pending booking requests" : `No ${activeTab} bookings`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((booking) => (
            <Card 
              key={booking.booking_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all"
              data-testid={`booking-card-${booking.booking_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-white">{booking.purpose}</h3>
                    {getStatusBadge(booking.status)}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <User size={14} className="text-violet-400" />
                    <span>Priest: {booking.priest_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <User size={14} className="text-emerald-400" />
                    <span>Requester: {booking.user_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <CalendarCheck size={14} />
                    <span>{booking.date} at {booking.time}</span>
                  </div>
                </div>

                {booking.notes && (
                  <p className="text-sm text-zinc-500 mb-4 p-3 bg-zinc-800/50 rounded-lg">
                    {booking.notes}
                  </p>
                )}

                {/* Actions */}
                {booking.status === "pending" && (
                  <div className="flex gap-2 pt-3 border-t border-zinc-800">
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(booking.booking_id, "confirmed")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check size={16} className="mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusUpdate(booking.booking_id, "cancelled")}
                      className="flex-1 border-red-600 text-red-400 hover:bg-red-600/20"
                    >
                      <X size={16} className="mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}

                {booking.status === "confirmed" && (
                  <div className="flex gap-2 pt-3 border-t border-zinc-800">
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(booking.booking_id, "completed")}
                      className="flex-1 bg-violet-600 hover:bg-violet-700"
                    >
                      <Check size={16} className="mr-1" />
                      Mark Complete
                    </Button>
                  </div>
                )}

                <p className="text-xs text-zinc-600 mt-3">
                  Created: {new Date(booking.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
