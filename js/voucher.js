import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);

let dataVoucher = {};
let berhentiDengar = null;
let kotak = null;

function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function rupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

// Membuat kotak "Voucher diskon" di halaman Kelola, tepat di atas daftar kategori dan produk.
function pasangKotak() {
    if (kotak) return;
    const daftarProduk = document.getElementById("adminStockList");
    if (!daftarProduk) return;
    kotak = document.createElement("div");
    kotak.id = "voucherAdmin";
    kotak.style.display = "none";
    kotak.innerHTML =
        '<div class="card border-0 shadow-sm mb-3"><div class="card-body">' +
        '<h3 class="h6">Voucher diskon</h3>' +
        '<form id="formVoucher" class="row g-2 mb-2">' +
        '<div class="col-6 col-md-3"><label for="vKode" class="form-label small mb-0">Kode</label><input type="text" class="form-control form-control-sm text-uppercase" id="vKode" maxlength="15" placeholder="HEMAT10" autocomplete="off" required></div>' +
        '<div class="col-6 col-md-3"><label for="vJenis" class="form-label small mb-0">Jenis</label><select class="form-select form-select-sm" id="vJenis"><option value="persen">Persen (%)</option><option value="nominal">Potongan (Rp)</option></select></div>' +
        '<div class="col-6 col-md-3"><label for="vNilai" class="form-label small mb-0">Nilai</label><input type="number" class="form-control form-control-sm" id="vNilai" min="1" step="1" required></div>' +
        '<div class="col-6 col-md-3"><label for="vMinimal" class="form-label small mb-0">Minimal belanja (Rp)</label><input type="number" class="form-control form-control-sm" id="vMinimal" min="0" step="1" value="0"></div>' +
        '<div class="col-6 col-md-3"><label for="vKuota" class="form-label small mb-0">Kuota (0 = tanpa batas)</label><input type="number" class="form-control form-control-sm" id="vKuota" min="0" step="1" value="0"></div>' +
        '<div class="col-6 col-md-3"><label for="vSampai" class="form-label small mb-0">Berlaku sampai</label><input type="date" class="form-control form-control-sm" id="vSampai"></div>' +
        '<div class="col-12 col-md-6 d-flex align-items-end"><button type="submit" class="btn btn-success btn-sm">Tambah Voucher</button></div>' +
        '</form>' +
        '<div class="form-text text-danger mb-2" id="pesanVoucherAdmin"></div>' +
        '<div class="list-group" id="daftarVoucher"></div>' +
        '</div></div>';
    daftarProduk.insertAdjacentElement("beforebegin", kotak);

    document.getElementById("formVoucher").addEventListener("submit", tambahVoucher);
    document.getElementById("daftarVoucher").addEventListener("click", aksiDaftar);
}

