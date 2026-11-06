import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const forgotButton = document.getElementById("forgotPasswordButton");
const loginEmail = document.getElementById("loginEmail");

if (forgotButton) {
    forgotButton.addEventListener("click", function () {
        const email = loginEmail ? loginEmail.value.trim() : "";
        if (!email) {
            alert("Isi dulu kolom Email di atas, lalu tekan Lupa password.");
            return;
        }
        sendPasswordResetEmail(auth, email).then(function () {
            alert("Jika email " + email + " terdaftar, link reset password sudah dikirim. Cek Kotak Masuk dan folder Spam.");
        }).catch(function (error) {
            if (error.code === "auth/invalid-email") alert("Format email tidak valid.");
            else alert("Gagal mengirim link reset: " + error.message);
        });
    });
}
