const OFFLINE_MODE = window.ENV?.OFFLINE_MODE === 'true';

let auth = null;
let signInWithEmailAndPassword = null;
let createUserWithEmailAndPassword = null;
let getIdToken = null;

if (!OFFLINE_MODE) {
  // Try to load Firebase natively if loaded in head
  const checkFirebase = setInterval(() => {
    if (window.firebase) {
      clearInterval(checkFirebase);
      console.log('Firebase SDK loaded globally, ready for bindings if needed.');
    }
  }, 100);
}

export { OFFLINE_MODE };
