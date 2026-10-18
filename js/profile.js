import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);
const MAX_SIZE = 1048;
const JPEG_QUALITY = 0.75;

const accountAvatar = document.getElementById("accountAvatar");
const accountPhotoInput = document.getElementById("accountPhotoInput");
const accountPhotoButton = document.getElementById("accountPhotoButton");
const tokoAvatar = document.getElementById("tokoAvatar");
const accountNameEl = document.getElementById("accountName");
const editNameButton = document.getElementById("editNameButton");
const editNameForm = document.getElementById("editNameForm");
const editNameInput = document.getElementById("editNameInput");
const editNameCancel = document.getElementById("editNameCancel");
const photoViewer = document.getElementById("photoViewer");
const photoViewerImage = document.getElementById("photoViewerImage");
const photoViewerImageWrap = document.getElementById("photoViewerImageWrap");
const photoViewerClose = document.getElementById("photoViewerClose");
const photoViewerChange = document.getElementById("photoViewerChange");
const photoViewerShare = document.getElementById("photoViewerShare");

let currentUser = null;
let isAdmin = false;
let unsubscribeMyProfile = null;
let myPhotoDataUrl = null;
let tokoPhotoDataUrl = null;

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
                resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
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

function openPhotoViewer(dataUrl, allowChange) {
    if (!dataUrl || !photoViewer) return;
    photoViewerImage.src = dataUrl;
    photoViewerImage.classList.remove("zoomed-img");
    if (photoViewerChange) photoViewerChange.style.display = allowChange ? "inline-block" : "none";
    photoViewer.classList.add("active");
}

if (accountAvatar) {
    accountAvatar.addEventListener("click", function () { openPhotoViewer(myPhotoDataUrl, true); });
}
if (tokoAvatar) {
    tokoAvatar.addEventListener("click", function () { openPhotoViewer(tokoPhotoDataUrl, false); });
}
if (photoViewerClose) {
    photoViewerClose.addEventListener("click", function () { photoViewer.classList.remove("active"); });
}
if (photoViewer) {
    photoViewer.addEventListener("click", function (event) { if (event.target === photoViewer) photoViewer.classList.remove("active"); });
}
if (photoViewerChange) {
    photoViewerChange.addEventListener("click", function () {
        photoViewer.classList.remove("active");
        if (accountPhotoInput) accountPhotoInput.click();
    });
}
if (photoViewerShare) {
    photoViewerShare.addEventListener("click", async function () {
        try {
            const response = await fetch(photoViewerImage.src);
            const blob = await response.blob();
            const file = new File([blob], "foto-profil.jpg", { type: "image/jpeg" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: "Foto Profil UMKM Promo" });
            } else {
                alert("Browser ini belum mendukung tombol bagikan langsung. Tekan & tahan foto di atas untuk simpan/bagikan manual.");
            }
        } catch (error) {
            if (error && error.name !== "AbortError") alert("Gagal membagikan foto.");
        }
    });
}

let lastImageTap = 0;
if (photoViewerImage) {
    photoViewerImage.addEventListener("touchend", function () {
        const now = Date.now();
        if (now - lastImageTap < 300) {
            photoViewerImage.classList.toggle("zoomed-img");
            if (photoViewerImageWrap) { photoViewerImageWrap.scrollLeft = 0; photoViewerImageWrap.scrollTop = 0; }
        }
        lastImageTap = now;
    });
    photoViewerImage.addEventListener("dblclick", function () {
        photoViewerImage.classList.toggle("zoomed-img");
    });
}

if (editNameButton) {
    editNameButton.addEventListener("click", function () {
        if (!currentUser || !editNameForm || !editNameInput) return;
        editNameInput.value = currentUser.displayName || "";
        editNameForm.style.display = "flex";
        editNameButton.style.display = "none";
    });
}
if (editNameCancel) {
    editNameCancel.addEventListener("click", function () {
        editNameForm.style.display = "none";
        editNameButton.style.display = "inline-block";
    });
}
if (editNameForm) {
    editNameForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const newName = editNameInput.value.trim();
        if (!newName || !currentUser) return;
        updateProfile(currentUser, { displayName: newName }).then(function () {
            if (accountNameEl) accountNameEl.textContent = newName;
            editNameForm.style.display = "none";
            editNameButton.style.display = "inline-block";
        }).catch(function (error) {
            alert("Gagal ubah nama: " + error.message);
        });
    });
}

onSnapshot(doc(db, "profiles", "toko"), function (docSnap) {
    const data = docSnap.exists() ? docSnap.data() : null;
    tokoPhotoDataUrl = data ? data.photoDataUrl : null;
    setAvatarImage(tokoAvatar, tokoPhotoDataUrl, "U");
});

onAuthStateChanged(auth, function (user) {
    currentUser = user;
    isAdmin = !!(user && user.email === ADMIN_EMAIL);
    if (unsubscribeMyProfile) { unsubscribeMyProfile(); unsubscribeMyProfile = null; }
    if (!user) {
        myPhotoDataUrl = null;
        setAvatarImage(accountAvatar, null, "?");
        return;
    }
    const docId = isAdmin ? "toko" : user.uid;
    const fallback = (user.displayName || user.email || "?").charAt(0).toUpperCase();
    unsubscribeMyProfile = onSnapshot(doc(db, "profiles", docId), function (docSnap) {
        const data = docSnap.exists() ? docSnap.data() : null;
        myPhotoDataUrl = data ? data.photoDataUrl : null;
        setAvatarImage(accountAvatar, myPhotoDataUrl, fallback);
    });
});
