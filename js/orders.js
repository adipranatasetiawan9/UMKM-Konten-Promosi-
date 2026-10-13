import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, runTransaction, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const buyButton = document.getElementById("modalBuyButton");
const paymentMethodSelect = document.getElementById("modalPaymentMethod");
const ordersList = document.getElementById("ordersList");
const ordersEmpty = document.getElementById("ordersEmpty");
const ordersLoginNotice = document.getElementById("ordersLoginNotice");

let currentUser = null;
let unsubscribeOrders = null;
let stockMap = {};

const STAGE_ORDER = ["menunggu_pembayaran", "menunggu_konfirmasi", "diproses", "dikemas", "dikirim", "selesai"];
const STAGE_LABEL = {
    menunggu_pembayaran: "Pesanan Dibuat",
    menunggu_konfirmasi: "Menunggu Konfirmasi",
    diproses: "Diproses",
    dikemas: "Dikemas",
    dikirim: "Dikirim",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan"
};

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function findProductImage(productId) {
    const product = products.find(function (p) { return p.id === productId; });
    return product ? product.image : "";
}

function paymentInstruction(method) {
    if (method && method.indexOf("Transfer Bank") === 0) {
        return "Buka aplikasi mobile banking kamu (" + method.replace("Transfer Bank ", "") + "), pilih menu Transfer/QRIS, lalu scan kode di bawah.";
    }
    return "Buka aplikasi " + method + ", pilih menu Bayar/Scan QR, lalu scan kode di bawah.";
}

function stepperHtml(status) {
    if (status === "dibatalkan") return '<div class="order-cancelled-banner">Pesanan ini sudah dibatalkan.</div>';
    const currentIndex = STAGE_ORDER.indexOf(status);
    return '<div class="order-stepper">' +
        STAGE_ORDER.map(function (stage, i) {
            const state = i < currentIndex ? "done" : (i === currentIndex ? "current" : "upcoming");
            return '<div class="order-step order-step-' + state + '"><span class="order-step-dot"></span><span class="order-step-label">' + STAGE_LABEL[stage] + '</span></div>';
        }).join("") +
        '</div>';
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
    const sorted = docsSnap.slice().sort(function (a, b) { return (b.data().createdAt || 0) - (a.data().createdAt || 0); });
    if (sorted.length === 0) { ordersList.innerHTML = ""; if (ordersEmpty) ordersEmpty.style.display = "block"; return; }
    if (ordersEmpty) ordersEmpty.style.display = "none";
    ordersList.innerHTML = sorted.map(function (docSnap) {
        const order = docSnap.data();
        const id = docSnap.id;
        const imgSrc = findProductImage(order.productId);
        let paymentHtml = "";
        let actionsHtml = "";
        if (order.status === "menunggu_pembayaran") {
            paymentHtml = '<p class="order-payment-method">Metode: ' + (order.paymentMethod || "-") + '</p>' +
                '<img class="order-qris" src="assets/payment/qris-dana.jpg" alt="QRIS Pembayaran">' +
                '<p class="order-hint">' + paymentInstruction(order.paymentMethod) + '</p>';
            actionsHtml = '<div class="order-actions"><button type="button" class="button primary" data-action="bayar" data-id="' + id + '">Saya Sudah Bayar</button><button type="button" class="button secondary" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        } else if (order.status === "menunggu_konfirmasi") {
            actionsHtml = '<div class="order-actions"><button type="button" class="button secondary" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        }
        return '<div class="order-card">' +
            '<div class="order-card-top">' +
            (imgSrc ? '<img class="order-product-image" src="' + imgSrc + '" alt="' + order.productName + '">' : '') +
            '<div class="order-card-head"><h3>' + order.productName + '</h3><span class="order-status order-status-' + order.status + '">' + (STAGE_LABEL[order.status] || order.status) + '</span></div>' +
            '</div>' +
            '<p class="order-price">' + formatRupiah(order.productPrice) + '</p>' +
            '<button type="button" class="button secondary order-chat-button" data-action="chat">💬 Chat Penjual</button>' +
            stepperHtml(order.status) + paymentHtml + actionsHtml + '</div>';
    }).join("");
}

if (ordersList) {
    ordersList.addEventListener("click", function (event) {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        if (button.dataset.action === "chat") {
            if (currentUser) window.openChatWith(currentUser.uid, currentUser.email);
            return;
        }

        const orderId = button.dataset.id;
        const orderRef = doc(db, "orders", orderId);

        if (button.dataset.action === "bayar") {
            updateDoc(orderRef, { status: "menunggu_konfirmasi", statusUpdatedAt: Date.now() }).catch(tampilkanErrorFirestore);
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
            transaction.update(orderRef, { status: "dibatalkan", statusUpdatedAt: Date.now() });
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

        const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "QRIS";
        const stockRef = doc(db, "stock", String(product.id));
        const newOrderRef = doc(collection(db, "orders"));

        runTransaction(db, async function (transaction) {
            const stockSnap = await transaction.get(stockRef);
            const qty = stockSnap.exists() ? stockSnap.data().quantity : 0;
            if (qty <= 0) throw new Error("STOK_HABIS");
            transaction.update(stockRef, { quantity: qty - 1 });
            transaction.set(newOrderRef, {
                userId: currentUser.uid,
                buyerEmail: currentUser.email,
                productId: product.id,
                productName: product.name,
                productPrice: product.price,
                paymentMethod: paymentMethod,
                status: "menunggu_pembayaran",
                statusUpdatedAt: Date.now(),
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
        unsubscribeOrders = onSnapshot(q, function (snapshot) { renderOrders(snapshot.docs); }, tampilkanErrorFirestore);
    } else {
        if (ordersLoginNotice) ordersLoginNotice.style.display = "block";
        if (ordersList) ordersList.innerHTML = "";
        if (ordersEmpty) ordersEmpty.style.display = "none";
    }
});
