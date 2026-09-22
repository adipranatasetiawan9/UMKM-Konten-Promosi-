/*
 * UMKM PROMO
 * Main JavaScript
 * R. Adi Pranata Setiawan
 * 2026/2027
 */


/* =========================
   ELEMENT
   ========================= */

const productGrid =
    document.getElementById("productGrid");

const productModal =
    document.getElementById("productModal");

const modalClose =
    document.getElementById("modalClose");

const modalProductIcon =
    document.getElementById("modalProductIcon");

const modalProductName =
    document.getElementById("modalProductName");

const modalProductPrice =
    document.getElementById("modalProductPrice");

const modalProductCategory =
    document.getElementById("modalProductCategory");

const modalProductDescription =
    document.getElementById("modalProductDescription");

const modalPromoButton =
    document.getElementById("modalPromoButton");


/* =========================
   REKOMENDASI ELEMENT
   ========================= */

const recommendationButton =
    document.getElementById("recommendationButton");

const recommendationProduct =
    document.getElementById("recommendationProduct");

const recommendationTarget =
    document.getElementById("recommendationTarget");

const recommendationPlatform =
    document.getElementById("recommendationPlatform");

const recommendationStyle =
    document.getElementById("recommendationStyle");

const recommendationResult =
    document.getElementById("recommendationResult");

const resultIdea =
    document.getElementById("resultIdea");

const resultCaption =
    document.getElementById("resultCaption");

const resultHashtag =
    document.getElementById("resultHashtag");

const copyRecommendation =
    document.getElementById("copyRecommendation");


/* =========================
   FORMAT RUPIAH
   ========================= */

function formatRupiah(price) {

    return new Intl.NumberFormat("id-ID", {

        style: "currency",

        currency: "IDR",

        maximumFractionDigits: 0

    }).format(price);

}


/* =========================
   TAMPILKAN PRODUK
   ========================= */

function displayProducts() {

    if (!productGrid) {
        return;
    }

    productGrid.innerHTML = "";

    products.forEach(function(product) {

        const card =
            document.createElement("article");

        card.className =
            "product-card";

        card.dataset.id =
            product.id;

        card.innerHTML = `

            <div class="product-image">

                ${product.icon}

            </div>

            <div class="product-info">

                <span class="product-category">

                    ${product.category}

                </span>

                <h3>

                    ${product.name}

                </h3>

                <p class="product-price">

                    ${formatRupiah(product.price)}

                </p>

            </div>

        `;

        productGrid.appendChild(card);

    });

}


/* =========================
   DETAIL PRODUK
   ========================= */

function showProductDetail(product) {

    if (!productModal) {
        return;
    }

    modalProductIcon.textContent =
        product.icon;

    modalProductName.textContent =
        product.name;

    modalProductPrice.textContent =
        formatRupiah(product.price);

    modalProductCategory.textContent =
        product.category;

    modalProductDescription.textContent =
        product.description;

    modalPromoButton.onclick =
        function() {

            document
                .getElementById("rekomendasi")
                .scrollIntoView({
                    behavior: "smooth"
                });

            closeProductModal();

            if (recommendationProduct) {

                recommendationProduct.value =
                    product.id;

            }

        };

    productModal.classList.add(
        "active"
    );

}


/* =========================
   TUTUP MODAL
   ========================= */

function closeProductModal() {

    if (!productModal) {
        return;
    }

    productModal.classList.remove(
        "active"
    );

}


/* =========================
   INTERAKSI PRODUK
   ========================= */

function setupProductInteraction() {

    if (!productGrid) {
        return;
    }

    productGrid.addEventListener(
        "click",
        function(event) {

            const card =
                event.target.closest(
                    ".product-card"
                );

            if (!card) {
                return;
            }

            const productId =
                Number(
                    card.dataset.id
                );

            const selectedProduct =
                products.find(
                    function(product) {

                        return product.id ===
                            productId;

                    }
                );

            if (selectedProduct) {

                showProductDetail(
                    selectedProduct
                );

            }

        }
    );

}


/* =========================
   TUTUP MODAL
   ========================= */

if (modalClose) {

    modalClose.addEventListener(
        "click",
        closeProductModal
    );

}


