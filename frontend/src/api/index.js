import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

export const chatAPI = {
  sendMessage: (sessionId, message) => api.post('/chat', { sessionId, message }),
};

export const serviceAPI = {
  getAll: () => api.get('/services'),
};

export const doctorAPI = {
  getByCategory: (category) => api.get(`/doctors?category=${category}`),
  getAll: () => api.get('/doctors'),
};

export const appointmentAPI = {
  getAll: (params = {}) => api.get('/appointments', { params }),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
  findByPhone: (phone) => api.post('/appointments/find-by-phone', { phone }),
  findById: (bookingId) => api.get(`/appointments/find-by-id/${bookingId}`),
  cancel: (id) => api.put(`/appointments/${id}/cancel`),
  reschedule: (id, newDate, newTimeSlot) => api.put(`/appointments/${id}/reschedule`, { newDate, newTimeSlot }),
  getAvailability: (doctorId, date) => api.get(`/appointments/availability?doctorId=${doctorId}&date=${date}`),
};

export default api;
