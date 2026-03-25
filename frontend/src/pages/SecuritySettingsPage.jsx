import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Shield, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Key } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Password strength checker
  const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Medium', color: 'bg-yellow-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.new_password);

  const passwordRequirements = [
    { met: formData.new_password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(formData.new_password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(formData.new_password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(formData.new_password), text: 'One number' },
    { met: /[^a-zA-Z0-9]/.test(formData.new_password), text: 'One special character (recommended)' }
  ];

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.current_password || !formData.new_password || !formData.confirm_password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (formData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/admin/change-password`, formData, { withCredentials: true });
      toast.success('Password changed successfully!');
      setFormData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="security-settings-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-500/20 rounded-lg">
          <Shield className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Security Settings</h1>
          <p className="text-zinc-400 text-sm">Manage your account security and password</p>
        </div>
      </div>

      {/* Password Change Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-lg text-white">Change Password</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Update your admin account password. Make sure to use a strong, unique password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current_password" className="text-zinc-300">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="current_password"
                  name="current_password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={formData.current_password}
                  onChange={handleChange}
                  placeholder="Enter your current password"
                  className="pl-10 pr-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="current-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new_password" className="text-zinc-300">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="new_password"
                  name="new_password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={formData.new_password}
                  onChange={handleChange}
                  placeholder="Enter your new password"
                  className="pl-10 pr-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.new_password && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.label === 'Strong' ? 'text-green-400' :
                      passwordStrength.label === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>

                  {/* Requirements Checklist */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {passwordRequirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {req.met ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        <span className={req.met ? 'text-green-400' : 'text-zinc-500'}>
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm_password" className="text-zinc-300">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Confirm your new password"
                  className="pl-10 pr-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="confirm-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.confirm_password && formData.new_password !== formData.confirm_password && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  Passwords do not match
                </p>
              )}
              {formData.confirm_password && formData.new_password === formData.confirm_password && formData.new_password && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3" />
                  Passwords match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={loading || !formData.current_password || !formData.new_password || formData.new_password !== formData.confirm_password}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5"
                data-testid="change-password-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Changing Password...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Change Password
                  </span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Tips Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            Security Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              Use a unique password that you don't use for other accounts
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              Include a mix of letters, numbers, and special characters
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              Avoid using personal information like birthdays or names
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              Change your password regularly (every 3-6 months recommended)
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              Never share your password with anyone
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
