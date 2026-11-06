import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const CART_KEY = "umkm_cart";
const SHIP_KEY = "umkm_ship";
const MAX_QTY = 20;

const cartBadge = document.getElementById("cartBadge");
const cartItemsEl = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const cartLoginNotice = document.getElementById("cartLoginNotice");
const cartCheckout = document.getElementById("cartCheckout");
const cartTotal = document.getElementById("cartTotal");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutError = document.getElementById("checkoutError");
const checkoutButton = document.getElementById("checkoutButton");
const shipName = document.getElementById("shipName");
const shipPhone = document.getElementById("shipPhone");
const shipAddress = document.getElementById("shipAddress");
const shipCourier = document.getElementById("shipCourier");
const payMethod = document.getElementById("payMethod");
const modalQty = document.getElementById("modalQty");
const modalQtyMinus = document.getElementById("modalQtyMinus");
const modalQtyPlus = document.getElementById("modalQtyPlus");
const modalAddCartButton = document.getElementById("modalAddCartButton");
const modalBuyButton = document.getElementById("modalBuyButton");

let currentUser = null;
let cart = loadCart();

function loadCart() {
    try {
        const raw = JSON.parse(localStorage.getItem(CART_KEY));
        return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
}

function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
}

function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function rupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function findProduct(id) {
    return products.find(function (p) { return p.id === id; });
}

function stockOf(id) {
    return typeof window.getStockQty === "function" ? window.getStockQty(id) : undefined;
}

function maxFor(id) {
    const s = stockOf(id);
    return Math.max(0, Math.min(MAX_QTY, s === undefined ? MAX_QTY : s));
}

function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
}

function renderCart() {
    cart = cart.filter(function (l) { return findProduct(l.productId); });
    const totalQty = cart.reduce(function (sum, l) { return sum + l.qty; }, 0);
    if (cartBadge) {
        cartBadge.textContent = totalQty;
        cartBadge.style.display = totalQty > 0 ? "flex" : "none";
    }
    if (!cartItemsEl) return;
    if (cart.length === 0) {
        cartItemsEl.innerHTML = "";
        cartEmpty.style.display = "block";
        cartCheckout.style.display = "none";
        cartLoginNotice.style.display = "none";
        return;
    }
    cartEmpty.style.display = "none";
    let total = 0;
    let problem = false;
    cartItemsEl.innerHTML = cart.map(function (l) {
        const p = findProduct(l.productId);
        const stock = stockOf(l.productId);
        const short = stock !== undefined && l.qty > stock;
        if (short) problem = true;
        total += p.price * l.qty;
        return '<div class="cart-item">' +
            '<img class="cart-item-image" src="' + esc(p.image) + '" alt="">' +
            '<div class="cart-item-info"><strong>' + esc(p.name) + '</strong><span>' + rupiah(p.price) + '</span>' +
            (short ? '<span class="stock-habis">Stok tersisa ' + stock + '</span>' : '') +
            '<div class="qty-stepper">' +
            '<button type="button" data-cart="minus" data-id="' + p.id + '">−</button>' +
            '<span>' + l.qty + '</span>' +
            '<button type="button" data-cart="plus" data-id="' + p.id + '">+</button>' +
            '</div></div>' +
            '<button type="button" class="link-button" data-cart="remove" data-id="' + p.id + '">Hapus</button>' +
            '</div>';
    }).join("");
    cartTotal.textContent = rupiah(total);
    cartCheckout.style.display = currentUser ? "block" : "none";
    cartLoginNotice.style.display = currentUser ? "none" : "block";
    checkoutButton.disabled = problem;
    checkoutError.textContent = problem ? "Ada produk yang jumlahnya melebihi stok. Kurangi jumlahnya dulu." : "";
}

window.onStockChanged = renderCart;

if (cartItemsEl) {
    cartItemsEl.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-cart]");
        if (!btn) return;
        const id = Number(btn.dataset.id);
        const line = cart.find(function (l) { return l.productId === id; });
        if (!line) return;
        if (btn.dataset.cart === "remove") {
            cart = cart.filter(function (l) { return l !== line; });
        } else if (btn.dataset.cart === "minus") {
            line.qty = Math.max(1, line.qty - 1);
        } else if (btn.dataset.cart === "plus") {
            if (line.qty < maxFor(id)) line.qty++;
            else toast("Jumlah maksimal sesuai stok");
        }
        saveCart();
        renderCart();
    });
}

if (modalQtyMinus) {
    modalQtyMinus.addEventListener("click", function () {
        modalQty.textContent = Math.max(1, Number(modalQty.textContent) - 1);
    });
}

if (modalQtyPlus) {
    modalQtyPlus.addEventListener("click", function () {
        const p = window.selectedProductForPromo;
        const max = p ? maxFor(p.id) : 1;
        const next = Number(modalQty.textContent) + 1;
        if (next > max) { toast(max > 0 ? "Maksimal " + max + " sesuai stok" : "Stok habis"); return; }
        modalQty.textContent = next;
    });
}

