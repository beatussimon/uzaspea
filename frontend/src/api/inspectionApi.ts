import api from '../api';

const BASE = '/api/inspections';

export const inspectionApi = {
  // Categories
  categories: {
    list: () => api.get(`${BASE}/categories/`),
    all: () => api.get(`${BASE}/categories/?all=1`),
    create: (data: any) => api.post(`${BASE}/categories/`, data),
    update: (id: number, data: any) => api.patch(`${BASE}/categories/${id}/`, data),
    delete: (id: number) => api.delete(`${BASE}/categories/${id}/`),
  },

  // Templates
  templates: {
    list: () => api.get(`${BASE}/templates/`),
    forCategory: (categoryId: number) => api.get(`${BASE}/templates/for-category/${categoryId}/`),
    create: (data: any) => api.post(`${BASE}/templates/`, data),
    addItem: (templateId: number, data: any) =>
      api.post(`${BASE}/templates/${templateId}/items/`, data),
  },

  // Inspectors
  inspectors: {
    list: () => api.get(`${BASE}/inspectors/`),
    available: (categoryId?: number, all = false) => {
      let url = `${BASE}/inspectors/available/`;
      const params = new URLSearchParams();
      if (categoryId) params.append('category_id', String(categoryId));
      if (all) params.append('all', 'true');
      const qs = params.toString();
      return api.get(qs ? `${url}?${qs}` : url);
    },
    me: () => api.get(`${BASE}/inspectors/me/`),
    create: (data: any) => api.post(`${BASE}/inspectors/`, data),
    update: (id: number, data: any) => api.patch(`${BASE}/inspectors/${id}/`, data),
    performance: () => api.get(`${BASE}/inspector-performance/`),
  },

  // Requests
  requests: {
    list: (params: any = {}) => api.get(`${BASE}/requests/`, { params }),
    get: (id: number) => api.get(`${BASE}/requests/${id}/`),
    create: (data: any) => api.post(`${BASE}/requests/`, data),
    myJobs: () => api.get(`${BASE}/requests/my-jobs/`),
    generateBill: (id: number, data?: any) =>
      api.post(`${BASE}/requests/${id}/generate-bill/`, data || {}),
    assign: (id: number, data: any) => api.post(`${BASE}/requests/${id}/assign/`, data),
    updateStatus: (id: number, status: string) =>
      api.post(`${BASE}/requests/${id}/update-status/`, { status }),
    acknowledgeBill: (id: number) =>
      api.post(`${BASE}/requests/${id}/acknowledge-bill/`),
    verify: (inspectionId: string) => api.get(`${BASE}/verify/${inspectionId}/`),
    stats: () => api.get(`${BASE}/requests/dashboard-stats/`),
    prefillMarketplace: (productId: number) => 
      api.get(`${BASE}/requests/prefill-marketplace/?product_id=${productId}`),
  },

  // Payments
  payments: {
    list: () => api.get(`${BASE}/payments/`),
    pending: () => api.get(`${BASE}/payments/pending/`),
    submit: (data: FormData) =>
      api.post(`${BASE}/payments/`, data),
    approve: (id: number) => api.post(`${BASE}/payments/${id}/approve/`),
    reject: (id: number, reason: string) =>
      api.post(`${BASE}/payments/${id}/reject/`, { reason }),
  },

  // Check-in
  checkin: {
    submit: (data: FormData) =>
      api.post(`${BASE}/checkins/`, data),
    checkout: (requestId: number, data: FormData) =>
      api.post(`${BASE}/checkins/checkout/${requestId}/`, data),
  },

  // Evidence
  evidence: {
    submit: (data: FormData) =>
      api.post(`${BASE}/evidence/`, data),
    listForRequest: (requestId: number) =>
      api.get(`${BASE}/evidence/?request=${requestId}`),
  },

  // Reports
  reports: {
    submit: (data: any) => api.post(`${BASE}/reports/`, data),
    finalize: (id: number, data: { verdict: string; summary: string }) =>
      api.patch(`${BASE}/reports/${id}/finalize/`, data),
    qaQueue: () => api.get(`${BASE}/reports/qa-queue/`),
    approve: (id: number) => api.post(`${BASE}/reports/${id}/approve/`),
    returnForRevision: (id: number, notes: string) =>
      api.post(`${BASE}/reports/${id}/return-for-revision/`, { notes }),
  },

  // Checklist responses
  responses: {
    submit: (data: any) => api.post(`${BASE}/responses/`, data),
    bulkSubmit: (items: any[]) =>
      Promise.all(items.map((item) => api.post(`${BASE}/responses/`, item))),
  },

  // Notifications
  notifications: {
    list: () => api.get(`${BASE}/notifications/`),
    unreadCount: () => api.get(`${BASE}/notifications/unread-count/`),
    markRead: (id: number) => api.post(`${BASE}/notifications/${id}/mark-read/`),
    markAllRead: () => api.post(`${BASE}/notifications/mark-all-read/`),
  },

  // Re-inspection
  reinspection: {
    create: (data: any) => api.post(`${BASE}/reinspections/`, data),
    list: () => api.get(`${BASE}/reinspections/`),
  },

  // Fraud flags
  fraudFlags: {
    list: () => api.get(`${BASE}/fraud-flags/`),
    resolve: (id: number) => api.post(`${BASE}/fraud-flags/${id}/resolve/`),
  },
};

export default inspectionApi;
