import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);
const CLEANUP_MS = 24 * 60 * 60 * 1000;

const buyerOrdersView = document.getElementById("buyerOrdersView");
const adminOrdersView = document.getElementById("adminOrdersView");
const adminOrdersList = document.getElementById("adminOrdersList");
const photoViewer = document.getElementById("photoViewer");
const photoViewerImage = document.getElementById("photoViewerImage");
const photoViewerChange = document.getElementById("photoViewerChange");
const resiModalEl = document.getElementById("resiModal");
const resiInput = document.getElementById("resiInput");
const resiSaveButton = document.getElementById("resiSaveButton");

const STAGE_ORDER = ["menunggu_pembayaran", "menunggu_konfirmasi", "diproses", "dikemas", "dikirim", "selesai"];
const STAGE_LABEL = {
    menunggu_pembayaran: "Menunggu Pembayaran",
    menunggu_konfirmasi: "Menunggu Konfirmasi",
    diproses: "Diproses",
    dikemas: "Dikemas",
    dikirim: "Dikirim",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan"
};
const STATUS_BADGE = {
    menunggu_pembayaran: "text-bg-warning",
    menunggu_konfirmasi: "text-bg-info",
    diproses: "text-bg-primary",
    dikemas: "text-bg-primary",
    dikirim: "text-bg-primary",
    selesai: "text-bg-success",
    dibatalkan: "text-bg-danger"
};

let lastAdminOrdersSnap = [];
let reviewsByOrderId = {};
let pendingShipOrderId = null;

function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function findProductImage(productId) {
    const product = products.find(function (p) { return p.id === productId; });
    return product ? product.image : "";
}

function starsHtml(rating) {
    let html = "";
    for (let i = 1; i <= 5; i++) html += i <= Math.round(rating) ? "★" : "☆";
    return html;
}

function orderItems(order) {
    if (Array.isArray(order.items) && order.items.length > 0) return order.items;
    return [{ productId: order.productId, name: order.productName, price: order.productPrice, qty: order.quantity || 1 }];
}

function orderTotal(order) {
    if (typeof order.totalPrice === "number") return order.totalPrice;
    return orderItems(order).reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
}

function itemsHtml(order) {
    return '<div class="d-flex flex-column gap-2 my-2">' + orderItems(order).map(function (it) {
        const img = findProductImage(it.productId);
        return '<div class="d-flex gap-2 align-items-center">' +
            (img ? '<img class="rounded" style="width:48px;height:48px;object-fit:cover;" src="' + esc(img) + '" alt="">' : '') +
            '<div class="small"><div class="fw-semibold">' + esc(it.name) + '</div><div class="text-muted">' + it.qty + ' × ' + formatRupiah(it.price) + '</div></div>' +
            '</div>';
    }).join("") + '</div>';
}

function shippingHtml(order) {
    if (!order.address) return "";
    return '<div class="bg-light rounded p-2 small my-2">' +
        '<div><strong>Penerima:</strong> ' + esc(order.recipientName) + ' · ' + esc(order.phone) + '</div>' +
        '<div>' + esc(order.address) + '</div>' +
        '<div><strong>Kurir:</strong> ' + esc(order.courier || "-") + '</div>' +
        (order.trackingNumber ? '<div><strong>No. Resi:</strong> ' + esc(order.trackingNumber) + '</div>' : '') +
        '</div>';
}

function reviewsHtml(orderId) {
    return (reviewsByOrderId[orderId] || []).map(function (r) {
        return '<div class="border-top pt-2 mt-2 small">' +
            '<div class="fw-semibold">Ulasan ' + esc(r.productName || "") + ' dari ' + esc(r.buyerEmail || "pembeli") + '</div>' +
            '<div class="text-warning">' + starsHtml(r.rating) + '</div>' +
            '<div>' + esc(r.comment || "(tanpa komentar)") + '</div></div>';
    }).join("");
}

function nextStageButton(order, id) {
    if (order.status === "dibatalkan") return "";
    const idx = STAGE_ORDER.indexOf(order.status);
    if (idx === -1 || idx === STAGE_ORDER.length - 1) return "";
    const nextStage = STAGE_ORDER[idx + 1];
    return '<button type="button" class="btn btn-success btn-sm admin-order-advance" data-id="' + id + '" data-next="' + nextStage + '">Tandai: ' + STAGE_LABEL[nextStage] + '</button>';
}

function cleanupOldOrders(docsSnap) {
    docsSnap.forEach(function (docSnap) {
        const order = docSnap.data();
        const isFinished = order.status === "selesai" || order.status === "dibatalkan";
        const referenceTime = order.statusUpdatedAt || order.createdAt || 0;
        const isOld = referenceTime > 0 && (Date.now() - referenceTime > CLEANUP_MS);
        if (isFinished && isOld) {
            if (order.hasProof) deleteDoc(doc(db, "proofs", docSnap.id)).catch(function () {});
            deleteDoc(doc(db, "orders", docSnap.id)).catch(function () {});
        }
    });
}

