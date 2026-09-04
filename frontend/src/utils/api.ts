import axios from 'axios';

// Create an Axios instance with base URL pointing to the backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Request interceptor to attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const storedUser = localStorage.getItem('peer_eval_user');
    if (storedUser) {
      const { token } = JSON.parse(storedUser);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
