import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { state, actions } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    city: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const result = await actions.register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        city: formData.city.trim(),
      });

      // Registration successful
      navigate('/login');
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
        <div className="ev-formal-card ev-mobile-full-width max-w-md">
          <div className="ev-section ev-text-center mb-10">
            <div className="mb-4">
              <div className="ev-formal-mark">EV</div>
            </div>
            <h1 className="ev-formal-title mb-2">
              Create Account
            </h1>
            <p className="ev-formal-subtitle">
              Join the EV Helper community
            </p>
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="ev-form-field p-5 mb-6 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg backdrop-blur-sm">
              <div className="ev-text-body">{errors.general}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="ev-formal-form">
            {/* Name Field */}
            <div className="ev-formal-field">
              <label htmlFor="name" className="ev-formal-label block">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input ev-input-with-icon w-full ${errors.name ? 'ev-input-error' : ''}`}
                  placeholder="Enter your full name"
                />
                <span className="ev-input-icon" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0v4h8v-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
                  </svg>
                </span>
              </div>
              <p className="ev-formal-helper">Use your real name for trust and clarity.</p>
              {errors.name && (
                <p className="mt-4 text-sm text-red-400">{errors.name}</p>
              )}
            </div>

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
              <p className="ev-formal-helper">We’ll never share your email.</p>
              {errors.email && (
                <p className="mt-4 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* City Field */}
            <div className="ev-formal-field">
              <label htmlFor="city" className="ev-formal-label block">
                City
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input ev-input-with-icon w-full ${errors.city ? 'ev-input-error' : ''}`}
                  placeholder="Enter your city"
                />
                <span className="ev-input-icon" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </span>
              </div>
              <p className="ev-formal-helper">Used to connect you with nearby helpers.</p>
              {errors.city && (
                <p className="mt-4 text-sm text-red-400">{errors.city}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="ev-formal-field">
              <label htmlFor="password" className="ev-formal-label block">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input ev-input-with-icon w-full ${errors.password ? 'ev-input-error' : ''}`}
                  placeholder="Enter your password"
                />
                <span className="ev-input-icon" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3 1.343 3 3v2H9v-2c0-1.657 1.343-3 3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11V8a6 6 0 1112 0v3" />
                  </svg>
                </span>
              </div>
              <p className="ev-formal-helper">Minimum 6 characters.</p>
              {errors.password && (
                <p className="mt-4 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="ev-formal-field">
              <label htmlFor="confirmPassword" className="ev-formal-label block">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input ev-input-with-icon w-full ${errors.confirmPassword ? 'ev-input-error' : ''}`}
                  placeholder="Confirm your password"
                />
                <span className="ev-input-icon" aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3 1.343 3 3v2H9v-2c0-1.657 1.343-3 3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11V8a6 6 0 1112 0v3" />
                  </svg>
                </span>
              </div>
              <p className="ev-formal-helper">Re-enter to confirm.</p>
              {errors.confirmPassword && (
                <p className="mt-4 text-sm text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={state.loading}
                className="ev-formal-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? (
                  <span className="flex items-center justify-center">
                    <div className="ev-loading mr-3"></div>
                    Processing...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>

          {/* Login Link */}
          <div className="pt-4">
            <div className="ev-formal-divider"></div>
          </div>
          <div className="text-center pt-4">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <a href="/login" className="ev-formal-link font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
