import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);
const CATEGORIES = ["Makanan", "Minuman", "Fashion", "Kerajinan"];

const onlyAdminNotice = document.getElementById("onlyAdminNotice");
const adminStockList = document.getElementById("adminStockList");

let isAdmin = false;
let stockMap = {};
let editingId = null;
let unsubscribeStock = null;

function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function rupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
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

function skeletonHtml() {
    return '<div class="admin-toolbar"><button type="button" class="button primary" id="adminAddButton">➕ Tambah Produk Baru</button></div>' +
        '<form id="adminProductForm" class="checkout-form" style="display:none;">' +
        '<h3 id="adminFormTitle">Tambah Produk</h3>' +
        '<div><label for="apName">Nama Produk</label><input type="text" id="apName" required></div>' +
        '<div><label for="apCategory">Kategori</label><select id="apCategory">' +
        CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("") +
        '</select></div>' +
        '<div><label for="apPrice">Harga (Rp)</label><input type="number" id="apPrice" min="1" step="1" required></div>' +
        '<div><label for="apDesc">Deskripsi</label><textarea id="apDesc" placeholder="Deskripsi singkat produk"></textarea></div>' +
        '<div id="apStockWrap"><label for="apStock">Stok Awal</label><input type="number" id="apStock" min="0" step="1" value="10"></div>' +
        '<div><label for="apPhoto">Foto Produk</label><input type="file" id="apPhoto" accept="image/*"><p class="order-hint" id="apPhotoHint"></p></div>' +
        '<p class="auth-error" id="adminProductMsg"></p>' +
        '<button type="submit" class="button primary" id="apSubmit">Simpan Produk</button>' +
        '<button type="button" class="button secondary" id="apCancel">Batal</button>' +
        '</form>' +
        '<div id="adminProductRows"></div>';
}

function renderRows() {
    const box = document.getElementById("adminProductRows");
    if (!box) return;
    box.innerHTML = products.map(function (p) {
        const qty = stockMap[p.id];
        return '<div class="admin-product-row' + (p.hidden ? ' is-hidden' : '') + '">' +
            '<img class="admin-product-thumb" src="' + esc(p.image) + '" alt="">' +
            '<div class="admin-product-info">' +
            '<strong>' + esc(p.name) + '</strong>' +
            '<span>' + esc(p.category) + ' · ' + rupiah(p.price) + (p.hidden ? ' · Disembunyikan' : '') + '</span>' +
            '<div class="admin-row-actions">' +
            '<input type="number" min="0" class="admin-stock-input" data-id="' + p.id + '" value="' + (qty === undefined ? 0 : qty) + '">' +
            '<button type="button" class="button secondary" data-admin="stock" data-id="' + p.id + '">Simpan Stok</button>' +
            '</div>' +
            '<div class="admin-row-actions">' +
            '<button type="button" class="button secondary" data-admin="edit" data-id="' + p.id + '">Ubah</button>' +
            '<button type="button" class="button secondary" data-admin="toggle" data-id="' + p.id + '">' + (p.hidden ? 'Tampilkan' : 'Sembunyikan') + '</button>' +
            '</div></div></div>';
    }).join("");
}

function updateStockInputs() {
    document.querySelectorAll(".admin-stock-input").forEach(function (input) {
        if (document.activeElement === input) return;
        const qty = stockMap[input.dataset.id];
        input.value = qty === undefined ? 0 : qty;
    });
}

function openForm(productId) {
    const form = document.getElementById("adminProductForm");
    if (!form) return;
    editingId = productId;
    form.reset();
    document.getElementById("adminProductMsg").textContent = "";
    if (productId === null) {
        document.getElementById("adminFormTitle").textContent = "Tambah Produk";
        document.getElementById("apStockWrap").style.display = "block";
        document.getElementById("apPhotoHint").textContent = "Foto wajib untuk produk baru.";
    } else {
        const p = products.find(function (item) { return item.id === productId; });
        if (!p) return;
        document.getElementById("adminFormTitle").textContent = "Ubah Produk";
        document.getElementById("apName").value = p.name;
        document.getElementById("apCategory").value = p.category;
        document.getElementById("apPrice").value = p.price;
        document.getElementById("apDesc").value = p.description || "";
        document.getElementById("apStockWrap").style.display = "none";
        document.getElementById("apPhotoHint").textContent = "Kosongkan jika tidak ingin mengganti foto.";
    }
    form.style.display = "flex";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
    const form = document.getElementById("adminProductForm");
    if (form) form.style.display = "none";
    editingId = null;
}

