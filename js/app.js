const pages = document.querySelectorAll(".page");
const pageButtons = document.querySelectorAll("[data-page]");

function showPage(pageName) {
    pages.forEach(function(page) { page.classList.remove("active"); });
    const targetPage = document.getElementById("page-" + pageName);
    if (targetPage) targetPage.classList.add("active");
    pageButtons.forEach(function(button) {
        if (button.classList.contains("nav-link")) {
            button.classList.remove("active");
            if (button.dataset.page === pageName) button.classList.add("active");
        }
    });
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

let currentSearch = "";
let currentCategory = "Semua";

function formatRupiah(price) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function displayProducts(productList) {
    if (!productGrid) return;
    productGrid.innerHTML = "";
    if (productList.length === 0) {
        productGrid.innerHTML = '<div class="empty-product-result"><div class="empty-icon">🔎</div><h3>Produk tidak ditemukan</h3><p>Coba gunakan kata pencarian lain atau pilih kategori yang berbeda.</p></div>';
        return;
    }
    productList.forEach(function(product) {
        const card = document.createElement("article");
        card.className = "product-card";
        card.dataset.id = product.id;
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", "Lihat detail " + product.name);
        card.innerHTML = '<div class="product-image"><img src="' + product.image + '" alt="' + product.name + '" loading="lazy"></div><div class="product-info"><span class="product-category">' + product.category + '</span><h3>' + product.name + '</h3><p class="product-price">' + formatRupiah(product.price) + '</p><span class="product-detail-hint">Lihat detail →</span></div>';
        productGrid.appendChild(card);
    });
}

function filterProducts() {
    const search = currentSearch.trim().toLowerCase();
    const filteredProducts = products.filter(function(product) {
        const name = String(product.name).toLowerCase();
        const category = String(product.category).toLowerCase();
        const description = String(product.description).toLowerCase();
        const matchesSearch = search === "" || name.includes(search) || category.includes(search) || description.includes(search);
        const matchesCategory = currentCategory === "Semua" || product.category === currentCategory;
        return matchesSearch && matchesCategory;
    });
    displayProducts(filteredProducts);
    updateSearchInfo(filteredProducts.length);
}

function updateSearchInfo(resultCount) {
    if (!searchResultInfo) return;
    const searchText = currentSearch.trim();
    if (searchText === "" && currentCategory === "Semua") { searchResultInfo.textContent = "Menampilkan semua " + products.length + " produk"; return; }
    if (searchText !== "" && currentCategory !== "Semua") { searchResultInfo.textContent = resultCount + ' produk ditemukan untuk "' + searchText + '" dalam kategori ' + currentCategory; return; }
    if (searchText !== "") { searchResultInfo.textContent = resultCount + ' produk ditemukan untuk "' + searchText + '"'; return; }
    searchResultInfo.textContent = resultCount + " produk dalam kategori " + currentCategory;
}

if (productSearch) {
    productSearch.addEventListener("input", function() {
        currentSearch = productSearch.value;
        if (clearSearch) { if (currentSearch.trim() !== "") clearSearch.classList.add("active"); else clearSearch.classList.remove("active"); }
        filterProducts();
    });
}

if (clearSearch) {
    clearSearch.addEventListener("click", function() {
        if (productSearch) productSearch.value = "";
        currentSearch = "";
        clearSearch.classList.remove("active");
        filterProducts();
        if (productSearch) productSearch.focus();
    });
}

if (categoryFilters) {
    categoryFilters.addEventListener("click", function(event) {
        const button = event.target.closest(".filter-button");
        if (!button) return;
        currentCategory = button.dataset.category;
        categoryFilters.querySelectorAll(".filter-button").forEach(function(item) { item.classList.remove("active"); });
        button.classList.add("active");
        filterProducts();
    });
}

const productModal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");
const modalProductIcon = document.getElementById("modalProductIcon");
const modalProductCategory = document.getElementById("modalProductCategory");
const modalProductName = document.getElementById("modalProductName");
const modalProductPrice = document.getElementById("modalProductPrice");
const modalProductDescription = document.getElementById("modalProductDescription");
const modalPromoButton = document.getElementById("modalPromoButton");

let selectedProductForPromo = null;

function showProductDetail(product) {
    if (!productModal) return;
    if (modalProductIcon) { modalProductIcon.src = product.image; modalProductIcon.alt = product.name; }
    if (modalProductCategory) modalProductCategory.textContent = product.category;
    if (modalProductName) modalProductName.textContent = product.name;
    if (modalProductPrice) modalProductPrice.textContent = formatRupiah(product.price);
    if (modalProductDescription) modalProductDescription.textContent = product.description;
    selectedProductForPromo = product;
    window.selectedProductForPromo = product;
    productModal.classList.add("active");
    document.body.classList.add("modal-open");
}

function closeProductModal() {
    if (!productModal) return;
    productModal.classList.remove("active");
    document.body.classList.remove("modal-open");
}

if (modalClose) modalClose.addEventListener("click", closeProductModal);
if (productModal) { productModal.addEventListener("click", function(event) { if (event.target === productModal) closeProductModal(); }); }
document.addEventListener("keydown", function(event) { if (event.key === "Escape") closeProductModal(); });

function setupProductInteraction() {
    if (!productGrid) return;
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
    products.forEach(function(product) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name;
        recommendationProduct.appendChild(option);
    });
}

if (modalPromoButton) {
    modalPromoButton.addEventListener("click", function() {
        if (selectedProductForPromo && recommendationProduct) recommendationProduct.value = String(selectedProductForPromo.id);
        closeProductModal();
        showPage("rekomendasi");
    });
}

function getTargetName(v) { return { Remaja: "Remaja", Mahasiswa: "Mahasiswa", Keluarga: "Keluarga", "Masyarakat Umum": "Masyarakat Umum" }[v] || v; }
function getPlatformName(v) { return { Instagram: "Instagram", TikTok: "TikTok", Facebook: "Facebook", WhatsApp: "WhatsApp" }[v] || v; }

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
    if (recommendationResult) recommendationResult.classList.add("active");
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

displayProducts(products);
loadRecommendationProducts();
setupProductInteraction();
filterProducts();
showPage("beranda");
