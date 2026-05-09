/**
 * API 客户端 - 与后端通信
 */
class ApiClient {
  constructor() {
    this.baseUrl = this.getBaseUrl();
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  }

  getBaseUrl() {
    // 生产环境使用当前域名，开发环境使用 localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '请求失败');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('网络连接失败，请检查网络');
      }
      throw err;
    }
  }

  // 认证相关
  async register(username, password, options = {}) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, ...options })
    });

    this.setAuth(data.token, data.user);
    return data;
  }

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    this.setAuth(data.token, data.user);
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async changePassword(oldPassword, newPassword) {
    return this.request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  isLoggedIn() {
    return !!this.token;
  }

  // 用户设置
  async getSettings() {
    return this.request('/user/settings');
  }

  async saveSettings(settings) {
    return this.request('/user/settings', {
      method: 'POST',
      body: JSON.stringify({ settings })
    });
  }

  async updateProfile(data) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // AI 功能
  async describeScene(imageBase64, context) {
    return this.request('/ai/describe', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64, context })
    });
  }

  async chat(message, module, conversationId) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, module, conversation_id: conversationId })
    });
  }

  // 统计
  async logUsage(action, module, details) {
    return this.request('/stats/log', {
      method: 'POST',
      body: JSON.stringify({ action, module, details })
    });
  }

  async getUserStats() {
    return this.request('/stats/user');
  }

  async getGlobalStats() {
    return this.request('/stats/global');
  }
}

// 导出单例
export const apiClient = new ApiClient();
