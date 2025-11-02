import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  searchUsers: (query) => api.get(`/auth/users/search?q=${query}`)
};

// File API
export const fileAPI = {
  uploadFile: (formData, onUploadProgress) => {
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  },
  
  getFiles: () => api.get('/files'),
  
  downloadFile: (fileId) => {
    return api.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    });
  },
  
  shareFile: (fileId, userData) => api.post(`/files/${fileId}/share`, userData),
  
  unshareFile: (fileId, userId) => api.delete(`/files/${fileId}/share/${userId}`),
  
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  
  getAuditLogs: (fileId) => api.get(`/files/${fileId}/audit-logs`)
};

export default api;