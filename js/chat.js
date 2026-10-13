import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";

const chatInboxNotice = document.getElementById("chatInboxNotice");
const chatInbox = document.getElementById("chatInbox");
const chatThread = document.getElementById("chatThread");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatBackButton = document.getElementById("chatBackButton");
const chatWithLabel = document.getElementById("chatWithLabel");
const accountChatButton = document.getElementById("accountChatButton");

let currentUser = null;
let isAdmin = false;
let activeChatId = null;
let activeBuyerEmail = "";
let unsubscribeMessages = null;
let unsubscribeInbox = null;

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function renderMessages(docsSnap) {
    if (!chatMessages) return;
    const sorted = docsSnap.slice().sort(function (a, b) { return (a.data().createdAt || 0) - (b.data().createdAt || 0); });
    chatMessages.innerHTML = sorted.map(function (docSnap) {
        const msg = docSnap.data();
        const mine = msg.senderRole === (isAdmin ? "admin" : "buyer");
        return '<div class="chat-bubble-row' + (mine ? " chat-bubble-row-mine" : "") + '">' +
            '<div class="chat-bubble ' + (mine ? "chat-bubble-mine" : "chat-bubble-other") + '">' +
            '<p>' + escapeHtml(msg.text) + '</p>' +
            '<span class="chat-bubble-time">' + formatTime(msg.createdAt) + '</span>' +
            '</div></div>';
    }).join("");
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function openThread(chatId, buyerEmail) {
    activeChatId = chatId;
    activeBuyerEmail = buyerEmail || "";
    if (chatWithLabel) chatWithLabel.textContent = isAdmin ? ("Chat dengan " + activeBuyerEmail) : "Chat dengan Penjual";
    if (chatInbox) chatInbox.style.display = "none";
    if (chatThread) chatThread.style.display = "block";
    if (chatBackButton) chatBackButton.style.display = isAdmin ? "inline-block" : "none";

    if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
    unsubscribeMessages = onSnapshot(collection(db, "chats", chatId, "messages"), function (snapshot) {
        renderMessages(snapshot.docs);
    });
}

window.openChatWith = function (chatId, buyerEmail) {
    if (typeof showPage === "function") showPage("chat");
    openThread(chatId, buyerEmail);
};

if (accountChatButton) {
    accountChatButton.addEventListener("click", function () {
        if (currentUser) window.openChatWith(currentUser.uid, currentUser.email);
    });
}

if (chatBackButton) {
    chatBackButton.addEventListener("click", function () {
        if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
        if (chatThread) chatThread.style.display = "none";
        if (chatInbox) chatInbox.style.display = "block";
    });
}

function renderInbox(docsSnap) {
    if (!chatInbox) return;
    const sorted = docsSnap.slice().sort(function (a, b) { return (b.data().lastMessageAt || 0) - (a.data().lastMessageAt || 0); });
    if (sorted.length === 0) { chatInbox.innerHTML = '<p class="order-hint">Belum ada chat masuk.</p>'; return; }
    chatInbox.innerHTML = sorted.map(function (docSnap) {
        const chat = docSnap.data();
        return '<button type="button" class="chat-inbox-item" data-id="' + docSnap.id + '" data-email="' + escapeHtml(chat.buyerEmail || "") + '">' +
            '<span class="chat-inbox-email">' + escapeHtml(chat.buyerEmail || "Pembeli") + '</span>' +
            '<span class="chat-inbox-preview">' + escapeHtml(chat.lastMessageText || "") + '</span>' +
            '</button>';
    }).join("");
}

if (chatInbox) {
    chatInbox.addEventListener("click", function (event) {
        const item = event.target.closest(".chat-inbox-item");
        if (!item) return;
        openThread(item.dataset.id, item.dataset.email);
    });
}

if (chatForm) {
    chatForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const text = chatInput.value.trim();
        if (!text || !activeChatId || !currentUser) return;
        const role = isAdmin ? "admin" : "buyer";
        addDoc(collection(db, "chats", activeChatId, "messages"), {
            senderId: currentUser.uid,
            senderRole: role,
            text: text,
            createdAt: Date.now()
        }).then(function () {
            return setDoc(doc(db, "chats", activeChatId), {
                buyerEmail: isAdmin ? activeBuyerEmail : currentUser.email,
                lastMessageText: text,
                lastMessageAt: Date.now()
            }, { merge: true });
        }).then(function () {
            chatInput.value = "";
        }).catch(function (error) {
            alert("Gagal kirim pesan: " + error.message);
        });
    });
}

onAuthStateChanged(auth, function (user) {
    currentUser = user;
    isAdmin = !!(user && user.email === ADMIN_EMAIL);

    if (unsubscribeInbox) { unsubscribeInbox(); unsubscribeInbox = null; }
    if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }

    if (!user) {
        if (chatInboxNotice) chatInboxNotice.style.display = "block";
        if (chatInbox) chatInbox.style.display = "none";
        if (chatThread) chatThread.style.display = "none";
        return;
    }

    if (chatInboxNotice) chatInboxNotice.style.display = "none";

    if (isAdmin) {
        if (chatThread) chatThread.style.display = "none";
        if (chatInbox) chatInbox.style.display = "block";
        unsubscribeInbox = onSnapshot(collection(db, "chats"), function (snapshot) {
            renderInbox(snapshot.docs);
        });
    } else {
        openThread(user.uid, user.email);
    }
});
