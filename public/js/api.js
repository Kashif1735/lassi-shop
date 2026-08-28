// Reusable API Client for Lassi Shop Orders & Dashboard
const BASE_URL = '/api';

const API = {
  // ── MENU ──────────────────────────────────────────────────────────────────
  async getMenu() {
    return this._request('/menu');
  },

  async createMenuItem(formData) {
    // multipart/form-data — let browser set boundary header automatically
    return this._request('/menu', { method: 'POST', body: formData });
  },

  async updateMenuItem(id, formData) {
    return this._request(`/menu?id=${encodeURIComponent(id)}`, { method: 'PUT', body: formData });
  },

  async deleteMenuItem(id) {
    return this._request(`/menu?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── TABLES ────────────────────────────────────────────────────────────────
  async getTables() {
    return this._request('/tables');
  },

  async createTable(number, name) {
    return this._request('/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, name })
    });
  },

  async deleteTable(id) {
    return this._request(`/tables?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── ORDERS ────────────────────────────────────────────────────────────────
  async getOrders() {
    return this._request('/orders');
  },

  async placeOrder(orderData) {
    return this._request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
  },

  async updateOrderStatus(id, status) {
    return this._request(`/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  },

  // ── INTERNAL ──────────────────────────────────────────────────────────────
  async _request(endpoint, options = {}) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');
      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      throw error;
    }
  }
};
