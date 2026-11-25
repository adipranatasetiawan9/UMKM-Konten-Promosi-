import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, runTransaction, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const ordersList = document.getElementById("ordersList");
const ordersEmpty = document.getElementById("ordersEmpty");
const ordersLoginNotice = document.getElementById("ordersLoginNotice");
const proofInput = document.getElementById("proofInput");

let currentUser = null;
let unsubscribeOrders = null;
let stockMap = {};
let lastOrdersSnap = [];
let pendingProofOrderId = null;
let lastModalProductId = null;

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
const STATUS_BADGE = {
    menunggu_pembayaran: "text-bg-warning",
    menunggu_konfirmasi: "text-bg-info",
    diproses: "text-bg-primary",
    dikemas: "text-bg-primary",
    dikirim: "text-bg-primary",
    selesai: "text-bg-success",
    dibatalkan: "text-bg-danger"
};

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

function orderItems(order) {
    if (Array.isArray(order.items) && order.items.length > 0) return order.items;
    return [{ productId: order.productId, name: order.productName, price: order.productPrice, qty: order.quantity || 1 }];
}

function orderTotal(order) {
    if (typeof order.totalPrice === "number") return order.totalPrice;
    return orderItems(order).reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
}

// Baris subtotal dan diskon, hanya muncul kalau pesanan memakai voucher.
function diskonHtml(order) {
    if (!(order.diskon > 0)) return "";
    return '<p class="small text-muted mb-0">Subtotal: ' + formatRupiah(order.subtotal) + '</p>' +
        '<p class="small text-success mb-1">Diskon voucher ' + esc(order.voucherKode) + ': −' + formatRupiah(order.diskon) + '</p>';
}

