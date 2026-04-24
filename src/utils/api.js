const API = process.env.REACT_APP_API_BASE_URL;

export const cloudinaryOptimize = (url, width = 800) => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // FIX: Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${endpoint}`, { ...options, headers });

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    try { data = JSON.parse(text); } catch { data = {}; }
  }

  if (!res.ok) {
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