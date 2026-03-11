import axios from 'axios';

// API base URL
// - In dev, prefer '/api' so Vite can proxy to the backend.
// - In prod, VITE_API_URL can point at a full origin like 'https://your-domain.com/api'.
const API_BASE_URL = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) || '/api';
const configuredTimeoutMs = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '', 10);
const API_TIMEOUT_MS =
  Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : import.meta.env.PROD
      ? 30000
      : 10000;
const DEFAULT_TIMEOUT_MESSAGE =
  'The server is taking longer than expected to respond. The backend may be waking up. Please try again in a few seconds.';
const LOCAL_BACKEND_UNAVAILABLE_MESSAGE =
  'Local API is unavailable. Start the backend on http://localhost:5000 and try again.';

export const getApiErrorMessage = (error, fallbackMessage = 'Request failed') => {
  const isLocalProxyFailure =
    import.meta.env.DEV &&
    API_BASE_URL === '/api' &&
    error?.response?.status === 500 &&
    (error?.response?.data === '' || error?.response?.data == null);

  if (isLocalProxyFailure) {
    return LOCAL_BACKEND_UNAVAILABLE_MESSAGE;
  }

  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
    return DEFAULT_TIMEOUT_MESSAGE;
  }

  if (typeof error?.response?.data?.message === 'string' && error.response.data.message.trim()) {
    return error.response.data.message;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallbackMessage;
};

const normalizeApiError = (error, fallbackMessage) => ({
  message: getApiErrorMessage(error, fallbackMessage),
  code: error?.code || null,
  status: error?.response?.status || null,
});

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT_MS,
});

// Request interceptor to automatically attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('evhelper_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration and improve error handling
api.interceptors.response.use(
  (response) => {
    // SAFETY CHECK: Log response for debugging
    if (import.meta.env.DEV) {
      console.log('API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data
      });
    }
    
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('Response interceptor error:', error);
    }
    
    // Handle 401 errors from response interceptor
    if (error.response?.status === 401) {
      localStorage.removeItem('evhelper_token');
      localStorage.removeItem('evhelper_user');
      window.location.href = '/login';
    }
    
    // SAFETY CHECK: Enhanced error logging for debugging
    if (import.meta.env.DEV) {
      console.error('API Error Details:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    }
    
    return Promise.reject(error);
  }
);

// Authentication functions
export const authAPI = {
  // Register new user
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Registration error:', error);
      }
      throw normalizeApiError(error, 'Registration failed');
    }
  },

  // Login user
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      
      if (response.data.success) {
        const { token, user } = response.data;
        
        // Store token and user data
        localStorage.setItem('evhelper_token', token);
        localStorage.setItem('evhelper_user', JSON.stringify(user));
        
        return { success: true, user, token };
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Login error:', error);
      }
      throw normalizeApiError(error, 'Login failed');
    }
  },

  // Google login
  googleLogin: async (credential, city = "") => {
    try {
      const response = await api.post('/auth/google', { credential, city });

      if (response.data.success) {
        const { token, user } = response.data;
        localStorage.setItem('evhelper_token', token);
        localStorage.setItem('evhelper_user', JSON.stringify(user));
        return { success: true, user, token };
      }

      throw new Error(response.data.message || 'Google login failed');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Google login error:', error);
      }
      throw normalizeApiError(error, 'Google login failed');
    }
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('evhelper_token');
    localStorage.removeItem('evhelper_user');
  },

  // Get current user
  getCurrentUser: () => {
    const userStr = localStorage.getItem('evhelper_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Get current token
  getToken: () => {
    return localStorage.getItem('evhelper_token');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('evhelper_token');
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const token = localStorage.getItem('evhelper_token');
      const response = await api.put('/auth/profile', profileData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.data.success) {
        // Update stored user data
        localStorage.setItem('evhelper_user', JSON.stringify(response.data.user));
        return response.data;
      } else {
        throw new Error(response.data.message || 'Profile update failed');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Profile update error:', error);
      }
      throw normalizeApiError(error, 'Profile update failed');
    }
  },
};

export default api;
export { api };