function fileToDataUrl(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
            const img = new Image();
            img.onload = function () {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function paymentInstruction(method) {
    if (method && method.indexOf("Transfer Bank") === 0) {
        return "Buka aplikasi mobile banking kamu (" + method.replace("Transfer Bank ", "") + "), pilih menu Transfer/QRIS, lalu scan kode di bawah.";
    }
    return "Buka aplikasi " + method + ", pilih menu Bayar/Scan QR, lalu scan kode di bawah.";
}

function stepperHtml(status) {
    if (status === "dibatalkan") return '<div class="alert alert-danger py-2 small my-3">Pesanan ini sudah dibatalkan.</div>';
    const idx = STAGE_ORDER.indexOf(status);
    const pct = Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
    return '<div class="my-3">' +
        '<div class="d-flex justify-content-between small text-muted mb-1"><span>Tahap ' + (idx + 1) + ' dari ' + STAGE_ORDER.length + '</span><span>' + STAGE_LABEL[status] + '</span></div>' +
        '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar bg-success" style="width:' + pct + '%"></div></div>' +
        '</div>';
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

function reviewSectionHtml(order, id) {
    if (order.status !== "selesai") return "";
    return orderItems(order).map(function (it) {
        if (typeof window.hasReviewedItem === "function" && window.hasReviewedItem(id, it.productId)) {
            return '<p class="small text-success mt-3 mb-0">✓ Sudah diulas: ' + esc(it.name) + '</p>';
        }
        return '<div class="review-form border-top pt-3 mt-3" data-order-id="' + id + '" data-product-id="' + it.productId + '" data-product-name="' + esc(it.name) + '" data-rating="0">' +
            '<p class="small fw-semibold mb-1">Beri ulasan untuk ' + esc(it.name) + ':</p>' +
            '<div class="mb-2">' +
            [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="btn btn-link p-0 me-1 fs-3 text-secondary text-decoration-none review-star" data-rating="' + n + '">★</button>'; }).join("") +
            '</div>' +
            '<textarea class="form-control review-comment mb-2" rows="2" placeholder="Tulis ulasan kamu (opsional)..."></textarea>' +
            '<button type="button" class="btn btn-success btn-sm review-submit">Kirim Ulasan</button>' +
            '</div>';
    }).join("");
}

function tampilkanErrorFirestore(error) {
    if (error && error.code === "permission-denied") alert("Gagal: Firestore Rules belum di-publish atau menolak aksi ini.");
    else alert("Terjadi kesalahan: " + (error && error.message ? error.message : error));
    console.error(error);
}

window.getStockQty = function (productId) { return stockMap[productId]; };

function updateStockDisplay() {
    document.querySelectorAll(".product-stock").forEach(function (el) {
        const qty = stockMap[el.dataset.stockId];
        if (qty === undefined) { el.textContent = ""; return; }
        el.textContent = qty > 0 ? "Stok: " + qty : "Stok Habis";
        el.classList.toggle("text-danger", qty <= 0);
        el.classList.toggle("fw-semibold", qty <= 0);
    });
}

window.onProductsRendered = updateStockDisplay;

window.onProductDetailShown = function (product) {
    const qty = stockMap[product.id];
    const modalStockEl = document.getElementById("modalProductStock");
    if (modalStockEl) {
        modalStockEl.textContent = qty === undefined ? "Memuat stok..." : (qty > 0 ? "Stok tersedia: " + qty : "Stok Habis");
        modalStockEl.classList.toggle("text-danger", qty !== undefined && qty <= 0);
    }
    const habis = !(qty > 0);
    ["modalBuyButton", "modalAddCartButton"].forEach(function (id) {
        const b = document.getElementById(id);
        if (b) b.disabled = habis;
    });
    if (lastModalProductId !== product.id) {
        const q = document.getElementById("modalQty");
        if (q) q.textContent = "1";
        lastModalProductId = product.id;
    }
};

onSnapshot(collection(db, "stock"), function (snapshot) {
    snapshot.forEach(function (docSnap) { stockMap[docSnap.id] = docSnap.data().quantity; });
    updateStockDisplay();
    if (window.selectedProductForPromo) window.onProductDetailShown(window.selectedProductForPromo);
    if (typeof window.onStockChanged === "function") window.onStockChanged();
});

function updateAccountSummary(docsSnap) {
    const counts = { belum: 0, proses: 0, kirim: 0, selesai: 0 };
    docsSnap.forEach(function (docSnap) {
        const status = docSnap.data().status;
        if (status === "menunggu_pembayaran" || status === "menunggu_konfirmasi") counts.belum++;
        else if (status === "diproses" || status === "dikemas") counts.proses++;
        else if (status === "dikirim") counts.kirim++;
        else if (status === "selesai") counts.selesai++;
    });
    const map = { countBelumBayar: counts.belum, countDiproses: counts.proses, countDikirim: counts.kirim, countSelesai: counts.selesai };
    Object.keys(map).forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = map[id];
    });
}

function renderOrders(docsSnap) {
    if (!ordersList) return;
    const sorted = docsSnap.slice().sort(function (a, b) { return (b.data().createdAt || 0) - (a.data().createdAt || 0); });
    if (sorted.length === 0) { ordersList.innerHTML = ""; if (ordersEmpty) ordersEmpty.style.display = "block"; return; }
    if (ordersEmpty) ordersEmpty.style.display = "none";
    ordersList.innerHTML = sorted.map(function (docSnap) {
        const order = docSnap.data();
        const id = docSnap.id;
        let paymentHtml = "";
        let actionsHtml = "";
        if (order.status === "menunggu_pembayaran") {
            paymentHtml = '<p class="small mb-1"><strong>Metode:</strong> ' + esc(order.paymentMethod || "-") + '</p>' +
                '<img class="img-fluid rounded border my-2" style="max-width:240px;" src="assets/payment/qris-dana.jpg" alt="QRIS Pembayaran">' +
                '<p class="small text-muted">Total yang dibayar: <strong>' + formatRupiah(orderTotal(order)) + '</strong>. ' + esc(paymentInstruction(order.paymentMethod)) + ' Setelah bayar, unggah screenshot bukti bayarnya.</p>';
            actionsHtml = '<div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-success btn-sm" data-action="bukti" data-id="' + id + '">📎 Unggah Bukti Bayar</button><button type="button" class="btn btn-outline-danger btn-sm" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        } else if (order.status === "menunggu_konfirmasi") {
            paymentHtml = '<p class="small text-muted">' + (order.hasProof ? '✓ Bukti bayar terkirim. ' : '') + 'Menunggu konfirmasi penjual.</p>';
            actionsHtml = '<div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-outline-danger btn-sm" data-action="batal" data-id="' + id + '">Batalkan Pesanan</button></div>';
        }
        return '<div class="card border-0 shadow-sm mb-3"><div class="card-body">' +
            '<div class="d-flex justify-content-between align-items-center"><h3 class="h6 mb-0">Pesanan #' + id.slice(-6).toUpperCase() + '</h3><span class="badge ' + (STATUS_BADGE[order.status] || "text-bg-secondary") + '">' + (STAGE_LABEL[order.status] || order.status) + '</span></div>' +
            itemsHtml(order) +
            diskonHtml(order) +
            '<p class="fw-bold text-success mb-2">Total: ' + formatRupiah(orderTotal(order)) + '</p>' +
            shippingHtml(order) +
            '<button type="button" class="btn btn-outline-secondary btn-sm" data-action="chat">💬 Chat Penjual</button>' +
            stepperHtml(order.status) + paymentHtml + actionsHtml + reviewSectionHtml(order, id) +
            '</div></div>';
    }).join("");
}

window.rerenderMyOrders = function () { renderOrders(lastOrdersSnap); };

if (ordersList) {
    ordersList.addEventListener("click", function (event) {
        const starBtn = event.target.closest(".review-star");
        if (starBtn) {
            const form = starBtn.closest(".review-form");
            const rating = Number(starBtn.dataset.rating);
            form.dataset.rating = rating;
            form.querySelectorAll(".review-star").forEach(function (s) {
                const on = Number(s.dataset.rating) <= rating;
                s.classList.toggle("text-warning", on);
                s.classList.toggle("text-secondary", !on);
            });
            return;
        }

        const submitBtn = event.target.closest(".review-submit");
        if (submitBtn) {
            const form = submitBtn.closest(".review-form");
            const rating = Number(form.dataset.rating);
            if (!rating) { alert("Pilih bintang dulu sebelum kirim ulasan."); return; }
            const comment = form.querySelector(".review-comment").value.trim();
            submitBtn.disabled = true;
            window.submitReview(form.dataset.orderId, Number(form.dataset.productId), form.dataset.productName, rating, comment);
            return;
        }

        const button = event.target.closest("[data-action]");
        if (!button) return;

        if (button.dataset.action === "chat") {
            if (currentUser) window.openChatWith(currentUser.uid, currentUser.email);
            return;
        }

        if (button.dataset.action === "bukti") {
            pendingProofOrderId = button.dataset.id;
            if (proofInput) proofInput.click();
            return;
        }

        const orderRef = doc(db, "orders", button.dataset.id);

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
        }).catch(tampilkanErrorFirestore);
    });
}

