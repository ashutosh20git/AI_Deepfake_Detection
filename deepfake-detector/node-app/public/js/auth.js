import { setAuthToken } from "./api.js";

export const OFFLINE_MODE = String(window.ENV?.OFFLINE_MODE || "false") === "true";

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function loginWithEmail(email, password, captchaToken = "frontend-mock-captcha") {
  if (OFFLINE_MODE) {
    const response = await fetch("/auth/offline/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, recoveryPassword: password, captchaToken }),
    });
    const data = await parseResponse(response);
    if (data.token) setAuthToken(data.token);
    return data;
  }
  throw new Error("Online auth flow is not wired in this environment. Enable OFFLINE_MODE=true.");
}

export async function registerWithEmail(email, password) {
  // This backend currently has no /auth/register endpoint.
  // Keep a predictable local onboarding flow.
  localStorage.setItem("pending_registration", JSON.stringify({ email, password }));
  return { email };
}

export async function setupRecoveryPassword(recoveryPassword) {
  const response = await fetch("/auth/offline/setup-recovery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("deepfake_token") || ""}`,
    },
    body: JSON.stringify({ recoveryPassword }),
  });
  return parseResponse(response);
}

export async function verifyRecoveryMfa(code) {
  const response = await fetch("/auth/offline/verify-recovery-mfa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("deepfake_token") || ""}`,
    },
    body: JSON.stringify({ code }),
  });
  return parseResponse(response);
}
