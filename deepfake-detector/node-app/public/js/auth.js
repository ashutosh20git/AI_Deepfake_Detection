import { apiCall } from './api.js';

export async function loginWithEmail(email, password) {
  const result = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || 'Login failed');
  
  localStorage.setItem('deepfake_token', data.token);
  return data;
}

export async function loginWithMfa(email, password, mfaToken) {
    const result = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, mfaToken })
    });
    
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || 'Login failed');
    
    localStorage.setItem('deepfake_token', data.token);
    return data;
}
  
export async function registerWithEmail(email, password) {
  const result = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || 'Registration failed');
  
  // Registration typically returns token if auto-logged in, depends on backend
  if (data.token) localStorage.setItem('deepfake_token', data.token);
  return data;
}