if (productModal) {

    productModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                productModal
            ) {

                closeProductModal();

            }

        }
    );

}


/* =========================
   ISI PILIHAN PRODUK
   ========================= */

function loadRecommendationProducts() {

    if (!recommendationProduct) {
        return;
    }

    products.forEach(
        function(product) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                product.id;

            option.textContent =
                product.name;

            recommendationProduct
                .appendChild(option);

        }
    );

}


/* =========================
   MESIN REKOMENDASI
   ========================= */

function generateRecommendation() {

    const productId =
        Number(
            recommendationProduct.value
        );

    const target =
        recommendationTarget.value;

    const platform =
        recommendationPlatform.value;

    const style =
        recommendationStyle.value;


    /* =========================
       VALIDASI
       ========================= */

    if (
        !productId ||
        !target ||
        !platform ||
        !style
    ) {

        alert(
            "Silakan lengkapi semua pilihan terlebih dahulu."
        );

        return;

    }


    /* =========================
       CARI PRODUK
       ========================= */

    const product =
        products.find(
            function(item) {

                return item.id ===
                    productId;

            }
        );


    if (!product) {
        return;
    }


    /* =========================
       IDE KONTEN
       ========================= */

    let idea = "";


    if (style === "informatif") {

        idea =
            `Buat konten informatif tentang ${product.name} dengan menjelaskan keunggulan, manfaat, dan karakteristik produk.`;

    }

    else if (style === "promosi") {

        idea =
            `Buat konten promosi ${product.name} dengan menonjolkan harga dan alasan mengapa produk menarik untuk dibeli.`;

    }

    else if (style === "storytelling") {

        idea =
            `Ceritakan kisah di balik ${product.name}, mulai dari proses pembuatan hingga menjadi produk yang siap digunakan atau dikonsumsi.`;

    }

    else {

        idea =
            `Buat konten santai tentang ${product.name} menggunakan bahasa ringan dan mudah dipahami oleh audiens.`;

    }


    /* =========================
       CAPTION
       ========================= */

    let caption = "";


    if (style === "promosi") {

        caption =

            `Yuk kenalan dengan ${product.name}! ✨\n\n` +

            `${product.description}\n\n` +

            `Hanya dengan ${formatRupiah(product.price)}, ` +

            `kamu sudah bisa mendapatkan produk lokal yang menarik ini.\n\n` +

            `Cocok untuk ${target}. ` +

            `Yuk dukung produk UMKM lokal!`;

    }

    else {

        caption =

            `Kenalan dengan ${product.name} 👋\n\n` +

            `${product.description}\n\n` +

            `Produk ini cocok diperkenalkan kepada ${target} ` +

            `melalui ${platform}.\n\n` +

            `Yuk dukung dan kenali produk UMKM lokal!`;

    }


    /* =========================
       HASHTAG
       ========================= */

    const hashtag =

        `#UMKM ` +

        `#ProdukLokal ` +

        `#UMKMIndonesia ` +

        `#${product.category.replace(/\s/g, "")} ` +

        `#DigitalMarketing ` +

        `#${platform}`;


    /* =========================
       TAMPILKAN HASIL
       ========================= */

    resultIdea.textContent =
        idea;

    resultCaption.textContent =
        caption;

    resultHashtag.textContent =
        hashtag;


    recommendationResult.classList.add(
        "active"
    );


    recommendationResult.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================
   EVENT REKOMENDASI
   ========================= */

if (recommendationButton) {

    recommendationButton.addEventListener(
        "click",
        generateRecommendation
    );

}


/* =========================
   SALIN KONTEN
   ========================= */

function copyRecommendationContent() {

    const content =

        `${resultCaption.textContent}

${resultHashtag.textContent}`;


    navigator.clipboard.writeText(
        content
    )

    .then(function() {

        alert(
            "Konten berhasil disalin."
        );

    })

    .catch(function() {

        alert(
            "Konten tidak dapat disalin otomatis."
        );

    });

}


if (copyRecommendation) {

    copyRecommendation.addEventListener(
        "click",
        copyRecommendationContent
    );

}


/* =========================
   INITIALIZE
   ========================= */

displayProducts();

setupProductInteraction();

loadRecommendationProducts();