async function submitProduct(event) {
    event.preventDefault();
    const msg = document.getElementById("adminProductMsg");
    const submit = document.getElementById("apSubmit");
    msg.textContent = "";

    const name = document.getElementById("apName").value.trim();
    const category = document.getElementById("apCategory").value;
    const price = Math.round(Number(document.getElementById("apPrice").value));
    const description = document.getElementById("apDesc").value.trim();
    const file = document.getElementById("apPhoto").files[0];

    if (name.length < 3) { msg.textContent = "Nama produk minimal 3 huruf."; return; }
    if (!Number.isFinite(price) || price < 1) { msg.textContent = "Harga tidak valid."; return; }

    submit.disabled = true;
    try {
        const imageDataUrl = file ? await fileToDataUrl(file, 640, 0.72) : null;

        if (editingId === null) {
            if (!imageDataUrl) { msg.textContent = "Foto produk wajib untuk produk baru."; return; }
            const stockQty = Math.max(0, Math.floor(Number(document.getElementById("apStock").value) || 0));
            const id = Date.now();
            const batch = writeBatch(db);
            batch.set(doc(db, "products", String(id)), {
                id: id, name: name, category: category, price: price, description: description,
                image: imageDataUrl, hidden: false, custom: true, updatedAt: Date.now()
            });
            batch.set(doc(db, "stock", String(id)), { quantity: stockQty });
            await batch.commit();
            toast("Produk baru ditambahkan ✓");
        } else {
            const data = { name: name, category: category, price: price, description: description, updatedAt: Date.now() };
            if (imageDataUrl) data.image = imageDataUrl;
            await setDoc(doc(db, "products", String(editingId)), data, { merge: true });
            toast("Perubahan disimpan ✓");
        }
        closeForm();
    } catch (error) {
        msg.textContent = error && error.code === "permission-denied"
            ? "Ditolak Firestore. Pastikan Rules terbaru sudah di-publish."
            : "Gagal menyimpan: " + (error && error.message ? error.message : error);
        console.error(error);
    } finally {
        submit.disabled = false;
    }
}

if (adminStockList) {
    adminStockList.addEventListener("click", function (event) {
        if (event.target.closest("#adminAddButton")) { openForm(null); return; }
        if (event.target.closest("#apCancel")) { closeForm(); return; }

        const btn = event.target.closest("[data-admin]");
        if (!btn) return;
        const id = Number(btn.dataset.id);

        if (btn.dataset.admin === "edit") { openForm(id); return; }

        if (btn.dataset.admin === "stock") {
            const input = adminStockList.querySelector('.admin-stock-input[data-id="' + id + '"]');
            const qty = Math.max(0, Math.floor(Number(input.value) || 0));
            setDoc(doc(db, "stock", String(id)), { quantity: qty }, { merge: true })
                .then(function () { toast("Stok disimpan ✓"); })
                .catch(function (error) { alert("Gagal menyimpan stok: " + error.message); });
            return;
        }

        if (btn.dataset.admin === "toggle") {
            const p = products.find(function (item) { return item.id === id; });
            if (!p) return;
            setDoc(doc(db, "products", String(id)), { hidden: !p.hidden, updatedAt: Date.now() }, { merge: true })
                .catch(function (error) { alert("Gagal mengubah status produk: " + error.message); });
        }
    });

    adminStockList.addEventListener("submit", function (event) {
        if (event.target.id === "adminProductForm") submitProduct(event);
    });
}

window.addEventListener("catalog-changed", function () {
    if (isAdmin) renderRows();
});

onAuthStateChanged(auth, function (user) {
    isAdmin = !!(user && user.email === ADMIN_EMAIL);
    if (unsubscribeStock) { unsubscribeStock(); unsubscribeStock = null; }

    if (onlyAdminNotice) onlyAdminNotice.style.display = isAdmin ? "none" : "block";
    if (adminStockList) {
        adminStockList.style.display = isAdmin ? "block" : "none";
        adminStockList.innerHTML = isAdmin ? skeletonHtml() : "";
    }
    editingId = null;

    if (isAdmin) {
        renderRows();
        unsubscribeStock = onSnapshot(collection(db, "stock"), function (snapshot) {
            snapshot.forEach(function (docSnap) { stockMap[docSnap.id] = docSnap.data().quantity; });
            updateStockInputs();
        });
    }
});
