const pages = document.querySelectorAll(".page");
const pageButtons = document.querySelectorAll("[data-page]");
const navMenu = document.getElementById("navMenu");

// Mengamankan teks dari pengguna sebelum dimasukkan ke HTML.
function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function(c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

// Menampilkan satu halaman dan menyembunyikan halaman lain memakai kelas d-none milik Bootstrap.
function showPage(pageName) {
    pages.forEach(function(page) { page.classList.add("d-none"); });
    const targetPage = document.getElementById("page-" + pageName);
    if (targetPage) targetPage.classList.remove("d-none");
    pageButtons.forEach(function(button) {
        if (button.classList.contains("nav-link")) {
            button.classList.remove("active");
            if (button.dataset.page === pageName) button.classList.add("active");
        }
    });
    if (navMenu && navMenu.classList.contains("show") && window.bootstrap) {
        bootstrap.Collapse.getOrCreateInstance(navMenu).hide();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

pageButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        const pageName = button.dataset.page;
        if (pageName) showPage(pageName);
    });
});

const productGrid = document.getElementById("productGrid");
const productSearch = document.getElementById("productSearch");
const clearSearch = document.getElementById("clearSearch");
const categoryFilters = document.getElementById("categoryFilters");
const searchResultInfo = document.getElementById("searchResultInfo");
const featuredInner = document.getElementById("featuredInner");
const featuredIndicators = document.getElementById("featuredIndicators");

let currentSearch = "";
let currentCategory = "Semua";
let urutanProduk = "bawaan";
let halamanSekarang = 1;
const PER_HALAMAN = 12;

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

// Produk yang disembunyikan admin tidak ditampilkan ke pengunjung.
function visibleProducts() {
    return products.filter(function(product) { return !product.hidden; });
}

// Mengisi carousel "Produk Pilihan" di Beranda dengan lima produk pertama.
function renderFeatured() {
    if (!featuredInner || !featuredIndicators) return;
    const picks = visibleProducts().filter(function(p) { return p.image; }).slice(0, 5);
    featuredInner.innerHTML = picks.map(function(p, i) {
        return '<div class="carousel-item' + (i === 0 ? ' active' : '') + '">' +
            '<div class="ratio ratio-16x9"><img class="object-fit-cover" src="' + esc(p.image) + '" alt="' + esc(p.name) + '"></div>' +
            '<div class="carousel-caption d-block bg-dark bg-opacity-50 rounded p-2 mb-2">' +
            '<h3 class="h6 mb-1">' + esc(p.name) + '</h3>' +
            '<p class="small mb-1">' + formatRupiah(p.price) + '</p>' +
            '<button type="button" class="btn btn-warning btn-sm" data-featured-id="' + p.id + '">Lihat detail</button>' +
            '</div></div>';
    }).join("");
    featuredIndicators.innerHTML = picks.map(function(p, i) {
        return '<button type="button" data-bs-target="#featuredCarousel" data-bs-slide-to="' + i + '"' + (i === 0 ? ' class="active" aria-current="true"' : '') + ' aria-label="Slide ' + (i + 1) + '"></button>';
    }).join("");
}

// Membuat kartu produk untuk daftar yang sudah disaring dan dipotong per halaman.
function displayProducts(productList) {
    if (!productGrid) return;
    productGrid.innerHTML = "";
    if (productList.length === 0) {
        productGrid.innerHTML = '<div class="col-12"><div class="text-center text-muted py-5"><div class="display-4">🔎</div><h3 class="h5 mt-2">Produk tidak ditemukan</h3><p>Coba kata pencarian lain atau pilih kategori yang berbeda.</p></div></div>';
        return;
    }
    productList.forEach(function(product) {
        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = '<article class="card h-100 shadow-sm border-0 product-card" data-id="' + product.id + '" role="button" tabindex="0" aria-label="Lihat detail ' + esc(product.name) + '">' +
            '<img class="card-img-top product-img" src="' + esc(product.image) + '" alt="' + esc(product.name) + '" loading="lazy">' +
            '<div class="card-body d-flex flex-column">' +
            '<span class="badge text-bg-success align-self-start mb-2">' + esc(product.category) + '</span>' +
            '<h3 class="h6 card-title">' + esc(product.name) + '</h3>' +
            '<p class="fw-bold text-success mb-1">' + formatRupiah(product.price) + '</p>' +
            '<span class="product-stock small" data-stock-id="' + product.id + '"></span>' +
            '<span class="product-rating small text-warning" data-rating-id="' + product.id + '"></span>' +
            '<span class="small text-muted mt-auto pt-2">Lihat detail →</span>' +
            '</div></article>';
        productGrid.appendChild(col);
    });
    if (typeof window.onProductsRendered === "function") window.onProductsRendered();
}

