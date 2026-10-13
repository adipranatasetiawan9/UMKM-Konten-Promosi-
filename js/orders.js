import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, runTransaction, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const buyButton = document.getElementById("modalBuyButton");
const ordersList = document.getElementById("ordersList");
const ordersEmpty = document.getElementById("ordersEmpty");
const ordersLoginNotice = document.getElementById("ordersLoginNotice");

let currentUser = null;
let unsubscribeOrders = null;
let stockMap = {};

const PAYMENT_METHODS = ["BRI", "BCA", "Mandiri", "BNI", "DANA", "OVO", "GoPay", "ShopeePay"];

function paymentBadgesHtml() {
    return '<div class="payment-methods">' +
        PAYMENT_METHODS.map(function (name) { return '<span class="payment-badge">' + name + '</span>'; }).join("") +
        '</div>';
}

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function labelStatus(status) {
    return { menunggu_pembayaran: "Menunggu Pembayaran", menunggu_konfirmasi: "Menunggu Konfirmasi Penjual", dibatalkan: "Dibatalkan" }[status] || status;
}

function tampilkanErrorFirestore(error) {
    if (error && error.message === "STOK_HABIS") { alert("Maaf, stok produk ini sudah habis."); return; }
    if (error && error.code === "permission-denied") alert("Gagal: Firestore Rules belum di-publish.");
    else alert("Terjadi kesalahan: " + (error && error.message ? error.message : error));
    console.error(error);
}

function updateStockDisplay() {
    document.querySelectorAll(".product-stock").forEach(function (el) {
        const qty = stockMap[el.dataset.stockId];
        if (qty === undefined) { el.textContent = ""; return; }
        el.textContent = qty > 0 ? "Stok: " + qty : "Stok Habis";
        el.classList.toggle("stock-habis", qty <= 0);
    });
}

window.onProductsRendered = updateStockDisplay;

window.onProductDetailShown = function (product) {
    const qty = stockMap[product.id];
    const modalStockEl = document.getElementById("modalProductStock");
    if (modalStockEl) modalStockEl.textContent = qty === undefined ? "Memuat stok..." : (qty > 0 ? "Stok tersedia: " + qty : "Stok Habis");
    if (buyButton) buyButton.disabled = !(qty > 0);
};

onSnapshot(collection(db, "stock"), function (snapshot) {
    snapshot.forEach(function (docSnap) { stockMap[docSnap.id] = docSnap.data().quantity; });
    updateStockDisplay();
    if (window.selectedProductForPromo) window.onProductDetailShown(window.selectedProductForPromo);
});

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
            actionsHtml = '<img class="order-qris" src="assets/payment/qris-dana.jpg" alt="QRIS Pembayaran">' +
                paymentBadgesHtml() +
                '<p class="order-hint">Scan QR di atas pakai aplikasi bank/e-wallet mana pun, lalu tap tombol di bawah.</p>' +
                '<div class="order-actions"><button type="button" class="button primary" data-action="bayar" data-id="' + id + '">Saya Sudah Bayar</button><button type="button" class="button secondary" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        } else if (order.status === "menunggu_konfirmasi") {
            actionsHtml = '<p class="order-hint">Menunggu konfirmasi penjual setelah pembayaran diterima.</p><div class="order-actions"><button type="button" class="button secondary" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        } else if (order.status === "dibatalkan") {
            actionsHtml = '<p class="order-hint">Pesanan ini sudah dibatalkan.</p>';
        }
        return '<div class="order-card"><div class="order-card-head"><h3>' + order.productName + '</h3><span class="order-status order-status-' + order.status + '">' + labelStatus(order.status) + '</span></div><p class="order-price">' + formatRupiah(order.productPrice) + '</p>' + actionsHtml + '</div>';
    }).join("");
}

if (ordersList) {
    ordersList.addEventListener("click", function (event) {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const orderId = button.dataset.id;
        const orderRef = doc(db, "orders", orderId);

        if (button.dataset.action === "bayar") {
            updateDoc(orderRef, { status: "menunggu_konfirmasi" }).catch(tampilkanErrorFirestore);
            return;
        }

        runTransaction(db, async function (transaction) {
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) return;
            const order = orderSnap.data();
            if (order.status === "dibatalkan") return;
            const stockRef = doc(db, "stock", String(order.productId));
            const stockSnap = await transaction.get(stockRef);
            const currentQty = stockSnap.exists() ? stockSnap.data().quantity : 0;
            transaction.update(stockRef, { quantity: currentQty + 1 });
            transaction.update(orderRef, { status: "dibatalkan" });
        }).catch(tampilkanErrorFirestore);
    });
}

if (buyButton) {
    buyButton.addEventListener("click", function () {
        if (!currentUser) {
            alert("Silakan masuk/daftar dulu sebelum membeli produk.");
            if (typeof closeProductModal === "function") closeProductModal();
            if (typeof showPage === "function") showPage("akun");
            return;
        }
        const product = window.selectedProductForPromo;
        if (!product) { alert("Produk tidak terdeteksi, coba buka ulang detail produknya."); return; }

        const stockRef = doc(db, "stock", String(product.id));
        const newOrderRef = doc(collection(db, "orders"));

        runTransaction(db, async function (transaction) {
            const stockSnap = await transaction.get(stockRef);
            const qty = stockSnap.exists() ? stockSnap.data().quantity : 0;
            if (qty <= 0) throw new Error("STOK_HABIS");
            transaction.update(stockRef, { quantity: qty - 1 });
            transaction.set(newOrderRef, {
                userId: currentUser.uid,
                productId: product.id,
                productName: product.name,
                productPrice: product.price,
                status: "menunggu_pembayaran",
                createdAt: Date.now()
            });
        }).then(function () {
            if (typeof closeProductModal === "function") closeProductModal();
            if (typeof showPage === "function") showPage("pesanan");
        }).catch(tampilkanErrorFirestore);
    });
}

onAuthStateChanged(auth, function (user) {
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
