import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);

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

// Notifikasi singkat memakai komponen toast Bootstrap.
function toast(message) {
    const el = document.createElement("div");
    el.className = "toast show align-items-center text-bg-dark border-0 position-fixed bottom-0 start-50 translate-middle-x mb-5";
    el.style.zIndex = "2000";
    el.innerHTML = '<div class="toast-body">' + esc(message) + '</div>';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
}

// Memperkecil foto di browser sebelum disimpan sebagai teks base64 di Firestore.
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

// Daftar kategori terbaru dari catalog.js.
function daftarKategori() {
    return (window.kategoriData && window.kategoriData.daftar) || [];
}

function opsiKategoriHtml() {
    return daftarKategori().map(function (k) {
        return '<option value="' + esc(k.nama) + '">' + esc(k.nama) + '</option>';
    }).join("");
}

function skeletonHtml() {
    return '<div class="card border-0 shadow-sm mb-3"><div class="card-body">' +
        '<h3 class="h6">Kategori produk</h3>' +
        '<div class="d-flex flex-wrap gap-2 mb-3" id="daftarKategoriAdmin"></div>' +
        '<form id="formKategori" class="input-group input-group-sm">' +
        '<input type="text" class="form-control" id="inputKategori" placeholder="Nama kategori baru" maxlength="30" autocomplete="off" required>' +
        '<button type="submit" class="btn btn-success">Tambah</button>' +
        '</form>' +
        '<div class="form-text text-danger" id="pesanKategori"></div>' +
        '</div></div>' +
        '<div class="mb-3"><button type="button" class="btn btn-success" id="adminAddButton">➕ Tambah Produk Baru</button></div>' +
        '<form id="adminProductForm" class="card card-body border-0 shadow-sm mb-3" style="display:none;">' +
        '<h3 class="h5" id="adminFormTitle">Tambah Produk</h3>' +
        '<div class="mb-3"><label for="apName" class="form-label">Nama Produk</label><input type="text" class="form-control" id="apName" required></div>' +
        '<div class="mb-3"><label for="apCategory" class="form-label">Kategori</label><select class="form-select" id="apCategory">' + opsiKategoriHtml() + '</select></div>' +
        '<div class="mb-3"><label for="apPrice" class="form-label">Harga (Rp)</label><input type="number" class="form-control" id="apPrice" min="1" step="1" required></div>' +
        '<div class="mb-3"><label for="apDesc" class="form-label">Deskripsi</label><textarea class="form-control" id="apDesc" rows="3" placeholder="Deskripsi singkat produk"></textarea></div>' +
        '<div class="mb-3" id="apStockWrap"><label for="apStock" class="form-label">Stok Awal</label><input type="number" class="form-control" id="apStock" min="0" step="1" value="10"></div>' +
        '<div class="mb-3"><label for="apPhoto" class="form-label">Foto Produk</label><input type="file" class="form-control" id="apPhoto" accept="image/*"><div class="form-text" id="apPhotoHint"></div></div>' +
        '<p class="text-danger small" id="adminProductMsg"></p>' +
        '<div class="d-flex gap-2"><button type="submit" class="btn btn-success" id="apSubmit">Simpan Produk</button><button type="button" class="btn btn-outline-secondary" id="apCancel">Batal</button></div>' +
        '</form>' +
        '<div class="list-group shadow-sm" id="adminProductRows"></div>';
}

// Menampilkan kategori sebagai badge, lengkap dengan jumlah produk yang memakainya.
function renderKategori() {
    const box = document.getElementById("daftarKategoriAdmin");
    if (!box) return;
    box.innerHTML = daftarKategori().map(function (k) {
        const jumlah = products.filter(function (p) { return p.category === k.nama; }).length;
        return '<span class="badge text-bg-success d-inline-flex align-items-center gap-2 fs-6 fw-normal">' + esc(k.nama) +
            '<span class="badge text-bg-light">' + jumlah + '</span>' +
            '<button type="button" class="btn-close btn-close-white" style="font-size:.6rem;" data-hapus-kategori="' + esc(k.nama) + '" aria-label="Hapus ' + esc(k.nama) + '"></button>' +
            '</span>';
    }).join("");
}

// Memperbarui pilihan kategori di form produk tanpa menghilangkan pilihan yang sedang aktif.
function isiPilihanKategori() {
    const pilih = document.getElementById("apCategory");
    if (!pilih) return;
    const nilaiLama = pilih.value;
    pilih.innerHTML = opsiKategoriHtml();
    if (nilaiLama) pastikanOpsi(pilih, nilaiLama);
}

function pastikanOpsi(pilih, nilai) {
    const ada = Array.prototype.some.call(pilih.options, function (o) { return o.value === nilai; });
    if (!ada) {
        const o = document.createElement("option");
        o.value = nilai;
        o.textContent = nilai;
        pilih.appendChild(o);
    }
    pilih.value = nilai;
}

// Kalau kategori masih bawaan (belum di database), simpan dulu semuanya supaya bisa diubah.
async function simpanBawaanJikaPerlu() {
    if (window.kategoriData && window.kategoriData.dariDatabase) return;
    const batch = writeBatch(db);
    window.KATEGORI_BAWAAN.forEach(function (nama, i) {
        batch.set(doc(db, "categories", window.slugKategori(nama)), { nama: nama, urutan: i });
    });
    await batch.commit();
}