// Mengurutkan salinan daftar produk sesuai pilihan pengguna.
function urutkanProduk(daftar) {
    const salinan = daftar.slice();
    if (urutanProduk === "termurah") salinan.sort(function(a, b) { return a.price - b.price; });
    else if (urutanProduk === "termahal") salinan.sort(function(a, b) { return b.price - a.price; });
    else if (urutanProduk === "nama") salinan.sort(function(a, b) { return String(a.name).localeCompare(String(b.name), "id"); });
    return salinan;
}

// Menggambar tombol nomor halaman memakai komponen pagination Bootstrap.
function tampilkanPaginasi(totalProduk) {
    const ul = document.getElementById("produkPagination");
    if (!ul) return 1;
    const jumlahHalaman = Math.max(1, Math.ceil(totalProduk / PER_HALAMAN));
    if (halamanSekarang > jumlahHalaman) halamanSekarang = jumlahHalaman;
    if (jumlahHalaman === 1) { ul.innerHTML = ""; return 1; }
    let html = '<li class="page-item' + (halamanSekarang === 1 ? ' disabled' : '') + '"><button type="button" class="page-link" data-halaman="' + (halamanSekarang - 1) + '">Sebelumnya</button></li>';
    for (let i = 1; i <= jumlahHalaman; i++) {
        html += '<li class="page-item' + (i === halamanSekarang ? ' active' : '') + '"><button type="button" class="page-link" data-halaman="' + i + '">' + i + '</button></li>';
    }
    html += '<li class="page-item' + (halamanSekarang === jumlahHalaman ? ' disabled' : '') + '"><button type="button" class="page-link" data-halaman="' + (halamanSekarang + 1) + '">Berikutnya</button></li>';
    ul.innerHTML = html;
    return jumlahHalaman;
}

// Alur utama katalog: saring, urutkan, potong per halaman, lalu tampilkan.
function filterProducts() {
    const search = currentSearch.trim().toLowerCase();
    const hasilSaring = visibleProducts().filter(function(product) {
        const name = String(product.name).toLowerCase();
        const category = String(product.category).toLowerCase();
        const description = String(product.description).toLowerCase();
        const matchesSearch = search === "" || name.includes(search) || category.includes(search) || description.includes(search);
        const matchesCategory = currentCategory === "Semua" || product.category === currentCategory;
        return matchesSearch && matchesCategory;
    });
    const terurut = urutkanProduk(hasilSaring);
    const jumlahHalaman = tampilkanPaginasi(terurut.length);
    const awal = (halamanSekarang - 1) * PER_HALAMAN;
    displayProducts(terurut.slice(awal, awal + PER_HALAMAN));
    updateSearchInfo(terurut.length, jumlahHalaman);
}

function updateSearchInfo(resultCount, jumlahHalaman) {
    if (!searchResultInfo) return;
    const searchText = currentSearch.trim();
    let pesan;
    if (searchText === "" && currentCategory === "Semua") pesan = "Menampilkan semua " + resultCount + " produk";
    else if (searchText !== "" && currentCategory !== "Semua") pesan = resultCount + ' produk ditemukan untuk "' + searchText + '" dalam kategori ' + currentCategory;
    else if (searchText !== "") pesan = resultCount + ' produk ditemukan untuk "' + searchText + '"';
    else pesan = resultCount + " produk dalam kategori " + currentCategory;
    if (jumlahHalaman > 1) pesan += " · halaman " + halamanSekarang + " dari " + jumlahHalaman;
    searchResultInfo.textContent = pesan;
}

