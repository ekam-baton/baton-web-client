const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = {
  async request(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('baton_token');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API Request Failed');
      }
      
      return data;
    } catch (err) {
      throw err;
    }
  },

  async login(email, password) {
    const data = await this.request('/auth/login', 'POST', { email, password });
    localStorage.setItem('baton_token', data.token);
    localStorage.setItem('baton_refresh_token', data.refresh_token);
    return data;
  },

  async register(email, password) {
    return this.request('/auth/register', 'POST', { email, password });
  },

  async verifyOTP(email, code) {
    return this.request('/auth/verify-email', 'POST', { email, code });
  },

  logout() {
    localStorage.removeItem('baton_token');
    localStorage.removeItem('baton_refresh_token');
  },

  async downloadBackup() {
    const token = localStorage.getItem('baton_token');
    if (!token) throw new Error('No token');
    
    const response = await fetch(`${API_URL}/backups/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to download backup');
    }

    return await response.arrayBuffer();
  },

  async uploadBackup(buffer) {
    const token = localStorage.getItem('baton_token');
    if (!token) throw new Error('No token');
    
    const response = await fetch(`${API_URL}/backups/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      },
      body: buffer
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to upload backup');
    }

    return await response.json();
  }
};