async function tambahKategori(event) {
    event.preventDefault();
    const input = document.getElementById("inputKategori");
    const pesan = document.getElementById("pesanKategori");
    const nama = input.value.trim().replace(/\s+/g, " ");
    pesan.textContent = "";
    if (nama.length < 3) { pesan.textContent = "Nama kategori minimal 3 huruf."; return; }
    const idBaru = window.slugKategori(nama);
    const sudahAda = daftarKategori().some(function (k) {
        return k.nama.toLowerCase() === nama.toLowerCase() || k.id === idBaru || window.slugKategori(k.nama) === idBaru;
    });
    if (sudahAda) { pesan.textContent = "Kategori itu sudah ada."; return; }
    try {
        await simpanBawaanJikaPerlu();
        await setDoc(doc(db, "categories", idBaru), { nama: nama, urutan: Date.now() });
        input.value = "";
        toast("Kategori ditambahkan ✓");
    } catch (error) {
        pesan.textContent = error && error.code === "permission-denied"
            ? "Ditolak Firestore. Pastikan Rules terbaru sudah di-publish."
            : "Gagal menambah kategori: " + (error && error.message ? error.message : error);
        console.error(error);
    }
}

async function hapusKategori(nama) {
    const daftar = daftarKategori();
    const dipakai = products.filter(function (p) { return p.category === nama; }).length;
    if (dipakai > 0) {
        alert('Kategori "' + nama + '" masih dipakai ' + dipakai + ' produk. Pindahkan produknya ke kategori lain lewat tombol Ubah dulu.');
        return;
    }
    if (daftar.length <= 1) { alert("Minimal harus ada satu kategori."); return; }
    if (!confirm('Hapus kategori "' + nama + '"?')) return;
    const target = daftar.find(function (k) { return k.nama === nama; });
    const id = (target && target.id) || window.slugKategori(nama);
    try {
        await simpanBawaanJikaPerlu();
        await deleteDoc(doc(db, "categories", id));
        toast("Kategori dihapus ✓");
    } catch (error) {
        alert("Gagal menghapus kategori: " + (error && error.message ? error.message : error));
        console.error(error);
    }
}

function renderRows() {
    const box = document.getElementById("adminProductRows");
    if (!box) return;
    box.innerHTML = products.map(function (p) {
        const qty = stockMap[p.id];
        return '<div class="list-group-item' + (p.hidden ? ' bg-light text-muted' : '') + '"><div class="d-flex gap-3">' +
            '<img class="rounded flex-shrink-0" style="width:56px;height:56px;object-fit:cover;" src="' + esc(p.image) + '" alt="">' +
            '<div class="flex-grow-1">' +
            '<div class="fw-semibold">' + esc(p.name) + '</div>' +
            '<div class="small text-muted">' + esc(p.category) + ' · ' + rupiah(p.price) + (p.hidden ? ' · Disembunyikan' : '') + '</div>' +
            '<div class="input-group input-group-sm mt-2" style="max-width:230px;">' +
            '<input type="number" min="0" class="form-control admin-stock-input" data-id="' + p.id + '" value="' + (qty === undefined ? 0 : qty) + '">' +
            '<button type="button" class="btn btn-outline-success" data-admin="stock" data-id="' + p.id + '">Simpan Stok</button>' +
            '</div>' +
            '<div class="d-flex gap-2 mt-2">' +
            '<button type="button" class="btn btn-sm btn-outline-secondary" data-admin="edit" data-id="' + p.id + '">Ubah</button>' +
            '<button type="button" class="btn btn-sm btn-outline-warning" data-admin="toggle" data-id="' + p.id + '">' + (p.hidden ? 'Tampilkan' : 'Sembunyikan') + '</button>' +
            '</div></div></div></div>';
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
        pastikanOpsi(document.getElementById("apCategory"), p.category);
        document.getElementById("apPrice").value = p.price;
        document.getElementById("apDesc").value = p.description || "";
        document.getElementById("apStockWrap").style.display = "none";
        document.getElementById("apPhotoHint").textContent = "Kosongkan jika tidak ingin mengganti foto.";
    }
    form.style.display = "block";
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
    if (!category) { msg.textContent = "Pilih kategori produk."; return; }
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
        const tombolKategori = event.target.closest("[data-hapus-kategori]");
        if (tombolKategori) { hapusKategori(tombolKategori.dataset.hapusKategori); return; }
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
        if (event.target.id === "formKategori") tambahKategori(event);
    });
}

window.addEventListener("catalog-changed", function () {
    if (isAdmin) { renderRows(); renderKategori(); }
});

window.addEventListener("kategori-berubah", function () {
    if (isAdmin) { renderKategori(); isiPilihanKategori(); }
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
        renderKategori();
        renderRows();
        unsubscribeStock = onSnapshot(collection(db, "stock"), function (snapshot) {
            snapshot.forEach(function (docSnap) { stockMap[docSnap.id] = docSnap.data().quantity; });
            updateStockInputs();
        });
    }
});