function gambarDaftar() {
    const wadah = document.getElementById("daftarVoucher");
    if (!wadah) return;
    const kodeKode = Object.keys(dataVoucher).sort();
    if (kodeKode.length === 0) {
        wadah.innerHTML = '<div class="text-muted small">Belum ada voucher.</div>';
        return;
    }
    wadah.innerHTML = kodeKode.map(function (kode) {
        const v = dataVoucher[kode];
        const potongan = v.jenis === "persen" ? v.nilai + "%" : rupiah(v.nilai);
        const kuota = v.kuota > 0 ? v.terpakai + "/" + v.kuota : v.terpakai + " (tanpa batas)";
        const sampai = v.berlakuSampai ? new Date(v.berlakuSampai).toLocaleDateString("id-ID") : "tanpa batas waktu";
        return '<div class="list-group-item d-flex justify-content-between align-items-start gap-2' + (v.aktif ? '' : ' bg-light text-muted') + '">' +
            '<div><strong>' + esc(v.kode) + '</strong> <span class="badge ' + (v.aktif ? 'text-bg-success' : 'text-bg-secondary') + '">' + (v.aktif ? 'Aktif' : 'Nonaktif') + '</span>' +
            '<div class="small">Potongan ' + potongan + ' · minimal ' + rupiah(v.minimal) + ' · terpakai ' + kuota + ' · sampai ' + sampai + '</div></div>' +
            '<div class="d-flex gap-1">' +
            '<button type="button" class="btn btn-sm btn-outline-warning" data-v-toggle="' + esc(v.kode) + '">' + (v.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
            '<button type="button" class="btn btn-sm btn-outline-danger" data-v-hapus="' + esc(v.kode) + '">Hapus</button>' +
            '</div></div>';
    }).join("");
}

async function tambahVoucher(event) {
    event.preventDefault();
    const pesan = document.getElementById("pesanVoucherAdmin");
    pesan.textContent = "";
    const kode = document.getElementById("vKode").value.trim().toUpperCase();
    const jenis = document.getElementById("vJenis").value;
    const nilai = Math.floor(Number(document.getElementById("vNilai").value));
    const minimal = Math.max(0, Math.floor(Number(document.getElementById("vMinimal").value) || 0));
    const kuota = Math.max(0, Math.floor(Number(document.getElementById("vKuota").value) || 0));
    const tanggal = document.getElementById("vSampai").value;

    if (!/^[A-Z0-9]{3,15}$/.test(kode)) { pesan.textContent = "Kode hanya huruf dan angka, 3 sampai 15 karakter."; return; }
    if (dataVoucher[kode]) { pesan.textContent = "Kode itu sudah ada."; return; }
    if (!Number.isFinite(nilai) || nilai < 1) { pesan.textContent = "Nilai potongan tidak valid."; return; }
    if (jenis === "persen" && nilai > 90) { pesan.textContent = "Potongan persen maksimal 90."; return; }

    try {
        await setDoc(doc(db, "vouchers", kode), {
            kode: kode,
            jenis: jenis,
            nilai: nilai,
            minimal: minimal,
            kuota: kuota,
            terpakai: 0,
            aktif: true,
            berlakuSampai: tanggal ? new Date(tanggal + "T23:59:59").getTime() : null,
            dibuat: Date.now()
        });
        document.getElementById("formVoucher").reset();
        document.getElementById("vMinimal").value = 0;
        document.getElementById("vKuota").value = 0;
    } catch (error) {
        pesan.textContent = error && error.code === "permission-denied"
            ? "Ditolak Firestore. Pastikan Rules terbaru sudah di-publish."
            : "Gagal menambah voucher: " + (error && error.message ? error.message : error);
        console.error(error);
    }
}

function aksiDaftar(event) {
    const toggle = event.target.closest("[data-v-toggle]");
    const hapus = event.target.closest("[data-v-hapus]");
    if (toggle) {
        const kode = toggle.dataset.vToggle;
        updateDoc(doc(db, "vouchers", kode), { aktif: !dataVoucher[kode].aktif })
            .catch(function (error) { alert("Gagal mengubah voucher: " + error.message); });
    }
    if (hapus) {
        const kode = hapus.dataset.vHapus;
        if (!confirm('Hapus voucher "' + kode + '"?')) return;
        deleteDoc(doc(db, "vouchers", kode))
            .catch(function (error) { alert("Gagal menghapus voucher: " + error.message); });
    }
}

onAuthStateChanged(auth, function (user) {
    const admin = !!(user && user.email === ADMIN_EMAIL);
    if (berhentiDengar) { berhentiDengar(); berhentiDengar = null; }
    if (!admin) {
        if (kotak) kotak.style.display = "none";
        return;
    }
    pasangKotak();
    if (!kotak) return;
    kotak.style.display = "block";
    berhentiDengar = onSnapshot(collection(db, "vouchers"), function (snapshot) {
        dataVoucher = {};
        snapshot.forEach(function (d) { dataVoucher[d.id] = d.data(); });
        gambarDaftar();
    }, function (error) {
        console.error("Gagal memuat voucher:", error);
    });
});
