export const OFFLINE_MODE = String(window.ENV?.OFFLINE_MODE || "false") === "true";

export const firebasePublicConfig = {
  apiKey: window.ENV?.FIREBASE_API_KEY || "",
  authDomain: window.ENV?.FIREBASE_AUTH_DOMAIN || "",
  projectId: window.ENV?.FIREBASE_PROJECT_ID || "",
  appId: window.ENV?.FIREBASE_APP_ID || "",
  messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "",
};
