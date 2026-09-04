import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for sending/receiving HttpOnly cookies
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      originalRequest.url !== '/auth/login' && 
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/register'
    ) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh token
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        
        // If successful, retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, user needs to log in again
        // We handle the redirection in the AuthContext, but we reject the promise here
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
