import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
let currentUser = null;
let reviewsByProduct = {};
let myReviewedOrderIds = new Set();
let unsubscribeMyReviews = null;

const modalRatingSummary = document.getElementById("modalRatingSummary");
const modalReviewsList = document.getElementById("modalReviewsList");

function starsHtml(rating) {
    const rounded = Math.round(rating);
    let html = "";
    for (let i = 1; i <= 5; i++) html += i <= rounded ? "★" : "☆";
    return html;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function updateProductStars() {
    document.querySelectorAll(".product-rating").forEach(function (el) {
        const stat = reviewsByProduct[el.dataset.ratingId];
        el.textContent = (!stat || stat.count === 0) ? "" : starsHtml(stat.avg) + " (" + stat.count + ")";
    });
}

const prevOnProductsRendered = window.onProductsRendered;
window.onProductsRendered = function () {
    if (typeof prevOnProductsRendered === "function") prevOnProductsRendered();
    updateProductStars();
};

const prevOnProductDetailShown = window.onProductDetailShown;
window.onProductDetailShown = function (product) {
    if (typeof prevOnProductDetailShown === "function") prevOnProductDetailShown(product);
    const stat = reviewsByProduct[product.id];
    if (modalRatingSummary) {
        modalRatingSummary.textContent = (stat && stat.count > 0)
            ? starsHtml(stat.avg) + " " + stat.avg.toFixed(1) + " (" + stat.count + " ulasan)"
            : "Belum ada ulasan";
    }
    if (modalReviewsList) {
        const list = (stat && stat.items) || [];
        modalReviewsList.innerHTML = list.map(function (r) {
            return '<div class="review-item"><span class="review-stars">' + starsHtml(r.rating) + '</span><p>' + escapeHtml(r.comment || "") + '</p></div>';
        }).join("");
    }
};

onSnapshot(collection(db, "reviews"), function (snapshot) {
    const map = {};
    snapshot.forEach(function (docSnap) {
        const r = docSnap.data();
        if (!map[r.productId]) map[r.productId] = { total: 0, count: 0, items: [] };
        map[r.productId].total += r.rating;
        map[r.productId].count += 1;
        map[r.productId].items.push(r);
    });
    reviewsByProduct = {};
    Object.keys(map).forEach(function (pid) {
        reviewsByProduct[pid] = { avg: map[pid].total / map[pid].count, count: map[pid].count, items: map[pid].items };
    });
    updateProductStars();
    if (window.selectedProductForPromo) window.onProductDetailShown(window.selectedProductForPromo);
});

window.submitReview = function (orderId, productId, productName, rating, comment) {
    if (!currentUser) return;
    addDoc(collection(db, "reviews"), {
        userId: currentUser.uid,
        buyerEmail: currentUser.email,
        orderId: orderId,
        productId: productId,
        productName: productName,
        rating: rating,
        comment: comment,
        createdAt: Date.now()
    }).catch(function (error) {
        alert("Gagal mengirim ulasan: " + error.message);
    });
};

window.hasReviewedOrder = function (orderId) {
    return myReviewedOrderIds.has(orderId);
};

onAuthStateChanged(auth, function (user) {
    currentUser = user;
    if (unsubscribeMyReviews) { unsubscribeMyReviews(); unsubscribeMyReviews = null; }
    myReviewedOrderIds = new Set();
    if (!user) return;
    const q = query(collection(db, "reviews"), where("userId", "==", user.uid));
    unsubscribeMyReviews = onSnapshot(q, function (snapshot) {
        myReviewedOrderIds = new Set(snapshot.docs.map(function (d) { return d.data().orderId; }));
        if (typeof window.rerenderMyOrders === "function") window.rerenderMyOrders();
    });
});
