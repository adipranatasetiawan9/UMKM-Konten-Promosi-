import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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
// Data voucher yang sedang dipakai di keranjang (null kalau tidak ada).
let voucherAktif = null;

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

function subtotalKeranjang() {
    return cart.reduce(function (sum, l) {
        const p = findProduct(l.productId);
        return sum + (p ? p.price * l.qty : 0);
    }, 0);
}

// Besar potongan: persen dari subtotal, atau nominal tetap, tidak boleh melebihi subtotal.
function hitungDiskon(subtotal, v) {
    const diskon = v.jenis === "persen" ? Math.floor(subtotal * v.nilai / 100) : v.nilai;
    return Math.max(0, Math.min(diskon, subtotal));
}

// Mengembalikan alasan voucher tidak bisa dipakai, atau teks kosong kalau semua aturan terpenuhi.
function cekAturanVoucher(v, subtotal) {
    if (!v.aktif) return "Voucher tidak aktif.";
    if (v.berlakuSampai && Date.now() > v.berlakuSampai) return "Voucher sudah kedaluwarsa.";
    if (v.kuota > 0 && v.terpakai >= v.kuota) return "Kuota voucher sudah habis.";
    if (subtotal < v.minimal) return "Belanja minimal " + rupiah(v.minimal) + " untuk voucher ini.";
    return "";
}

function tulisPesanVoucher(teks, sukses) {
    const pesan = document.getElementById("pesanVoucher");
    if (!pesan) return;
    pesan.className = "form-text " + (sukses ? "text-success" : "text-danger");
    pesan.textContent = teks;
}

// Memasang kolom voucher dan ringkasan diskon ke dalam form checkout lewat JavaScript.
function pasangKerangkaVoucher() {
    if (!checkoutForm || document.getElementById("inputVoucher")) return;
    checkoutForm.insertAdjacentHTML("beforebegin", '<div id="ringkasanDiskon"></div>');
    checkoutError.insertAdjacentHTML("beforebegin",
        '<div class="mb-3"><label for="inputVoucher" class="form-label">Kode Voucher (opsional)</label>' +
        '<div class="input-group"><input type="text" class="form-control text-uppercase" id="inputVoucher" maxlength="15" autocomplete="off" placeholder="Contoh: HEMAT10">' +
        '<button type="button" class="btn btn-outline-success" id="tombolVoucher">Pakai</button></div>' +
        '<div class="form-text" id="pesanVoucher"></div></div>');
    document.getElementById("tombolVoucher").addEventListener("click", pakaiVoucher);
}

async function pakaiVoucher() {
    const input = document.getElementById("inputVoucher");
    const kode = input.value.trim().toUpperCase();
    if (!kode) { tulisPesanVoucher("Isi kode voucher dulu.", false); return; }
    try {
        const snap = await getDoc(doc(db, "vouchers", kode));
        if (!snap.exists()) {
            voucherAktif = null;
            tulisPesanVoucher("Kode voucher tidak ditemukan.", false);
            renderCart();
            return;
        }
        const v = snap.data();
        const alasan = cekAturanVoucher(v, subtotalKeranjang());
        if (alasan) {
            voucherAktif = null;
            tulisPesanVoucher(alasan, false);
            renderCart();
            return;
        }
        voucherAktif = v;
        renderCart();
        tulisPesanVoucher("Voucher " + v.kode + " dipakai.", true);
    } catch (error) {
        tulisPesanVoucher("Gagal memeriksa voucher: " + (error && error.message ? error.message : error), false);
    }
}

function toast(message) {
    const el = document.createElement("div");
    el.className = "toast show align-items-center text-bg-dark border-0 position-fixed bottom-0 start-50 translate-middle-x mb-5";
    el.style.zIndex = "2000";
    el.innerHTML = '<div class="toast-body">' + esc(message) + '</div>';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
}

