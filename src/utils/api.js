const API = process.env.REACT_APP_API_BASE_URL;

export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // FIX: Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    // FIX: Handle both flat string errors and nested error objects
    // API controllers return { error: "string" }
    // Global errorHandler was returning { error: { message: "..." } } (now fixed)
    // This safely handles both formats as a fallback
    let errorMsg;
    if (typeof data.error === 'string') {
      errorMsg = data.error;
    } else if (data.error && typeof data.error === 'object') {
      errorMsg = data.error.message || 'Something went wrong';
    } else {
      errorMsg = data.message || `Request failed (${res.status})`;
    }
    throw new Error(errorMsg);
  }

  return data;
};