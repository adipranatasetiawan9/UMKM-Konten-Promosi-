import { app } from "./firebase-config.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const db = getFirestore(app);
const baseProducts = products.map(function (p) { return Object.assign({}, p); });
const baseIds = new Set(baseProducts.map(function (p) { return String(p.id); }));
const FIELDS = ["name", "category", "price", "description", "image", "hidden"];

// Produk yang disembunyikan dianggap stok 0, supaya tidak bisa dibeli lewat keranjang lama.
const originalGetStockQty = window.getStockQty;
window.getStockQty = function (productId) {
    const p = products.find(function (item) { return item.id === productId; });
    if (p && p.hidden) return 0;
    return typeof originalGetStockQty === "function" ? originalGetStockQty(productId) : undefined;
};

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
