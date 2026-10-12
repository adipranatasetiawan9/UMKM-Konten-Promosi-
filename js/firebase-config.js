import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaX2RW6TVuqaA-aJ8pW0jWscau8qGEiOE",
  authDomain: "umkm-promo-web.firebaseapp.com",
  projectId: "umkm-promo-web",
  storageBucket: "umkm-promo-web.firebasestorage.app",
  messagingSenderId: "383269837830",
  appId: "1:383269837830:web:82a828c428f0b43ff6b787"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