function renderAdminOrders(docsSnap) {
    if (!adminOrdersList) return;
    const sorted = docsSnap.slice().sort(function (a, b) { return (b.data().createdAt || 0) - (a.data().createdAt || 0); });
    if (sorted.length === 0) { adminOrdersList.innerHTML = '<div class="alert alert-light border">Belum ada pesanan masuk.</div>'; return; }
    adminOrdersList.innerHTML = sorted.map(function (docSnap) {
        const order = docSnap.data();
        const id = docSnap.id;
        const canCancel = order.status !== "dibatalkan" && order.status !== "selesai";
        return '<div class="card border-0 shadow-sm mb-3"><div class="card-body">' +
            '<div class="d-flex justify-content-between align-items-center"><h3 class="h6 mb-0">Pesanan #' + id.slice(-6).toUpperCase() + '</h3><span class="badge ' + (STATUS_BADGE[order.status] || "text-bg-secondary") + '">' + (STAGE_LABEL[order.status] || order.status) + '</span></div>' +
            itemsHtml(order) +
            '<p class="fw-bold text-success mb-1">Total: ' + formatRupiah(orderTotal(order)) + '</p>' +
            '<p class="small text-muted mb-2">Pembeli: ' + esc(order.buyerEmail || "-") + ' · ' + esc(order.paymentMethod || "-") + '</p>' +
            shippingHtml(order) +
            reviewsHtml(id) +
            '<div class="d-flex flex-wrap gap-2 mt-3">' +
            '<button type="button" class="btn btn-outline-secondary btn-sm admin-order-chat" data-buyer-id="' + esc(order.userId) + '" data-buyer-email="' + esc(order.buyerEmail || "") + '">💬 Chat Pembeli</button>' +
            (order.hasProof ? '<button type="button" class="btn btn-outline-secondary btn-sm admin-order-proof" data-id="' + id + '">📎 Lihat Bukti Bayar</button>' : '') +
            nextStageButton(order, id) +
            (canCancel ? '<button type="button" class="btn btn-outline-danger btn-sm admin-order-cancel" data-id="' + id + '">Batalkan</button>' : '') +
            '</div></div></div>';
    }).join("");
}

async function showProof(orderId) {
    try {
        const snap = await getDoc(doc(db, "proofs", orderId));
        if (!snap.exists()) { alert("Bukti bayar tidak ditemukan."); return; }
        photoViewerImage.src = snap.data().dataUrl;
        photoViewerImage.classList.remove("zoomed-img");
        if (photoViewerChange) photoViewerChange.style.display = "none";
        bootstrap.Modal.getOrCreateInstance(photoViewer).show();
    } catch (error) {
        alert("Gagal membuka bukti bayar: " + error.message);
    }
}

if (resiSaveButton) {
    resiSaveButton.addEventListener("click", function () {
        if (!pendingShipOrderId) return;
        const payload = { status: "dikirim", statusUpdatedAt: Date.now() };
        const resi = resiInput.value.trim();
        if (resi) payload.trackingNumber = resi;
        const orderId = pendingShipOrderId;
        pendingShipOrderId = null;
        bootstrap.Modal.getOrCreateInstance(resiModalEl).hide();
        updateDoc(doc(db, "orders", orderId), payload)
            .catch(function (error) { alert("Gagal update: " + error.message); });
    });
}

if (adminOrdersList) {
    adminOrdersList.addEventListener("click", function (event) {
        const advanceBtn = event.target.closest(".admin-order-advance");
        const cancelBtn = event.target.closest(".admin-order-cancel");
        const chatBtn = event.target.closest(".admin-order-chat");
        const proofBtn = event.target.closest(".admin-order-proof");

        if (chatBtn) {
            window.openChatWith(chatBtn.dataset.buyerId, chatBtn.dataset.buyerEmail);
            return;
        }

        if (proofBtn) {
            showProof(proofBtn.dataset.id);
            return;
        }

        if (advanceBtn) {
            const next = advanceBtn.dataset.next;
            if (next === "dikirim") {
                pendingShipOrderId = advanceBtn.dataset.id;
                resiInput.value = "";
                bootstrap.Modal.getOrCreateInstance(resiModalEl).show();
                return;
            }
            updateDoc(doc(db, "orders", advanceBtn.dataset.id), { status: next, statusUpdatedAt: Date.now() })
                .catch(function (error) { alert("Gagal update: " + error.message); });
            return;
        }

        if (cancelBtn) {
            const orderRef = doc(db, "orders", cancelBtn.dataset.id);
            runTransaction(db, async function (transaction) {
                const orderSnap = await transaction.get(orderRef);
                if (!orderSnap.exists()) return;
                const order = orderSnap.data();
                if (order.status === "dibatalkan") return;
                const items = orderItems(order);
                const stockRefs = items.map(function (i) { return doc(db, "stock", String(i.productId)); });
                const snaps = [];
                for (const ref of stockRefs) snaps.push(await transaction.get(ref));
                snaps.forEach(function (snap, idx) {
                    if (snap.exists()) transaction.update(stockRefs[idx], { quantity: snap.data().quantity + items[idx].qty });
                });
                transaction.update(orderRef, { status: "dibatalkan", statusUpdatedAt: Date.now() });
            }).catch(function (error) { alert("Gagal membatalkan: " + error.message); });
        }
    });
}

onSnapshot(collection(db, "reviews"), function (snapshot) {
    reviewsByOrderId = {};
    snapshot.forEach(function (docSnap) {
        const r = docSnap.data();
        if (!reviewsByOrderId[r.orderId]) reviewsByOrderId[r.orderId] = [];
        reviewsByOrderId[r.orderId].push(r);
    });
    renderAdminOrders(lastAdminOrdersSnap);
});

let unsubscribeAdminOrders = null;

onAuthStateChanged(auth, function (user) {
    const isAdmin = !!(user && user.email === ADMIN_EMAIL);
    if (buyerOrdersView) buyerOrdersView.style.display = isAdmin ? "none" : "block";
    if (adminOrdersView) adminOrdersView.style.display = isAdmin ? "block" : "none";
    if (unsubscribeAdminOrders) { unsubscribeAdminOrders(); unsubscribeAdminOrders = null; }
    if (isAdmin) {
        unsubscribeAdminOrders = onSnapshot(collection(db, "orders"), function (snapshot) {
            lastAdminOrdersSnap = snapshot.docs;
            renderAdminOrders(snapshot.docs);
            cleanupOldOrders(snapshot.docs);
        });
    }
});