function addSelectedToCart() {
    const p = window.selectedProductForPromo;
    if (!p) return false;
    const max = maxFor(p.id);
    if (max <= 0) { alert("Maaf, stok produk ini habis."); return false; }
    const qty = Number(modalQty.textContent) || 1;
    const line = cart.find(function (l) { return l.productId === p.id; });
    const wanted = (line ? line.qty : 0) + qty;
    const finalQty = Math.min(wanted, max);
    if (line) line.qty = finalQty; else cart.push({ productId: p.id, qty: finalQty });
    saveCart();
    renderCart();
    if (finalQty < wanted) toast("Jumlah disesuaikan dengan stok (maks " + max + ")");
    modalQty.textContent = "1";
    return true;
}

if (modalAddCartButton) {
    modalAddCartButton.addEventListener("click", function () {
        if (addSelectedToCart()) {
            toast("Masuk keranjang ✓");
            if (typeof closeProductModal === "function") closeProductModal();
        }
    });
}

if (modalBuyButton) {
    modalBuyButton.addEventListener("click", function () {
        if (addSelectedToCart()) {
            if (typeof closeProductModal === "function") closeProductModal();
            if (typeof showPage === "function") showPage("keranjang");
        }
    });
}

function prefillForm() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SHIP_KEY)) || {}; } catch (e) {}
    if (shipName && !shipName.value) shipName.value = saved.name || (currentUser && currentUser.displayName) || "";
    if (shipPhone && !shipPhone.value) shipPhone.value = saved.phone || "";
    if (shipAddress && !shipAddress.value) shipAddress.value = saved.address || "";
    if (shipCourier && saved.courier) shipCourier.value = saved.courier;
    if (payMethod && saved.payMethod) payMethod.value = saved.payMethod;
}

if (checkoutForm) {
    checkoutForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!currentUser) return;
        checkoutError.textContent = "";

        const name = shipName.value.trim();
        const phone = shipPhone.value.trim().replace(/[\s-]/g, "");
        const address = shipAddress.value.trim();
        const courier = shipCourier.value;
        const method = payMethod.value;

        if (name.length < 3) { checkoutError.textContent = "Nama penerima minimal 3 huruf."; return; }
        if (!/^(\+?62|0)8\d{8,12}$/.test(phone)) { checkoutError.textContent = "Nomor HP tidak valid. Contoh: 081234567890"; return; }
        if (address.length < 10) { checkoutError.textContent = "Alamat terlalu pendek. Tulis lengkap (jalan, desa/kelurahan, kecamatan, kota)."; return; }

        const items = cart.map(function (l) {
            const p = findProduct(l.productId);
            return { productId: p.id, name: p.name, price: p.price, qty: l.qty };
        });
        if (items.length === 0) return;
        const total = items.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);

        try {
            localStorage.setItem(SHIP_KEY, JSON.stringify({ name: name, phone: phone, address: address, courier: courier, payMethod: method }));
        } catch (e) {}

        checkoutButton.disabled = true;
        const orderRef = doc(collection(db, "orders"));

        runTransaction(db, async function (transaction) {
            const stockRefs = items.map(function (i) { return doc(db, "stock", String(i.productId)); });
            const snaps = [];
            for (const ref of stockRefs) snaps.push(await transaction.get(ref));
            snaps.forEach(function (snap, idx) {
                const available = snap.exists() ? snap.data().quantity : 0;
                if (available < items[idx].qty) throw new Error("STOK_KURANG:" + items[idx].name);
            });
            snaps.forEach(function (snap, idx) {
                transaction.update(stockRefs[idx], { quantity: snap.data().quantity - items[idx].qty });
            });
            const now = Date.now();
            transaction.set(orderRef, {
                userId: currentUser.uid,
                buyerEmail: currentUser.email,
                items: items,
                totalPrice: total,
                paymentMethod: method,
                courier: courier,
                recipientName: name,
                phone: phone,
                address: address,
                status: "menunggu_pembayaran",
                statusUpdatedAt: now,
                createdAt: now
            });
        }).then(function () {
            cart = [];
            saveCart();
            renderCart();
            if (typeof showPage === "function") showPage("pesanan");
        }).catch(function (error) {
            if (error && error.message && error.message.indexOf("STOK_KURANG:") === 0) {
                checkoutError.textContent = "Stok tidak cukup untuk: " + error.message.replace("STOK_KURANG:", "");
            } else if (error && error.code === "permission-denied") {
                checkoutError.textContent = "Ditolak Firestore. Pastikan Rules terbaru sudah di-publish.";
            } else {
                checkoutError.textContent = "Gagal membuat pesanan: " + (error && error.message ? error.message : error);
            }
            console.error(error);
        }).finally(function () {
            checkoutButton.disabled = false;
        });
    });
}

onAuthStateChanged(auth, function (user) {
    currentUser = user;
    prefillForm();
    renderCart();
});

renderCart();
