import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const authTabs = document.querySelectorAll("[data-auth-tab]");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const authLoggedOut = document.getElementById("authLoggedOut");
const authLoggedIn = document.getElementById("authLoggedIn");
const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const logoutButton = document.getElementById("logoutButton");

function showAuthTab(tab) {
  authTabs.forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.authTab === tab);
  });
  if (loginForm) loginForm.style.display = tab === "login" ? "block" : "none";
  if (registerForm) registerForm.style.display = tab === "register" ? "block" : "none";
}

authTabs.forEach(function (btn) {
  btn.addEventListener("click", function () {
    showAuthTab(btn.dataset.authTab);
  });
});

function terjemahkanError(code) {
  const pesan = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-not-found": "Email belum terdaftar.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email ini sudah terdaftar, coba masuk.",
    "auth/weak-password": "Password minimal 6 karakter."
  };
  return pesan[code] || "Terjadi kesalahan, coba lagi.";
}

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (loginError) loginError.textContent = "";
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    signInWithEmailAndPassword(auth, email, password).catch(function (error) {
      if (loginError) loginError.textContent = terjemahkanError(error.code);
    });
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (registerError) registerError.textContent = "";
    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    createUserWithEmailAndPassword(auth, email, password)
      .then(function (userCredential) {
        return updateProfile(userCredential.user, { displayName: name }).then(function () {
          if (accountName) accountName.textContent = name;
          if (accountEmail) accountEmail.textContent = userCredential.user.email;
        });
      })
      .catch(function (error) {
        if (registerError) registerError.textContent = terjemahkanError(error.code);
      });
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", function () {
    signOut(auth);
  });
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    if (authLoggedOut) authLoggedOut.style.display = "none";
    if (authLoggedIn) authLoggedIn.style.display = "block";
    if (accountName) accountName.textContent = user.displayName || "Pengguna";
    if (accountEmail) accountEmail.textContent = user.email;
  } else {
    if (authLoggedOut) authLoggedOut.style.display = "block";
    if (authLoggedIn) authLoggedIn.style.display = "none";
    showAuthTab("login");
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
  }
});
