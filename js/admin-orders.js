import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);

const adminOrdersNotice = document.getElementById("onlyAdminOrdersNotice");
const adminOrdersList = document.getElementById("adminOrdersList");

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

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function nextStageButton(order, id) {
    if (order.status === "dibatalkan") return "";
    const idx = STAGE_ORDER.indexOf(order.status);
    if (idx === -1 || idx === STAGE_ORDER.length - 1) return "";
    const nextStage = STAGE_ORDER[idx + 1];
    return '<button type="button" class="button primary admin-order-advance" data-id="' + id + '" data-next="' + nextStage + '">Tandai: ' + STAGE_LABEL[nextStage] + '</button>';
}

function renderAdminOrders(docsSnap) {
    if (!adminOrdersList) return;
    const sorted = docsSnap.slice().sort(function (a, b) { return (b.data().createdAt || 0) - (a.data().createdAt || 0); });
    if (sorted.length === 0) { adminOrdersList.innerHTML = '<p class="order-hint">Belum ada pesanan masuk.</p>'; return; }
    adminOrdersList.innerHTML = sorted.map(function (docSnap) {
        const order = docSnap.data();
        const id = docSnap.id;
        const canCancel = order.status !== "dibatalkan" && order.status !== "selesai";
        return '<div class="order-card">' +
            '<div class="order-card-head"><h3>' + order.productName + '</h3><span class="order-status order-status-' + order.status + '">' + (STAGE_LABEL[order.status] || order.status) + '</span></div>' +
            '<p class="order-price">' + formatRupiah(order.productPrice) + '</p>' +
            '<p class="order-payment-method">Pembeli: ' + (order.buyerEmail || "-") + ' &middot; ' + (order.paymentMethod || "-") + '</p>' +
            '<div class="order-actions">' +
            nextStageButton(order, id) +
            (canCancel ? '<button type="button" class="button secondary admin-order-cancel" data-id="' + id + '">Batalkan</button>' : '') +
            '</div></div>';
    }).join("");
}

if (adminOrdersList) {
    adminOrdersList.addEventListener("click", function (event) {
        const advanceBtn = event.target.closest(".admin-order-advance");
        const cancelBtn = event.target.closest(".admin-order-cancel");

        if (advanceBtn) {
            updateDoc(doc(db, "orders", advanceBtn.dataset.id), { status: advanceBtn.dataset.next, statusUpdatedAt: Date.now() })
                .catch(function (error) { alert("Gagal update: " + error.message); });
        }

        if (cancelBtn) {
            const orderRef = doc(db, "orders", cancelBtn.dataset.id);
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
            }).catch(function (error) { alert("Gagal membatalkan: " + error.message); });
        }
    });
}

let unsubscribeAdminOrders = null;

onAuthStateChanged(auth, function (user) {
    const isAdmin = !!(user && user.email === ADMIN_EMAIL);
    if (adminOrdersNotice) adminOrdersNotice.style.display = isAdmin ? "none" : "block";
    if (adminOrdersList) adminOrdersList.style.display = isAdmin ? "block" : "none";
    if (unsubscribeAdminOrders) { unsubscribeAdminOrders(); unsubscribeAdminOrders = null; }
    if (isAdmin) {
        unsubscribeAdminOrders = onSnapshot(collection(db, "orders"), function (snapshot) {
            renderAdminOrders(snapshot.docs);
        });
    }
});
