import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { state, actions } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    actions.setLoading(true);
    setErrors({});

    try {
      await actions.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Login successful - navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      actions.setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:py-16 sm:px-6 lg:px-8 relative z-10">
      <div className="ev-container ev-mobile-center">
        <div className="ev-formal-card ev-mobile-full-width max-w-md p-8 sm:p-12">
          <div className="ev-section ev-text-center mb-10">
            <div className="mb-4">
              <div className="ev-formal-mark">EV</div>
            </div>
            <h1 className="ev-formal-title mb-2">
              Sign In
            </h1>
            <p className="ev-formal-subtitle">
              Access your EV Helper account
            </p>
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="ev-form-field p-5 mb-6 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg backdrop-blur-sm">
              <div className="ev-text-body">{errors.general}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="ev-formal-form">
            {/* Email Field */}
            <div className="ev-formal-field">
              <label htmlFor="email" className="ev-formal-label block">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input ev-input-with-icon w-full ${errors.email ? 'ev-input-error' : ''}`}
                  placeholder="Enter your email"
                />
                <span className="ev-input-icon" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              <p className="ev-formal-helper">Use the email you registered with.</p>
              {errors.email && (
                <p className="mt-4 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="ev-formal-field">
              <label htmlFor="password" className="ev-formal-label block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input ev-input-with-icon ev-input-with-toggle w-full ${errors.password ? 'ev-input-error' : ''}`}
                  placeholder="Enter your password"
                />
                <span className="ev-input-icon" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3 1.343 3 3v2H9v-2c0-1.657 1.343-3 3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11V8a6 6 0 1112 0v3" />
                  </svg>
                </span>
                <button
                  type="button"
                  className="absolute inset-y-0 ev-input-toggle text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="ev-formal-helper">Keep this private and secure.</p>
              {errors.password && (
                <p className="mt-4 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-gray-600 rounded bg-gray-800"
                />
                <label htmlFor="remember" className="block text-sm text-gray-300">
                  Remember me
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={state.loading}
              className="ev-formal-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? (
                <span className="flex items-center justify-center">
                  <div className="ev-loading mr-3"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Register Link */}
            <div className="pt-4">
              <div className="ev-formal-divider"></div>
            </div>
            <div className="text-center pt-4">
              <p className="text-sm text-gray-400">
                Don't have an account?{' '}
                <Link to="/register" className="ev-formal-link font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