if (proofInput) {
    proofInput.addEventListener("change", async function () {
        const file = proofInput.files[0];
        proofInput.value = "";
        if (!file || !pendingProofOrderId || !currentUser) return;
        const orderId = pendingProofOrderId;
        pendingProofOrderId = null;
        try {
            const dataUrl = await fileToDataUrl(file, 900, 0.7);
            await setDoc(doc(db, "proofs", orderId), { userId: currentUser.uid, orderId: orderId, dataUrl: dataUrl, createdAt: Date.now() });
            await updateDoc(doc(db, "orders", orderId), { status: "menunggu_konfirmasi", statusUpdatedAt: Date.now(), hasProof: true });
        } catch (error) {
            tampilkanErrorFirestore(error);
        }
    });
}

onAuthStateChanged(auth, function (user) {
    currentUser = user;
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (user) {
        if (ordersLoginNotice) ordersLoginNotice.style.display = "none";
        const q = query(collection(db, "orders"), where("userId", "==", user.uid));
        unsubscribeOrders = onSnapshot(q, function (snapshot) {
            lastOrdersSnap = snapshot.docs;
            renderOrders(snapshot.docs);
            updateAccountSummary(snapshot.docs);
        }, tampilkanErrorFirestore);
    } else {
        if (ordersLoginNotice) ordersLoginNotice.style.display = "block";
        if (ordersList) ordersList.innerHTML = "";
        if (ordersEmpty) ordersEmpty.style.display = "none";
    }
});
