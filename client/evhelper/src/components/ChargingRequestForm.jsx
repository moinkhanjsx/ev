import React, { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/auth.js';

const LocationPicker = lazy(() => import('./LocationPicker.jsx'));
const buildGpsLocationLabel = (locationCoordinates) =>
  `GPS location (${locationCoordinates.latitude.toFixed(6)}, ${locationCoordinates.longitude.toFixed(6)})`;

const ChargingRequestForm = () => {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [formData, setFormData] = useState({
    location: '',
    urgency: 'medium',
    message: '',
    phoneNumber: '',
    estimatedTime: ''
  });
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [locationStatus, setLocationStatus] = useState({
    hasLocation: false,
    isDetectingLocation: false,
    error: '',
    trackingEnabled: false,
    accuracy: null,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationAutoFilled, setIsLocationAutoFilled] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.location.trim() && !locationCoordinates) {
      newErrors.location = 'Location is required';
    }

    if (!formData.urgency) {
      newErrors.urgency = 'Urgency is required';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    }

    // Phone number validation
    const phoneRegex = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber.trim())) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    if (formData.estimatedTime && (isNaN(formData.estimatedTime) || formData.estimatedTime < 1)) {
      newErrors.estimatedTime = 'Estimated time must be a positive number (minutes)';
    }

    if (!locationCoordinates) {
      newErrors.locationCoordinates = locationStatus.error || 'Current location is required. Please allow GPS access.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const resolvedLocation =
        formData.location.trim() || (locationCoordinates ? buildGpsLocationLabel(locationCoordinates) : '');

      const requestData = {
        location: resolvedLocation,
        urgency: formData.urgency.toLowerCase(),
        message: formData.message.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : null,
        ...(locationCoordinates ? { locationCoordinates } : {})
      };

      const response = await api.post('/charging/requests', requestData);
      
      if (response.data.success) {
        setFormData({
          location: '',
          urgency: 'medium',
          message: '',
          phoneNumber: '',
          estimatedTime: ''
        });
        setLocationCoordinates(null);
        setIsLocationAutoFilled(false);
        
        alert('Charging request created successfully!');
        navigate('/dashboard', { replace: true });
      } else {
        setErrors({ general: response.data.message || 'Failed to create charging request' });
      }
    } catch (error) {
      setErrors({ general: error.response?.data?.message || error.message || 'Failed to create charging request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'location') {
      setIsLocationAutoFilled(false);
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'low': return 'bg-green-500/20 border-green-500/50 text-green-300';
      case 'medium': return 'bg-amber-500/20 border-amber-500/50 text-amber-300';
      case 'high': return 'bg-red-500/20 border-red-500/50 text-red-300';
      default: return 'bg-gray-500/20 border-gray-500/50 text-gray-300';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  };

  if (!state.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please log in to create a charging request</h2>
          <a href="/login" className="text-cyan-400 hover:text-cyan-300 underline">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 relative z-10">
      <div className="ev-container">
        <div className="ev-formal-card">
          {/* Header */}
          <div className="ev-section ev-text-center mb-10">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full ev-charging-pulse ev-formal-badge">
                <svg className="w-6 h-6 ev-formal-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
            </div>
            <h1 className="ev-formal-title mb-2">Create Charging Request</h1>
            <p className="ev-formal-subtitle">Get emergency charging assistance from community</p>
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="ev-form-field p-5 mb-6 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg backdrop-blur-sm">
              <div className="ev-text-body">{errors.general}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="ev-formal-form">
              {/* Location Field */}
              <div className="ev-formal-field">
                <label htmlFor="location" className="ev-formal-label block">
                  Location / Landmark
                </label>
                <textarea
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input w-full resize-none ${errors.location ? 'ev-input-error' : ''}`}
                  rows={3}
                  placeholder="Enter your current location or address"
                />
                <p className="ev-formal-helper">
                  {locationCoordinates
                    ? 'Auto-filled from GPS. You can edit this to add a landmark or address.'
                    : 'If GPS is unavailable, enter a specific landmark or address manually.'}
                </p>
                {errors.location && (
                  <p className="mt-4 text-sm text-red-400">{errors.location}</p>
                )}
              </div>

              <div className="ev-formal-field">
                <div className="flex flex-col gap-2">
                  <label className="ev-formal-label block">Charging Location</label>
                  <p className="ev-formal-helper">
                    Tap enable once, then this request will use your current browser GPS location.
                  </p>
                </div>

                <div className="h-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-black/20 p-3">
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-slate-950/30 text-sm text-gray-400">
                        Loading map...
                      </div>
                    }
                  >
                    <LocationPicker
                      onLocationSelect={(latitude, longitude) => {
                        const nextCoordinates = {
                          latitude,
                          longitude,
                        };
                        const nextLocationLabel = buildGpsLocationLabel(nextCoordinates);
                        let shouldAutoFillLocation = false;

                        setLocationCoordinates(nextCoordinates);

                        setFormData((prev) => {
                          shouldAutoFillLocation =
                            !prev.location.trim() ||
                            isLocationAutoFilled ||
                            prev.location.startsWith('GPS location (');

                          return shouldAutoFillLocation
                            ? { ...prev, location: nextLocationLabel }
                            : prev;
                        });

                        setIsLocationAutoFilled(shouldAutoFillLocation);

                        if (errors.locationCoordinates || errors.location) {
                          setErrors((prev) => ({
                            ...prev,
                            locationCoordinates: '',
                            location: '',
                          }));
                        }
                      }}
                      onLocationStateChange={setLocationStatus}
                    />
                  </Suspense>
                </div>

                {locationCoordinates ? (
                  <p className="mt-4 text-sm text-emerald-300">
                    Live GPS locked: {locationCoordinates.latitude.toFixed(6)}, {locationCoordinates.longitude.toFixed(6)}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-gray-400">
                    {locationStatus.isDetectingLocation
                      ? 'Detecting your current location...'
                      : locationStatus.trackingEnabled
                        ? 'Waiting for current GPS location.'
                        : 'Enable current location to continue.'}
                  </p>
                )}
                {errors.locationCoordinates ? (
                  <p className="mt-4 text-sm text-red-400">{errors.locationCoordinates}</p>
                ) : null}
                {locationStatus.accuracy !== null ? (
                  <p className="mt-4 text-sm text-gray-400">
                    Current accuracy: {Math.round(locationStatus.accuracy)} m
                  </p>
                ) : null}
              </div>

              {/* Urgency Field */}
              <div className="ev-formal-field">
                <label htmlFor="urgency" className="ev-formal-label block">
                  Urgency Level *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, urgency: level }))}
                      className={`ev-formal-chip-select ${
                        formData.urgency === level ? 'ev-formal-chip-select-active' : ''
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl">{getUrgencyIcon(level)}</div>
                        <div className="text-sm font-medium capitalize">{level}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="ev-formal-helper">Choose how urgent the request is.</p>
                {errors.urgency && (
                  <p className="mt-4 text-sm text-red-400">{errors.urgency}</p>
                )}
              </div>

              {/* Message Field */}
              <div className="ev-formal-field">
                <label htmlFor="message" className="ev-formal-label block">
                  Additional Details
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input w-full resize-none ${errors.message ? 'ev-input-error' : ''}`}
                  rows={3}
                  placeholder="Any additional information that might help (optional)"
                />
                <p className="ev-formal-helper">Optional: include landmarks or vehicle details.</p>
                {errors.message && (
                  <p className="mt-4 text-sm text-red-400">{errors.message}</p>
                )}
              </div>

              {/* Phone Number Field */}
              <div className="ev-formal-field">
                <label htmlFor="phoneNumber" className="ev-formal-label block">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className={`ev-input ev-formal-input w-full ${errors.phoneNumber ? 'ev-input-error' : ''}`}
                  placeholder="Enter your phone number"
                />
                <p className="ev-formal-helper">We’ll use this to contact you.</p>
                {errors.phoneNumber && (
                  <p className="mt-4 text-sm text-red-400">{errors.phoneNumber}</p>
                )}
              </div>

              {/* Estimated Time Field */}
              <div className="ev-formal-field">
                <label htmlFor="estimatedTime" className="ev-formal-label block">
                  Estimated Time Needed (minutes)
                </label>
                <input
                  type="number"
                  id="estimatedTime"
                  name="estimatedTime"
                  value={formData.estimatedTime}
                  onChange={handleChange}
                  min="1"
                  className={`ev-input ev-formal-input w-full ${errors.estimatedTime ? 'ev-input-error' : ''}`}
                  placeholder="How long do you need to charge?"
                />
                <p className="ev-formal-helper">Optional: helps helpers plan time.</p>
                {errors.estimatedTime && (
                  <p className="mt-4 text-sm text-red-400">{errors.estimatedTime}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !locationCoordinates || locationStatus.isDetectingLocation}
                className="ev-formal-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <div className="ev-loading mr-3"></div>
                    Creating Request...
                  </span>
                ) : locationStatus.isDetectingLocation ? (
                  'Detecting Current Location...'
                ) : (
                  'Create Charging Request'
                )}
              </button>
          </form>

          {/* Back Link */}
          <div className="pt-4">
            <div className="ev-formal-divider"></div>
          </div>
          <div className="text-center pt-4">
            <a href="/dashboard" className="ev-formal-link font-medium">
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChargingRequestForm;
