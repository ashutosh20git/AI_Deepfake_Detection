// A lightweight fetch wrapper handling our auth token automatically
export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('deepfake_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle FormData where Content-Type shouldn't be overridden explicitly
  if (options.body && options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(\`/api\${endpoint}\`, {
    ...options,
    headers
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  // Handle 401 Unauthorized globally
  if (res.status === 401) {
    localStorage.removeItem('deepfake_token');
    window.location.href = '/login.html';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    throw new Error(data.error || 'Server error occurred');
  }

  return data;
}

export async function getCurrentUser() {
  try {
    return await apiCall('/me');
  } catch (error) {
    return null;
  }
}