function renderCart() {
    cart = cart.filter(function (l) { return findProduct(l.productId); });
    const totalQty = cart.reduce(function (sum, l) { return sum + l.qty; }, 0);
    if (cartBadge) {
        cartBadge.textContent = totalQty;
        cartBadge.style.display = totalQty > 0 ? "inline-block" : "none";
    }
    if (!cartItemsEl) return;
    if (cart.length === 0) {
        cartItemsEl.innerHTML = "";
        cartEmpty.style.display = "block";
        cartCheckout.style.display = "none";
        cartLoginNotice.style.display = "none";
        voucherAktif = null;
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
        return '<div class="card border-0 shadow-sm mb-2"><div class="card-body d-flex gap-3 align-items-start">' +
            '<img class="rounded flex-shrink-0" style="width:72px;height:72px;object-fit:cover;" src="' + esc(p.image) + '" alt="">' +
            '<div class="flex-grow-1">' +
            '<div class="fw-semibold">' + esc(p.name) + '</div>' +
            '<div class="text-success fw-bold small">' + rupiah(p.price) + '</div>' +
            (short ? '<div class="text-danger small">Stok tersisa ' + stock + '</div>' : '') +
            '<div class="input-group input-group-sm mt-2" style="width:130px;">' +
            '<button type="button" class="btn btn-outline-success" data-cart="minus" data-id="' + p.id + '">−</button>' +
            '<span class="input-group-text flex-grow-1 justify-content-center">' + l.qty + '</span>' +
            '<button type="button" class="btn btn-outline-success" data-cart="plus" data-id="' + p.id + '">+</button>' +
            '</div></div>' +
            '<button type="button" class="btn btn-sm btn-outline-danger" data-cart="remove" data-id="' + p.id + '">Hapus</button>' +
            '</div></div>';
    }).join("");
    cartTotal.textContent = rupiah(total);

    // Kalau belanja berubah dan tidak lagi memenuhi aturan voucher, voucher dilepas.
    if (voucherAktif) {
        const alasan = cekAturanVoucher(voucherAktif, total);
        if (alasan) {
            voucherAktif = null;
            tulisPesanVoucher("Voucher dilepas. " + alasan, false);
        }
    }
    const ringkasan = document.getElementById("ringkasanDiskon");
    if (ringkasan) {
        const diskon = voucherAktif ? hitungDiskon(total, voucherAktif) : 0;
        ringkasan.innerHTML = diskon > 0
            ? '<div class="d-flex justify-content-between small text-success"><span>Diskon (' + esc(voucherAktif.kode) + ')</span><span>−' + rupiah(diskon) + '</span></div>' +
              '<div class="d-flex justify-content-between fw-bold fs-5 mb-2"><span>Total Bayar</span><span>' + rupiah(total - diskon) + '</span></div>'
            : '';
    }

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
        const subtotal = items.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);

        try {
            localStorage.setItem(SHIP_KEY, JSON.stringify({ name: name, phone: phone, address: address, courier: courier, payMethod: method }));
        } catch (e) {}

        checkoutButton.disabled = true;
        const orderRef = doc(collection(db, "orders"));
        const voucherRef = voucherAktif ? doc(db, "vouchers", voucherAktif.kode) : null;

        runTransaction(db, async function (transaction) {
            // Semua pembacaan dilakukan dulu, baru penulisan.
            const stockRefs = items.map(function (i) { return doc(db, "stock", String(i.productId)); });
            const snaps = [];
            for (const ref of stockRefs) snaps.push(await transaction.get(ref));

            let dataVoucher = null;
            if (voucherRef) {
                const vSnap = await transaction.get(voucherRef);
                if (!vSnap.exists()) throw new Error("VOUCHER:Voucher tidak ditemukan.");
                dataVoucher = vSnap.data();
                const alasan = cekAturanVoucher(dataVoucher, subtotal);
                if (alasan) throw new Error("VOUCHER:" + alasan);
            }

            snaps.forEach(function (snap, idx) {
                const available = snap.exists() ? snap.data().quantity : 0;
                if (available < items[idx].qty) throw new Error("STOK_KURANG:" + items[idx].name);
            });

            snaps.forEach(function (snap, idx) {
                transaction.update(stockRefs[idx], { quantity: snap.data().quantity - items[idx].qty });
            });

            let diskon = 0;
            if (dataVoucher) {
                diskon = hitungDiskon(subtotal, dataVoucher);
                transaction.update(voucherRef, { terpakai: dataVoucher.terpakai + 1 });
            }

            const now = Date.now();
            transaction.set(orderRef, {
                userId: currentUser.uid,
                buyerEmail: currentUser.email,
                items: items,
                subtotal: subtotal,
                diskon: diskon,
                voucherKode: dataVoucher ? dataVoucher.kode : null,
                totalPrice: subtotal - diskon,
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
            voucherAktif = null;
            const input = document.getElementById("inputVoucher");
            if (input) input.value = "";
            tulisPesanVoucher("", true);
            saveCart();
            renderCart();
            if (typeof showPage === "function") showPage("pesanan");
        }).catch(function (error) {
            const teks = error && error.message ? error.message : "";
            if (teks.indexOf("STOK_KURANG:") === 0) {
                checkoutError.textContent = "Stok tidak cukup untuk: " + teks.replace("STOK_KURANG:", "");
            } else if (teks.indexOf("VOUCHER:") === 0) {
                voucherAktif = null;
                checkoutError.textContent = teks.replace("VOUCHER:", "");
                renderCart();
            } else if (error && error.code === "permission-denied") {
                checkoutError.textContent = "Ditolak Firestore. Pastikan Rules terbaru sudah di-publish.";
            } else {
                checkoutError.textContent = "Gagal membuat pesanan: " + (teks || error);
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

pasangKerangkaVoucher();
renderCart();
