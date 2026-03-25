import { useState } from "react";
import axios from "axios";
import { Music2, Mail, Phone, Lock, User, CheckCircle, ArrowLeft, Mic2, Users, Guitar, Building, CreditCard, Smartphone, Landmark, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Translations
const translations = {
  sw: {
    title: "Jiunge na Gracefy",
    subtitle: "Sajili kama kwaya, msanii, au bendi",
    step1: "Taarifa za Msingi",
    step2: "Maelezo ya Kwaya",
    step3: "Viongozi",
    step4: "Malipo & Akaunti",
    choirName: "Jina la Kwaya/Msanii",
    choirNamePlaceholder: "mf. Kwaya ya Kanisa Kuu la Bikira Maria",
    email: "Barua Pepe",
    emailPlaceholder: "kwaya@mfano.com",
    phone: "Nambari ya Simu",
    phonePlaceholder: "+255 xxx xxx xxx",
    choirType: "Aina",
    churchChoir: "Kwaya ya Kanisa",
    soloArtist: "Msanii Binafsi",
    bandGroup: "Bendi/Kikundi",
    denomination: "Dhehebu/Kanisa",
    churchName: "Jina la Parokia/Kanisa",
    churchNamePlaceholder: "mf. Parokia ya Mtakatifu Petro",
    location: "Mahali",
    locationPlaceholder: "mf. Dar es Salaam",
    description: "Maelezo kuhusu kwaya",
    descriptionPlaceholder: "Eleza historia na malengo ya kwaya yako...",
    chairperson: "Mwenyekiti wa Kwaya",
    chairpersonName: "Jina la Mwenyekiti",
    chairpersonPhone: "Simu ya Mwenyekiti",
    chairpersonEmail: "Barua Pepe ya Mwenyekiti",
    treasurer: "Mweka Hazina wa Kwaya",
    treasurerName: "Jina la Mweka Hazina",
    treasurerPhone: "Simu ya Mweka Hazina",
    parishLeader: "Kiongozi wa Parokia/Kanisa",
    leaderName: "Jina la Kiongozi",
    leaderTitle: "Cheo (mf. Paroko, Mchungaji)",
    leaderPhone: "Simu ya Kiongozi",
    paymentDetails: "Maelezo ya Malipo",
    paymentMethod: "Njia ya Malipo",
    mobileMoney: "Pesa kwa Simu (M-Pesa, Tigo Pesa, n.k.)",
    bankAccount: "Akaunti ya Benki",
    mobileNetwork: "Mtandao wa Simu",
    mobileNumber: "Nambari ya Simu ya Pesa",
    registeredName: "Jina Lililosajiliwa",
    bankName: "Jina la Benki",
    accountNumber: "Nambari ya Akaunti",
    accountName: "Jina la Akaunti",
    password: "Nenosiri",
    passwordPlaceholder: "Angalau herufi 6",
    confirmPassword: "Thibitisha Nenosiri",
    confirmPasswordPlaceholder: "Ingiza nenosiri tena",
    continue: "Endelea",
    back: "Rudi",
    submit: "Wasilisha Usajili",
    submitting: "Inawasilisha...",
    successTitle: "Usajili Umewasilishwa!",
    successMessage: "Asante kwa kusajili na Gracefy. Maombi yako yanasubiri idhini ya msimamizi.",
    successNote: "Utapokea arifa kwa barua pepe akaunti yako itakapoidhinishwa.",
    goToLogin: "Nenda kwenye Kuingia kwa Kwaya",
    backToHome: "Rudi Nyumbani",
    required: "Inahitajika",
    invalidEmail: "Muundo wa barua pepe si sahihi",
    invalidPhone: "Muundo wa nambari ya simu si sahihi",
    passwordMin: "Nenosiri lazima liwe na angalau herufi 6",
    passwordMismatch: "Manenosiri hayalingani",
    selectType: "Chagua aina",
    selectNetwork: "Chagua mtandao",
    selectPayment: "Chagua njia ya malipo",
    languageToggle: "English"
  },
  en: {
    title: "Join Gracefy",
    subtitle: "Register as a choir, artist, or band",
    step1: "Basic Info",
    step2: "Choir Details",
    step3: "Leadership",
    step4: "Payment & Account",
    choirName: "Choir/Artist Name",
    choirNamePlaceholder: "e.g., St. Mary's Cathedral Choir",
    email: "Email Address",
    emailPlaceholder: "choir@example.com",
    phone: "Phone Number",
    phonePlaceholder: "+255 xxx xxx xxx",
    choirType: "Type",
    churchChoir: "Church Choir",
    soloArtist: "Solo Artist",
    bandGroup: "Band/Group",
    denomination: "Denomination/Church",
    churchName: "Parish/Church Name",
    churchNamePlaceholder: "e.g., St. Peter's Parish",
    location: "Location",
    locationPlaceholder: "e.g., Dar es Salaam",
    description: "Description about the choir",
    descriptionPlaceholder: "Describe your choir's history and goals...",
    chairperson: "Choir Chairperson",
    chairpersonName: "Chairperson Name",
    chairpersonPhone: "Chairperson Phone",
    chairpersonEmail: "Chairperson Email",
    treasurer: "Choir Treasurer",
    treasurerName: "Treasurer Name",
    treasurerPhone: "Treasurer Phone",
    parishLeader: "Parish/Church Leader",
    leaderName: "Leader Name",
    leaderTitle: "Title (e.g., Parish Priest, Pastor)",
    leaderPhone: "Leader Phone",
    paymentDetails: "Payment Details",
    paymentMethod: "Payment Method",
    mobileMoney: "Mobile Money (M-Pesa, Tigo Pesa, etc.)",
    bankAccount: "Bank Account",
    mobileNetwork: "Mobile Network",
    mobileNumber: "Mobile Money Number",
    registeredName: "Registered Name",
    bankName: "Bank Name",
    accountNumber: "Account Number",
    accountName: "Account Name",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter password",
    continue: "Continue",
    back: "Back",
    submit: "Submit Registration",
    submitting: "Submitting...",
    successTitle: "Registration Submitted!",
    successMessage: "Thank you for registering with Gracefy. Your application is now pending admin approval.",
    successNote: "You will receive an email notification once your account is approved.",
    goToLogin: "Go to Choir Login",
    backToHome: "Back to Home",
    required: "Required",
    invalidEmail: "Invalid email format",
    invalidPhone: "Invalid phone format",
    passwordMin: "Password must be at least 6 characters",
    passwordMismatch: "Passwords do not match",
    selectType: "Select type",
    selectNetwork: "Select network",
    selectPayment: "Select payment method",
    languageToggle: "Kiswahili"
  }
};

const mobileNetworks = [
  { value: "vodacom", label: "Vodacom (M-Pesa)" },
  { value: "tigo", label: "Tigo (Tigo Pesa)" },
  { value: "airtel", label: "Airtel (Airtel Money)" },
  { value: "halotel", label: "Halotel (Halopesa)" },
  { value: "ttcl", label: "TTCL (T-Pesa)" }
];

const banks = [
  { value: "crdb", label: "CRDB Bank" },
  { value: "nmb", label: "NMB Bank" },
  { value: "nbc", label: "NBC Bank" },
  { value: "stanbic", label: "Stanbic Bank" },
  { value: "equity", label: "Equity Bank" },
  { value: "dtb", label: "Diamond Trust Bank" },
  { value: "exim", label: "Exim Bank" },
  { value: "other", label: "Other" }
];

export default function ChoirRegistrationPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState("sw"); // Default to Kiswahili
  const t = translations[lang];
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    // Basic Info
    name: "",
    email: "",
    phone: "",
    type: "choir",
    // Choir Details
    denomination: "",
    churchName: "",
    location: "",
    description: "",
    // Leadership
    chairpersonName: "",
    chairpersonPhone: "",
    chairpersonEmail: "",
    treasurerName: "",
    treasurerPhone: "",
    leaderName: "",
    leaderTitle: "",
    leaderPhone: "",
    // Payment
    paymentMethod: "mobile",
    mobileNetwork: "",
    mobileNumber: "",
    mobileRegisteredName: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    // Account
    password: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({});

  const totalSteps = form.type === "choir" ? 4 : 3;

  const validateStep = (stepNum) => {
    const newErrors = {};
    
    if (stepNum === 1) {
      if (!form.name.trim()) newErrors.name = t.required;
      if (!form.email.trim()) newErrors.email = t.required;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = t.invalidEmail;
      if (form.phone && !/^\+?[0-9]{9,15}$/.test(form.phone.replace(/\s/g, ''))) {
        newErrors.phone = t.invalidPhone;
      }
      if (!form.type) newErrors.type = t.required;
    }
    
    if (stepNum === 2 && form.type === "choir") {
      if (!form.churchName.trim()) newErrors.churchName = t.required;
    }
    
    if (stepNum === 3 && form.type === "choir") {
      if (!form.chairpersonName.trim()) newErrors.chairpersonName = t.required;
      if (!form.chairpersonPhone.trim()) newErrors.chairpersonPhone = t.required;
      if (!form.treasurerName.trim()) newErrors.treasurerName = t.required;
      if (!form.treasurerPhone.trim()) newErrors.treasurerPhone = t.required;
    }
    
    const lastStep = form.type === "choir" ? 4 : 3;
    if (stepNum === lastStep) {
      if (form.paymentMethod === "mobile") {
        if (!form.mobileNetwork) newErrors.mobileNetwork = t.required;
        if (!form.mobileNumber.trim()) newErrors.mobileNumber = t.required;
        if (!form.mobileRegisteredName.trim()) newErrors.mobileRegisteredName = t.required;
      } else {
        if (!form.bankName) newErrors.bankName = t.required;
        if (!form.bankAccountNumber.trim()) newErrors.bankAccountNumber = t.required;
        if (!form.bankAccountName.trim()) newErrors.bankAccountName = t.required;
      }
      if (!form.password) newErrors.password = t.required;
      else if (form.password.length < 6) newErrors.password = t.passwordMin;
      if (form.password !== form.confirmPassword) newErrors.confirmPassword = t.passwordMismatch;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      // Skip step 2 and 3 for non-choir types
      if (form.type !== "choir" && step === 1) {
        setStep(3);
      } else {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (form.type !== "choir" && step === 3) {
      setStep(1);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    const lastStep = form.type === "choir" ? 4 : 3;
    if (!validateStep(lastStep)) return;

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        type: form.type,
        description: form.description,
        denomination: form.denomination,
        church_name: form.churchName,
        location: form.location,
        // Leadership
        chairman_name: form.chairpersonName,
        chairman_phone: form.chairpersonPhone,
        chairman_email: form.chairpersonEmail,
        treasurer_name: form.treasurerName,
        treasurer_phone: form.treasurerPhone,
        parish_priest_name: form.leaderName,
        parish_priest_title: form.leaderTitle,
        parish_priest_phone: form.leaderPhone,
        // Payment
        payment_method: form.paymentMethod,
        mobile_network: form.mobileNetwork,
        mobile_number: form.mobileNumber,
        mobile_registered_name: form.mobileRegisteredName,
        bank_name: form.bankName,
        bank_account_number: form.bankAccountNumber,
        bank_account_name: form.bankAccountName
      };
      
      await axios.post(`${API}/choir/register`, payload);
      setSuccess(true);
      toast.success(lang === "sw" ? "Usajili umewasilishwa!" : "Registration submitted!");
    } catch (error) {
      const msg = error.response?.data?.detail || (lang === "sw" ? "Usajili umeshindikana" : "Registration failed");
      toast.error(msg);
      if (msg.includes("already registered") || msg.includes("tayari")) {
        setErrors({ email: msg });
        setStep(1);
      }
    } finally {
      setLoading(false);
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
            <h2 className="text-2xl font-bold mb-2">{t.successTitle}</h2>
            <p className="text-zinc-400 mb-4">{t.successMessage}</p>
            <p className="text-sm text-zinc-500 mb-6">{t.successNote}</p>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate("/choir-login")}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {t.goToLogin}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/app")}
                className="w-full border-zinc-700"
              >
                {t.backToHome}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-zinc-900/80 border-zinc-800 backdrop-blur-xl" data-testid="choir-registration-form">
        <CardHeader className="text-center pb-2">
          {/* Language Toggle */}
          <div className="absolute top-4 right-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "sw" ? "en" : "sw")}
              className="text-zinc-400 hover:text-white"
            >
              <Globe size={16} className="mr-1" />
              {t.languageToggle}
            </Button>
          </div>
          
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music2 size={32} className="text-white" />
          </div>
          <CardTitle className="text-2xl">{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {[1, 2, 3, 4].slice(0, totalSteps).map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}>{s}</div>
                {i < totalSteps - 1 && (
                  <div className={`w-8 h-1 rounded mx-1 ${step > s ? 'bg-violet-600' : 'bg-zinc-800'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">{t.step1}</h3>
              
              {/* Type Selection */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.choirType} *</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className={`bg-zinc-950 border-zinc-700 ${errors.type ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder={t.selectType} />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="choir">
                      <div className="flex items-center gap-2"><Users size={16} /> {t.churchChoir}</div>
                    </SelectItem>
                    <SelectItem value="artist">
                      <div className="flex items-center gap-2"><Mic2 size={16} /> {t.soloArtist}</div>
                    </SelectItem>
                    <SelectItem value="band">
                      <div className="flex items-center gap-2"><Guitar size={16} /> {t.bandGroup}</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type}</p>}
              </div>
              
              {/* Name */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.choirName} *</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t.choirNamePlaceholder}
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.name ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.email} *</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t.emailPlaceholder}
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.email ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.phone}</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t.phonePlaceholder}
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.phone ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
              </div>

              <Button onClick={handleNext} className="w-full bg-violet-600 hover:bg-violet-700">
                {t.continue}
              </Button>
            </div>
          )}

          {/* Step 2: Choir Details (only for church choir) */}
          {step === 2 && form.type === "choir" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">{t.step2}</h3>
              
              {/* Denomination */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.denomination}</label>
                <div className="relative">
                  <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={form.denomination}
                    onChange={(e) => setForm({ ...form, denomination: e.target.value })}
                    placeholder="e.g., Catholic, Lutheran, Anglican"
                    className="pl-10 bg-zinc-950 border-zinc-700"
                  />
                </div>
              </div>
              
              {/* Church Name */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.churchName} *</label>
                <div className="relative">
                  <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={form.churchName}
                    onChange={(e) => setForm({ ...form, churchName: e.target.value })}
                    placeholder={t.churchNamePlaceholder}
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.churchName ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.churchName && <p className="text-red-400 text-xs mt-1">{errors.churchName}</p>}
              </div>
              
              {/* Location */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.location}</label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder={t.locationPlaceholder}
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.description}</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t.descriptionPlaceholder}
                  className="bg-zinc-950 border-zinc-700 min-h-[80px]"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1 border-zinc-700">
                  <ArrowLeft size={16} className="mr-2" /> {t.back}
                </Button>
                <Button onClick={handleNext} className="flex-1 bg-violet-600 hover:bg-violet-700">
                  {t.continue}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Leadership (only for church choir) */}
          {step === 3 && form.type === "choir" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">{t.step3}</h3>
              
              {/* Chairperson */}
              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-violet-400">{t.chairperson}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t.chairpersonName} *</label>
                    <Input
                      value={form.chairpersonName}
                      onChange={(e) => setForm({ ...form, chairpersonName: e.target.value })}
                      placeholder="Jina kamili"
                      className={`bg-zinc-950 border-zinc-700 text-sm ${errors.chairpersonName ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t.chairpersonPhone} *</label>
                    <Input
                      value={form.chairpersonPhone}
                      onChange={(e) => setForm({ ...form, chairpersonPhone: e.target.value })}
                      placeholder="+255..."
                      className={`bg-zinc-950 border-zinc-700 text-sm ${errors.chairpersonPhone ? 'border-red-500' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t.chairpersonEmail}</label>
                  <Input
                    value={form.chairpersonEmail}
                    onChange={(e) => setForm({ ...form, chairpersonEmail: e.target.value })}
                    placeholder="barua@mfano.com"
                    className="bg-zinc-950 border-zinc-700 text-sm"
                  />
                </div>
              </div>

              {/* Treasurer */}
              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-emerald-400">{t.treasurer}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t.treasurerName} *</label>
                    <Input
                      value={form.treasurerName}
                      onChange={(e) => setForm({ ...form, treasurerName: e.target.value })}
                      placeholder="Jina kamili"
                      className={`bg-zinc-950 border-zinc-700 text-sm ${errors.treasurerName ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t.treasurerPhone} *</label>
                    <Input
                      value={form.treasurerPhone}
                      onChange={(e) => setForm({ ...form, treasurerPhone: e.target.value })}
                      placeholder="+255..."
                      className={`bg-zinc-950 border-zinc-700 text-sm ${errors.treasurerPhone ? 'border-red-500' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Parish Leader */}
              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-amber-400">{t.parishLeader}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t.leaderName}</label>
                    <Input
                      value={form.leaderName}
                      onChange={(e) => setForm({ ...form, leaderName: e.target.value })}
                      placeholder="Jina kamili"
                      className="bg-zinc-950 border-zinc-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t.leaderTitle}</label>
                    <Input
                      value={form.leaderTitle}
                      onChange={(e) => setForm({ ...form, leaderTitle: e.target.value })}
                      placeholder="mf. Paroko"
                      className="bg-zinc-950 border-zinc-700 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t.leaderPhone}</label>
                  <Input
                    value={form.leaderPhone}
                    onChange={(e) => setForm({ ...form, leaderPhone: e.target.value })}
                    placeholder="+255..."
                    className="bg-zinc-950 border-zinc-700 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1 border-zinc-700">
                  <ArrowLeft size={16} className="mr-2" /> {t.back}
                </Button>
                <Button onClick={handleNext} className="flex-1 bg-violet-600 hover:bg-violet-700">
                  {t.continue}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 (or Step 3 for non-choir): Payment & Account */}
          {((step === 4 && form.type === "choir") || (step === 3 && form.type !== "choir")) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">{t.step4}</h3>
              
              {/* Payment Method Selection */}
              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-violet-400 flex items-center gap-2">
                  <CreditCard size={16} /> {t.paymentDetails}
                </p>
                
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t.paymentMethod} *</label>
                  <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-700">
                      <SelectValue placeholder={t.selectPayment} />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="mobile">
                        <div className="flex items-center gap-2"><Smartphone size={16} /> {t.mobileMoney}</div>
                      </SelectItem>
                      <SelectItem value="bank">
                        <div className="flex items-center gap-2"><Landmark size={16} /> {t.bankAccount}</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.paymentMethod === "mobile" && (
                  <>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">{t.mobileNetwork} *</label>
                      <Select value={form.mobileNetwork} onValueChange={(v) => setForm({ ...form, mobileNetwork: v })}>
                        <SelectTrigger className={`bg-zinc-950 border-zinc-700 ${errors.mobileNetwork ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder={t.selectNetwork} />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {mobileNetworks.map(n => (
                            <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.mobileNetwork && <p className="text-red-400 text-xs mt-1">{errors.mobileNetwork}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">{t.mobileNumber} *</label>
                        <Input
                          value={form.mobileNumber}
                          onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
                          placeholder="0755..."
                          className={`bg-zinc-950 border-zinc-700 text-sm ${errors.mobileNumber ? 'border-red-500' : ''}`}
                        />
                        {errors.mobileNumber && <p className="text-red-400 text-xs mt-1">{errors.mobileNumber}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">{t.registeredName} *</label>
                        <Input
                          value={form.mobileRegisteredName}
                          onChange={(e) => setForm({ ...form, mobileRegisteredName: e.target.value })}
                          placeholder="Jina lililosajiliwa"
                          className={`bg-zinc-950 border-zinc-700 text-sm ${errors.mobileRegisteredName ? 'border-red-500' : ''}`}
                        />
                        {errors.mobileRegisteredName && <p className="text-red-400 text-xs mt-1">{errors.mobileRegisteredName}</p>}
                      </div>
                    </div>
                  </>
                )}

                {form.paymentMethod === "bank" && (
                  <>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">{t.bankName} *</label>
                      <Select value={form.bankName} onValueChange={(v) => setForm({ ...form, bankName: v })}>
                        <SelectTrigger className={`bg-zinc-950 border-zinc-700 ${errors.bankName ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Chagua benki" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {banks.map(b => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.bankName && <p className="text-red-400 text-xs mt-1">{errors.bankName}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">{t.accountNumber} *</label>
                        <Input
                          value={form.bankAccountNumber}
                          onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                          placeholder="Nambari ya akaunti"
                          className={`bg-zinc-950 border-zinc-700 text-sm ${errors.bankAccountNumber ? 'border-red-500' : ''}`}
                        />
                        {errors.bankAccountNumber && <p className="text-red-400 text-xs mt-1">{errors.bankAccountNumber}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">{t.accountName} *</label>
                        <Input
                          value={form.bankAccountName}
                          onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                          placeholder="Jina la akaunti"
                          className={`bg-zinc-950 border-zinc-700 text-sm ${errors.bankAccountName ? 'border-red-500' : ''}`}
                        />
                        {errors.bankAccountName && <p className="text-red-400 text-xs mt-1">{errors.bankAccountName}</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.password} *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={t.passwordPlaceholder}
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.password ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">{t.confirmPassword} *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder={t.confirmPasswordPlaceholder}
                    className={`pl-10 bg-zinc-950 border-zinc-700 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1 border-zinc-700">
                  <ArrowLeft size={16} className="mr-2" /> {t.back}
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? t.submitting : t.submit}
                </Button>
              </div>
            </div>
          )}

          {/* Back to Login */}
          {step === 1 && (
            <div className="text-center">
              <button
                onClick={() => navigate("/choir-login")}
                className="text-sm text-zinc-400 hover:text-white"
              >
                {lang === "sw" ? "Tayari una akaunti? Ingia" : "Already have an account? Sign in"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
