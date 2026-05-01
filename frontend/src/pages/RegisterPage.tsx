import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const isAuthenticated = !!localStorage.getItem('access_token');

  if (isAuthenticated) return <Navigate to="/" />;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
        return toast.error('Please fill in all personal details');
      }
    }
    setStep(set => set + 1);
  };

  const prevStep = () => setStep(set => set - 1);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/register/`, formData);
      
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('username', res.data.username || formData.username);
      localStorage.setItem('is_verified', String(res.data.is_verified || false));
      localStorage.setItem('tier', res.data.tier || 'free');
      localStorage.setItem('is_staff', String(res.data.is_staff || false));
      localStorage.setItem('is_superuser', String(res.data.is_superuser || false));
      
      toast.success('Registration successful!');
      window.location.href = '/';
    } catch (err: any) {
      const msgs = err.response?.data?.detail;
      const msgStr = Array.isArray(msgs) ? msgs.join(', ') : msgs;
      toast.error(msgStr || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex justify-center items-center py-12 px-4 bg-gray-50 dark:bg-gray-900/10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">Create Account</h1>
          <p className="text-gray-500 dark:text-gray-400">Join KIBOSS to start buying and selling</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Progress Bar */}
          <div className="h-2 w-full bg-gray-100 dark:bg-gray-700">
            <motion.div 
              className="h-full bg-brand-600"
              initial={{ width: '0%' }}
              animate={{ width: step === 1 ? '50%' : '100%' }}
              transition={{ duration: 0.5, ease: "circOut" }}
            />
          </div>

          <div className="p-8 sm:p-10">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Personal Details</h2>
                    <p className="text-sm text-gray-500">Tell us a bit about yourself</p>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text" name="first_name" required
                            className="input pl-10 h-12 rounded-xl" value={formData.first_name} onChange={handleChange} placeholder="First Name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Last Name</label>
                        <input
                          type="text" name="last_name" required
                          className="input h-12 rounded-xl" value={formData.last_name} onChange={handleChange} placeholder="Last Name"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="date" name="date_of_birth" required
                          className="input pl-10 h-12 rounded-xl" value={formData.date_of_birth} onChange={handleChange}
                        />
                      </div>
                    </div>

                    <button 
                      onClick={nextStep}
                      className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold h-14 rounded-2xl transition-all shadow-lg shadow-brand-500/25 mt-4"
                    >
                      Continue
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Account Credentials</h2>
                    <p className="text-sm text-gray-500">Secure your account</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Username</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text" name="username" required minLength={3}
                          className="input pl-10 h-12 rounded-xl" value={formData.username} onChange={handleChange} placeholder="username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email" name="email" required
                          className="input pl-10 h-12 rounded-xl" value={formData.email} onChange={handleChange} placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="password" name="password" required minLength={8}
                            className="input pl-10 h-12 rounded-xl" value={formData.password} onChange={handleChange} placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Confirm</label>
                        <input
                          type="password" name="confirm_password" required minLength={8}
                          className="input h-12 rounded-xl" value={formData.confirm_password} onChange={handleChange} placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                      <button 
                        type="button"
                        onClick={prevStep}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold h-14 rounded-2xl transition-all"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        Back
                      </button>
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="flex-[2] flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white font-bold h-14 rounded-2xl transition-all shadow-lg shadow-brand-500/25"
                      >
                        {loading ? 'Creating Account...' : 'Complete Signup'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-8">
          Already have an account?{' '}
          <Link to="/login" className="relative z-10 font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
