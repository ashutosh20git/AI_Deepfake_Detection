export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem("deepfake_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body && options.body instanceof FormData) {
    delete headers["Content-Type"];
  }
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (res.status === 401) {
    localStorage.removeItem("deepfake_token");
    window.location.href = "/login.html";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    throw new Error(data.error || "Server error occurred");
  }
  return data;
}

export const apiFetch = apiCall;

export async function authFetch(url, options = {}) {
  const token = localStorage.getItem("deepfake_token");
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("deepfake_token");
    window.location.href = "/login.html";
    throw new Error("Session expired");
  }
  return response;
}

export async function getCurrentUser() {
  try {
    return await apiCall("/me");
  } catch (error) {
    return null;
  }
}

export function getAuthToken() {
  return localStorage.getItem("deepfake_token");
}

export function setAuthToken(token) {
  if (!token) return;
  localStorage.setItem("deepfake_token", token);
}
