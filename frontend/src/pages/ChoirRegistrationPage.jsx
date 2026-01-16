import { useState } from "react";
import axios from "axios";
import { Music2, Mail, Phone, Lock, User, FileText, CheckCircle, ArrowLeft, Mic2, Users, Guitar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ChoirRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    type: "choir",
    description: ""
  });
  const [errors, setErrors] = useState({});

  const validateStep1 = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid email format";
    if (form.phone && !/^\+?[0-9]{9,15}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = "Invalid phone format";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (!form.type) newErrors.type = "Please select your type";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      await axios.post(`${API}/choir/register`, {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        type: form.type,
        description: form.description
      });
      setSuccess(true);
      toast.success("Registration submitted successfully!");
    } catch (error) {
      const msg = error.response?.data?.detail || "Registration failed";
      toast.error(msg);
      if (msg.includes("already registered")) {
        setErrors({ email: msg });
        setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'choir': return <Users size={20} />;
      case 'artist': return <Mic2 size={20} />;
      case 'band': return <Guitar size={20} />;
      default: return <Music2 size={20} />;
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900/80 border-zinc-800 backdrop-blur-xl">
          <CardContent className="pt-10 pb-8 text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Registration Submitted!</h2>
            <p className="text-zinc-400 mb-6">
              Thank you for registering with Spirit Songs. Your application is now pending admin approval.
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              You will receive an email notification once your account is approved.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate("/choir-login")}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                Go to Choir Login
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/")}
                className="w-full border-zinc-700"
              >
                Back to Admin Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900/80 border-zinc-800 backdrop-blur-xl" data-testid="choir-registration-form">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music2 size={32} className="text-white" />
          </div>
          <CardTitle className="text-2xl">Join Spirit Songs</CardTitle>
          <CardDescription>Register as a choir, artist, or band</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}>1</div>
            <div className={`w-12 h-1 rounded ${step >= 2 ? 'bg-violet-600' : 'bg-zinc-800'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}>2</div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">Basic Information</h3>
              
              {/* Name */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Choir/Artist Name *</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., St. Mary's Cathedral Choir"
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.name ? 'border-red-500' : ''}`}
                    data-testid="name-input"
                  />
                </div>
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Email Address *</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="choir@example.com"
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.email ? 'border-red-500' : ''}`}
                    data-testid="email-input"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+255 xxx xxx xxx"
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.phone ? 'border-red-500' : ''}`}
                    data-testid="phone-input"
                  />
                </div>
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
              </div>

              <Button onClick={handleNext} className="w-full bg-violet-600 hover:bg-violet-700" data-testid="next-btn">
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">Account Setup</h3>

              {/* Type Selection */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Type *</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className={`bg-zinc-950 border-zinc-700 ${errors.type ? 'border-red-500' : ''}`} data-testid="type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="choir">
                      <div className="flex items-center gap-2">
                        <Users size={16} /> Church Choir
                      </div>
                    </SelectItem>
                    <SelectItem value="artist">
                      <div className="flex items-center gap-2">
                        <Mic2 size={16} /> Solo Artist
                      </div>
                    </SelectItem>
                    <SelectItem value="band">
                      <div className="flex items-center gap-2">
                        <Guitar size={16} /> Band/Group
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Password *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 6 characters"
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.password ? 'border-red-500' : ''}`}
                    data-testid="password-input"
                  />
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Confirm Password *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                    data-testid="confirm-password-input"
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">About (Optional)</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell us about your choir, music style, church affiliation..."
                  className="bg-zinc-950 border-zinc-700 min-h-[80px]"
                  data-testid="description-input"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1 border-zinc-700">
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  data-testid="submit-btn"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Registration'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Footer Links */}
          <div className="text-center text-sm text-zinc-500 pt-2 border-t border-zinc-800">
            Already registered?{' '}
            <button onClick={() => navigate("/choir-login")} className="text-violet-400 hover:underline">
              Sign in here
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
