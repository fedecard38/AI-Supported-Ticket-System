const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // If uninitialized, backend returns 428 Precondition Required
    if (response.status === 428) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError('Setup Required: Application is not yet initialized.', 428, data);
    }

    if (!response.ok) {
      let errorDetail = `HTTP error ${response.status}`;
      let errorData = null;
      try {
        errorData = await response.json();
        if (errorData?.detail) {
          errorDetail = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        }
      } catch {
        // use fallback message
      }
      throw new ApiError(errorDetail, response.status, errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network connection error', 0, null);
  }
}

export const api = {
  // System & Health
  checkHealth: () => request('/health'),
  getSetupStatus: () => request('/api/setup/status'),
  initializeSystem: (payload) =>
    request('/api/setup/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  factoryReset: (payload) =>
    request('/api/setup/factory-reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateGeminiKey: (payload) =>
    request('/api/setup/gemini-key', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Tickets
  listTickets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.status) query.append('status', params.status);
    if (params.priority) query.append('priority', params.priority);
    const queryString = query.toString();
    return request(`/api/tickets${queryString ? `?${queryString}` : ''}`);
  },

  getTicket: (id) => request(`/api/tickets/${id}`),

  createTicket: (payload) =>
    request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTicket: (id, payload) =>
    request(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTicket: (id) =>
    request(`/api/tickets/${id}`, {
      method: 'DELETE',
    }),

  // AI Triage
  triageTicket: (payload) =>
    request('/api/tickets/triage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Comments
  listComments: (ticketId) => request(`/api/tickets/${ticketId}/comments`),

  addComment: (ticketId, payload) =>
    request(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Users / Leads
  listUsers: () => request('/api/users'),

  createUser: (payload) =>
    request('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (id, payload) =>
    request(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteUser: (id) =>
    request(`/api/users/${id}`, {
      method: 'DELETE',
    }),

  // Auth / Login
  login: (payload) =>
    request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export default api;