// Memasang pilihan urutan dan tempat nomor halaman ke dalam halaman Produk lewat JavaScript.
function pasangKontrolKatalog() {
    if (categoryFilters && !document.getElementById("sortProduk")) {
        categoryFilters.insertAdjacentHTML("afterend",
            '<div class="d-flex align-items-center gap-2 mt-3">' +
            '<label for="sortProduk" class="small fw-semibold mb-0">Urutkan</label>' +
            '<select id="sortProduk" class="form-select form-select-sm w-auto">' +
            '<option value="bawaan">Bawaan</option>' +
            '<option value="termurah">Harga termurah</option>' +
            '<option value="termahal">Harga termahal</option>' +
            '<option value="nama">Nama A sampai Z</option>' +
            '</select></div>');
    }
    if (productGrid && !document.getElementById("produkPagination")) {
        productGrid.insertAdjacentHTML("afterend",
            '<nav class="mt-4" aria-label="Halaman produk"><ul class="pagination justify-content-center flex-wrap" id="produkPagination"></ul></nav>');
    }
    const pilihUrutan = document.getElementById("sortProduk");
    if (pilihUrutan) {
        pilihUrutan.addEventListener("change", function() {
            urutanProduk = pilihUrutan.value;
            halamanSekarang = 1;
            filterProducts();
        });
    }
    const daftarHalaman = document.getElementById("produkPagination");
    if (daftarHalaman) {
        daftarHalaman.addEventListener("click", function(event) {
            const tombol = event.target.closest("[data-halaman]");
            if (!tombol) return;
            halamanSekarang = Number(tombol.dataset.halaman);
            filterProducts();
            if (productGrid) productGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
}

if (productSearch) {
    productSearch.addEventListener("input", function() {
        currentSearch = productSearch.value;
        halamanSekarang = 1;
        filterProducts();
    });
}

if (clearSearch) {
    clearSearch.addEventListener("click", function() {
        if (productSearch) productSearch.value = "";
        currentSearch = "";
        halamanSekarang = 1;
        filterProducts();
        if (productSearch) productSearch.focus();
    });
}

if (categoryFilters) {
    categoryFilters.addEventListener("click", function(event) {
        const button = event.target.closest(".filter-button");
        if (!button) return;
        currentCategory = button.dataset.category;
        halamanSekarang = 1;
        categoryFilters.querySelectorAll(".filter-button").forEach(function(item) { item.classList.remove("active"); });
        button.classList.add("active");
        filterProducts();
    });
}

const productModal = document.getElementById("productModal");
const modalProductIcon = document.getElementById("modalProductIcon");
const modalProductCategory = document.getElementById("modalProductCategory");
const modalProductName = document.getElementById("modalProductName");
const modalProductPrice = document.getElementById("modalProductPrice");
const modalProductDescription = document.getElementById("modalProductDescription");
const modalPromoButton = document.getElementById("modalPromoButton");

let selectedProductForPromo = null;

function modalInstance() {
    return (window.bootstrap && productModal) ? bootstrap.Modal.getOrCreateInstance(productModal) : null;
}

// Mengisi jendela detail produk lalu membukanya (komponen modal Bootstrap).
function showProductDetail(product) {
    if (!productModal) return;
    if (modalProductIcon) { modalProductIcon.src = product.image; modalProductIcon.alt = product.name; }
    if (modalProductCategory) modalProductCategory.textContent = product.category;
    if (modalProductName) modalProductName.textContent = product.name;
    if (modalProductPrice) modalProductPrice.textContent = formatRupiah(product.price);
    if (modalProductDescription) modalProductDescription.textContent = product.description;
    selectedProductForPromo = product;
    window.selectedProductForPromo = product;
    const modal = modalInstance();
    if (modal) modal.show();
    if (typeof window.onProductDetailShown === "function") window.onProductDetailShown(product);
}

function closeProductModal() {
    const modal = modalInstance();
    if (modal) modal.hide();
}

function setupProductInteraction() {
    if (productGrid) {
        productGrid.addEventListener("click", function(event) {
            const card = event.target.closest(".product-card");
            if (!card) return;
            const product = products.find(function(item) { return item.id === Number(card.dataset.id); });
            if (product) showProductDetail(product);
        });
        productGrid.addEventListener("keydown", function(event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            const card = event.target.closest(".product-card");
            if (!card) return;
            event.preventDefault();
            const product = products.find(function(item) { return item.id === Number(card.dataset.id); });
            if (product) showProductDetail(product);
        });
    }
    if (featuredInner) {
        featuredInner.addEventListener("click", function(event) {
            const button = event.target.closest("[data-featured-id]");
            if (!button) return;
            const product = products.find(function(item) { return item.id === Number(button.dataset.featuredId); });
            if (product) showProductDetail(product);
        });
    }
}

const recommendationProduct = document.getElementById("recommendationProduct");
const recommendationTarget = document.getElementById("recommendationTarget");
const recommendationPlatform = document.getElementById("recommendationPlatform");
const recommendationStyle = document.getElementById("recommendationStyle");
const recommendationButton = document.getElementById("recommendationButton");
const recommendationResult = document.getElementById("recommendationResult");
const resultIdea = document.getElementById("resultIdea");
const resultCaption = document.getElementById("resultCaption");
const resultHashtag = document.getElementById("resultHashtag");
const copyRecommendation = document.getElementById("copyRecommendation");

function loadRecommendationProducts() {
    if (!recommendationProduct) return;
    recommendationProduct.innerHTML = '<option value="">Pilih Produk</option>';
    visibleProducts().forEach(function(product) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name;
        recommendationProduct.appendChild(option);
    });
}

// Dipanggil catalog.js setiap kali data produk dari Firestore berubah.
window.refreshCatalog = function() {
    const selected = recommendationProduct ? recommendationProduct.value : "";
    loadRecommendationProducts();
    if (recommendationProduct && selected) recommendationProduct.value = selected;
    filterProducts();
    renderFeatured();
};

if (modalPromoButton) {
    modalPromoButton.addEventListener("click", function() {
        if (selectedProductForPromo && recommendationProduct) recommendationProduct.value = String(selectedProductForPromo.id);
        closeProductModal();
        showPage("rekomendasi");
    });
}

function getTargetName(v) { return { Remaja: "Remaja", Mahasiswa: "Mahasiswa", Keluarga: "Keluarga", "Masyarakat Umum": "Masyarakat Umum" }[v] || v; }
function getPlatformName(v) { return { Instagram: "Instagram", TikTok: "TikTok", Facebook: "Facebook", WhatsApp: "WhatsApp" }[v] || v; }

// Menyusun ide, caption, dan hashtag dari template berdasarkan pilihan pengguna (bukan AI).
function generateRecommendation() {
    if (!recommendationProduct || !recommendationTarget || !recommendationPlatform || !recommendationStyle) return;
    const productId = Number(recommendationProduct.value);
    const target = recommendationTarget.value;
    const platform = recommendationPlatform.value;
    const style = recommendationStyle.value;
    if (!productId || !target || !platform || !style) { alert("Silakan lengkapi Produk, Target Audiens, Platform, dan Gaya Konten terlebih dahulu."); return; }
    const product = products.find(function(item) { return item.id === productId; });
    if (!product) return;
    const targetName = getTargetName(target);
    const platformName = getPlatformName(platform);
    let idea = "";
    if (style === "Informatif") idea = "Buat konten informatif tentang " + product.name + ". Jelaskan karakteristik, keunggulan, dan informasi penting produk agar mudah dipahami oleh " + targetName + ".";
    else if (style === "Promosi") idea = "Buat konten promosi untuk " + product.name + " dengan menonjolkan daya tarik produk, harga simulasi, dan alasan produk layak diperkenalkan kepada " + targetName + ".";
    else if (style === "Storytelling") idea = "Buat konten storytelling tentang " + product.name + " dengan menceritakan karakter produk dan pengalaman yang ingin dibangun untuk " + targetName + ".";
    else idea = "Buat konten santai tentang " + product.name + " menggunakan bahasa ringan, menarik, dan mudah dipahami oleh " + targetName + ".";
    let caption = "";
    if (style === "Promosi") caption = "✨ Kenalan dengan " + product.name + "!\n\n" + product.description + "\n\nHarga simulasi: " + formatRupiah(product.price) + ".\n\nKonten ini ditujukan untuk " + targetName + " dan dapat dipublikasikan melalui " + platformName + ".\n\nYuk kenali dan dukung produk UMKM lokal!";
    else if (style === "Informatif") caption = "📌 Mengenal " + product.name + "\n\n" + product.description + "\n\nInformasi ini dapat disampaikan kepada " + targetName + " melalui " + platformName + " dengan gaya yang mudah dipahami.\n\nKenali produk lokal dan dukung UMKM Indonesia.";
    else if (style === "Storytelling") caption = "📖 Cerita di balik " + product.name + "\n\n" + product.description + "\n\nSetiap produk lokal memiliki cerita dan karakter tersendiri. Mari memperkenalkannya kepada " + targetName + " melalui " + platformName + ".\n\nDukung kreativitas dan produk UMKM lokal.";
    else caption = "👋 Hai! Kenalan dengan " + product.name + ".\n\n" + product.description + "\n\nKonten santai ini cocok untuk " + targetName + " dan dapat dibagikan melalui " + platformName + ".\n\nYuk kenali produk lokal hari ini!";
    const categoryTag = product.category.replace(/\s/g, "").replace(/\//g, "");
    const hashtag = "#UMKM #ProdukLokal #UMKMIndonesia #" + categoryTag + " #DigitalMarketing #" + platform;
    if (resultIdea) resultIdea.textContent = idea;
    if (resultCaption) resultCaption.textContent = caption;
    if (resultHashtag) resultHashtag.textContent = hashtag;
    if (recommendationResult) recommendationResult.classList.remove("d-none");
}

if (recommendationButton) recommendationButton.addEventListener("click", generateRecommendation);

function copyRecommendationContent() {
    if (!resultCaption || !resultHashtag) return;
    const content = resultCaption.textContent + "\n\n" + resultHashtag.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(function() { alert("Konten berhasil disalin."); }).catch(function() { alert("Konten tidak dapat disalin otomatis."); });
    }
}

if (copyRecommendation) copyRecommendation.addEventListener("click", copyRecommendationContent);

loadRecommendationProducts();
setupProductInteraction();
pasangKontrolKatalog();
filterProducts();
renderFeatured();
showPage("beranda");
