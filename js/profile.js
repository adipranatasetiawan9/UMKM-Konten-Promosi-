import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);
const MAX_SIZE = 160;

const accountAvatar = document.getElementById("accountAvatar");
const accountPhotoInput = document.getElementById("accountPhotoInput");
const accountPhotoButton = document.getElementById("accountPhotoButton");
const tokoAvatar = document.getElementById("tokoAvatar");

let currentUser = null;
let isAdmin = false;
let unsubscribeMyProfile = null;

function resizeToDataUrl(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement("canvas");
                canvas.width = MAX_SIZE;
                canvas.height = MAX_SIZE;
                const ctx = canvas.getContext("2d");
                const scale = Math.max(MAX_SIZE / img.width, MAX_SIZE / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (MAX_SIZE - w) / 2, (MAX_SIZE - h) / 2, w, h);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function setAvatarImage(el, dataUrl, fallbackLetter) {
    if (!el) return;
    el.innerHTML = dataUrl
        ? '<img src="' + dataUrl + '" alt="Foto profil">'
        : '<span class="avatar-fallback">' + (fallbackLetter || "?") + '</span>';
}

if (accountPhotoButton) {
    accountPhotoButton.addEventListener("click", function () {
        if (accountPhotoInput) accountPhotoInput.click();
    });
}

if (accountPhotoInput) {
    accountPhotoInput.addEventListener("change", function () {
        const file = accountPhotoInput.files[0];
        if (!file || !currentUser) return;
        resizeToDataUrl(file).then(function (dataUrl) {
            const docId = isAdmin ? "toko" : currentUser.uid;
            return setDoc(doc(db, "profiles", docId), { photoDataUrl: dataUrl }, { merge: true });
        }).catch(function (error) {
            alert("Gagal mengunggah foto: " + error.message);
        });
    });
}

onSnapshot(doc(db, "profiles", "toko"), function (docSnap) {
    const data = docSnap.exists() ? docSnap.data() : null;
    setAvatarImage(tokoAvatar, data ? data.photoDataUrl : null, "U");
});

onAuthStateChanged(auth, function (user) {
    currentUser = user;
    isAdmin = !!(user && user.email === ADMIN_EMAIL);
    if (unsubscribeMyProfile) { unsubscribeMyProfile(); unsubscribeMyProfile = null; }
    if (!user) {
        setAvatarImage(accountAvatar, null, "?");
        return;
    }
    const docId = isAdmin ? "toko" : user.uid;
    const fallback = (user.displayName || user.email || "?").charAt(0).toUpperCase();
    unsubscribeMyProfile = onSnapshot(doc(db, "profiles", docId), function (docSnap) {
        const data = docSnap.exists() ? docSnap.data() : null;
        setAvatarImage(accountAvatar, data ? data.photoDataUrl : null, fallback);
    });
});
