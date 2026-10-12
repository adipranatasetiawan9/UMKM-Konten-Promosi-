import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const buyButton = document.getElementById("modalBuyButton");
const ordersList = document.getElementById("ordersList");
const ordersEmpty = document.getElementById("ordersEmpty");
const ordersLoginNotice = document.getElementById("ordersLoginNotice");

let currentUser = null;
let unsubscribeOrders = null;

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function labelStatus(status) {
    return { menunggu_pembayaran: "Menunggu Pembayaran", menunggu_konfirmasi: "Menunggu Konfirmasi Penjual", dibatalkan: "Dibatalkan" }[status] || status;
}

function tampilkanErrorFirestore(error) {
    if (error && error.code === "permission-denied") alert("Gagal: Firestore Rules belum di-publish.");
    else alert("Terjadi kesalahan: " + (error && error.message ? error.message : error));
    console.error(error);
}

function renderOrders(docsSnap) {
    if (!ordersList) return;
    const sorted = docsSnap.slice().sort(function(a, b) { return (b.data().createdAt || 0) - (a.data().createdAt || 0); });
    if (sorted.length === 0) { ordersList.innerHTML = ""; if (ordersEmpty) ordersEmpty.style.display = "block"; return; }
    if (ordersEmpty) ordersEmpty.style.display = "none";
    ordersList.innerHTML = sorted.map(function(docSnap) {
        const order = docSnap.data();
        const id = docSnap.id;
        let actionsHtml = "";
        if (order.status === "menunggu_pembayaran") {
            actionsHtml = '<img class="order-qris" src="assets/payment/qris-dana.jpg" alt="QRIS Pembayaran"><p class="order-hint">Scan QR di atas untuk membayar, lalu tap tombol di bawah.</p><div class="order-actions"><button type="button" class="button primary" data-action="bayar" data-id="' + id + '">Saya Sudah Bayar</button><button type="button" class="button secondary" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        } else if (order.status === "menunggu_konfirmasi") {
            actionsHtml = '<p class="order-hint">Menunggu konfirmasi penjual setelah pembayaran diterima.</p><div class="order-actions"><button type="button" class="button secondary" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        } else if (order.status === "dibatalkan") {
            actionsHtml = '<p class="order-hint">Pesanan ini sudah dibatalkan.</p>';
        }
        return '<div class="order-card"><div class="order-card-head"><h3>' + order.productName + '</h3><span class="order-status order-status-' + order.status + '">' + labelStatus(order.status) + '</span></div><p class="order-price">' + formatRupiah(order.productPrice) + '</p>' + actionsHtml + '</div>';
    }).join("");
}

if (ordersList) {
    ordersList.addEventListener("click", function(event) {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const newStatus = button.dataset.action === "bayar" ? "menunggu_konfirmasi" : "dibatalkan";
        updateDoc(doc(db, "orders", button.dataset.id), { status: newStatus }).catch(tampilkanErrorFirestore);
    });
}

if (buyButton) {
    buyButton.addEventListener("click", function() {
        if (!currentUser) {
            alert("Silakan masuk/daftar dulu sebelum membeli produk.");
            if (typeof closeProductModal === "function") closeProductModal();
            if (typeof showPage === "function") showPage("akun");
            return;
        }
        const product = window.selectedProductForPromo;
        if (!product) { alert("Produk tidak terdeteksi, coba buka ulang detail produknya."); return; }
        addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            status: "menunggu_pembayaran",
            createdAt: Date.now()
        }).then(function() {
            if (typeof closeProductModal === "function") closeProductModal();
            if (typeof showPage === "function") showPage("pesanan");
        }).catch(tampilkanErrorFirestore);
    });
}

onAuthStateChanged(auth, function(user) {
    currentUser = user;
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (user) {
        if (ordersLoginNotice) ordersLoginNotice.style.display = "none";
        const q = query(collection(db, "orders"), where("userId", "==", user.uid));
        unsubscribeOrders = onSnapshot(q, function(snapshot) { renderOrders(snapshot.docs); }, tampilkanErrorFirestore);
    } else {
        if (ordersLoginNotice) ordersLoginNotice.style.display = "block";
        if (ordersList) ordersList.innerHTML = "";
        if (ordersEmpty) ordersEmpty.style.display = "none";
    }
});

