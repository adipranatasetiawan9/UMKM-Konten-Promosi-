import { app } from "./firebase-config.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);

// Salinan produk bawaan dari products.js, dipakai sebagai dasar sebelum digabung dengan data Firestore.
const baseProducts = products.map(function (p) { return Object.assign({}, p); });
const baseIds = new Set(baseProducts.map(function (p) { return String(p.id); }));
const FIELDS = ["name", "category", "price", "description", "image", "hidden"];
const KATEGORI_BAWAAN = ["Makanan", "Minuman", "Fashion", "Kerajinan"];

// Dipakai juga oleh admin.js.
window.KATEGORI_BAWAAN = KATEGORI_BAWAAN;
window.kategoriData = {
    daftar: KATEGORI_BAWAAN.map(function (nama) { return { id: null, nama: nama }; }),
    dariDatabase: false
};

// Membuat id dokumen dari nama kategori, contoh "Oleh Oleh" menjadi "oleh-oleh".
window.slugKategori = function (nama) {
    const slug = String(nama).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || String(Date.now());
};

function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

// Produk yang disembunyikan dianggap stok 0, supaya tidak bisa dibeli lewat keranjang lama.
const originalGetStockQty = window.getStockQty;
window.getStockQty = function (productId) {
    const p = products.find(function (item) { return item.id === productId; });
    if (p && p.hidden) return 0;
    return typeof originalGetStockQty === "function" ? originalGetStockQty(productId) : undefined;
};

// Menggambar ulang tombol filter kategori di halaman Produk sesuai daftar terbaru.
function gambarFilterKategori() {
    const wadah = document.getElementById("categoryFilters");
    if (!wadah) return;
    const aktif = wadah.querySelector(".filter-button.active");
    const namaAktif = aktif ? aktif.dataset.category : "Semua";
    const semuaNama = ["Semua"].concat(window.kategoriData.daftar.map(function (k) { return k.nama; }));
    const masihAda = semuaNama.indexOf(namaAktif) !== -1;
    const yangAktif = masihAda ? namaAktif : "Semua";
    wadah.innerHTML = semuaNama.map(function (nama) {
        return '<button type="button" class="btn btn-sm btn-outline-success filter-button' + (nama === yangAktif ? ' active' : '') + '" data-category="' + esc(nama) + '">' + esc(nama) + '</button>';
    }).join("");
    // Kalau kategori yang sedang dipilih sudah dihapus admin, kembali ke "Semua".
    if (!masihAda) {
        const tombolSemua = wadah.querySelector('[data-category="Semua"]');
        if (tombolSemua) tombolSemua.click();
    }
}

onSnapshot(collection(db, "categories"), function (snapshot) {
    const dariDb = [];
    snapshot.forEach(function (d) {
        const data = d.data();
        if (data && data.nama) dariDb.push({ id: d.id, nama: data.nama, urutan: data.urutan || 0 });
    });
    if (dariDb.length === 0) {
        // Belum ada kategori di database: pakai kategori bawaan.
        window.kategoriData = {
            daftar: KATEGORI_BAWAAN.map(function (nama) { return { id: null, nama: nama }; }),
            dariDatabase: false
        };
    } else {
        dariDb.sort(function (a, b) { return a.urutan - b.urutan; });
        window.kategoriData = { daftar: dariDb, dariDatabase: true };
    }
    gambarFilterKategori();
    window.dispatchEvent(new CustomEvent("kategori-berubah"));
}, function (error) {
    console.error("Gagal memuat kategori dari Firestore:", error);
});

// Menggabungkan produk bawaan dengan perubahan dan tambahan dari admin di koleksi "products".
onSnapshot(collection(db, "products"), function (snapshot) {
    const overrides = {};
    snapshot.forEach(function (d) { overrides[d.id] = d.data(); });

    const merged = baseProducts.map(function (base) {
        const copy = Object.assign({}, base);
        const o = overrides[String(base.id)];
        if (o) {
            FIELDS.forEach(function (f) { if (o[f] !== undefined) copy[f] = o[f]; });
        }
        return copy;
    });

    Object.keys(overrides).forEach(function (key) {
        if (baseIds.has(key)) return;
        const o = overrides[key];
        merged.push({
            id: Number(key),
            name: o.name,
            category: o.category,
            price: o.price,
            description: o.description || "",
            image: o.image || "",
            hidden: !!o.hidden,
            custom: true
        });
    });

    products.length = 0;
    merged.forEach(function (p) { products.push(p); });

    if (typeof window.refreshCatalog === "function") window.refreshCatalog();
    if (typeof window.onStockChanged === "function") window.onStockChanged();
    window.dispatchEvent(new CustomEvent("catalog-changed"));
}, function (error) {
    console.error("Gagal memuat katalog dari Firestore:", error);
});
