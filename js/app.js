/*
 * UMKM PROMO
 * Main JavaScript
 * Raden Adi Pranata Setiawan
 * 2026/2027
 */


/* =========================
   ELEMENT
========================= */

const pages =
    document.querySelectorAll(".page");

const navLinks =
    document.querySelectorAll(
        ".nav-link"
    );

const pageButtons =
    document.querySelectorAll(
        "[data-page]"
    );


const productGrid =
    document.getElementById(
        "productGrid"
    );


/* =========================
   REKOMENDASI ELEMENT
========================= */

const recommendationProduct =
    document.getElementById(
        "recommendationProduct"
    );

const recommendationTarget =
    document.getElementById(
        "recommendationTarget"
    );

const recommendationPlatform =
    document.getElementById(
        "recommendationPlatform"
    );

const recommendationStyle =
    document.getElementById(
        "recommendationStyle"
    );

const recommendationButton =
    document.getElementById(
        "recommendationButton"
    );

const recommendationResult =
    document.getElementById(
        "recommendationResult"
    );

const resultIdea =
    document.getElementById(
        "resultIdea"
    );

const resultCaption =
    document.getElementById(
        "resultCaption"
    );

const resultHashtag =
    document.getElementById(
        "resultHashtag"
    );

const copyRecommendation =
    document.getElementById(
        "copyRecommendation"
    );


/* =========================
   MODAL ELEMENT
========================= */

const productModal =
    document.getElementById(
        "productModal"
    );

const modalClose =
    document.getElementById(
        "modalClose"
    );

const modalProductIcon =
    document.getElementById(
        "modalProductIcon"
    );

const modalProductCategory =
    document.getElementById(
        "modalProductCategory"
    );

const modalProductName =
    document.getElementById(
        "modalProductName"
    );

const modalProductPrice =
    document.getElementById(
        "modalProductPrice"
    );

const modalProductDescription =
    document.getElementById(
        "modalProductDescription"
    );

const modalPromoButton =
    document.getElementById(
        "modalPromoButton"
    );


/* =========================
   FORMAT RUPIAH
========================= */

function formatRupiah(price) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(price);

}


/* =========================
   NAVIGASI HALAMAN
========================= */

function showPage(pageName) {

    pages.forEach(
        function(page) {

            page.classList.remove(
                "active"
            );

        }
    );


    const selectedPage =
        document.getElementById(
            "page-" + pageName
        );


    if (selectedPage) {

        selectedPage.classList.add(
            "active"
        );

    }


    navLinks.forEach(
        function(link) {

            link.classList.remove(
                "active"
            );


            if (
                link.dataset.page ===
                pageName
            ) {

                link.classList.add(
                    "active"
                );

            }

        }
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================
   EVENT NAVIGASI
========================= */

pageButtons.forEach(
    function(button) {

        button.addEventListener(
            "click",
            function() {

                const pageName =
                    button.dataset.page;

                showPage(pageName);

            }
        );

    }
);


/* =========================
   TAMPILKAN PRODUK
========================= */

function displayProducts() {

    if (!productGrid) {
        return;
    }


    productGrid.innerHTML = "";


    products.forEach(
        function(product) {

            const card =
                document.createElement(
                    "article"
                );


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
                        ${formatRupiah(
                            product.price
                        )}
                    </p>

                </div>

            `;


            productGrid.appendChild(
                card
            );

        }
    );

}


/* =========================
   ISI PRODUK REKOMENDASI
========================= */

function loadRecommendationProducts() {

    if (
        !recommendationProduct
    ) {

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


            recommendationProduct.appendChild(
                option
            );

        }
    );

}


/* =========================
   DETAIL PRODUK
========================= */

function showProductDetail(product) {

    modalProductIcon.textContent =
        product.icon;


    modalProductCategory.textContent =
        product.category;


    modalProductName.textContent =
        product.name;


    modalProductPrice.textContent =
        formatRupiah(
            product.price
        );


    modalProductDescription.textContent =
        product.description;


    productModal.classList.add(
        "active"
    );

}


/* =========================
   TUTUP MODAL
========================= */

function closeProductModal() {

    productModal.classList.remove(
        "active"
    );

}


/* =========================
   KLIK PRODUK
========================= */

if (productGrid) {

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


            const product =
                products.find(
                    function(item) {

                        return (
                            item.id ===
                            productId
                        );

                    }
                );


            if (product) {

                showProductDetail(
                    product
                );

            }

        }
    );

}


/* =========================
   MODAL CLOSE
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
   DARI DETAIL KE REKOMENDASI
========================= */

if (modalPromoButton) {

    modalPromoButton.addEventListener(
        "click",
        function() {

            showPage(
                "rekomendasi"
            );


            if (
                recommendationProduct
            ) {

                const productId =
                    modalProductName.dataset
                        ? null
                        : null;

                const selected =
                    products.find(
                        function(product) {

                            return (
                                product.name ===
                                modalProductName.textContent
                            );

                        }
                    );


                if (selected) {

                    recommendationProduct.value =
                        selected.id;

                }

            }


            closeProductModal();

        }
    );

}


/* =========================
   GENERATE REKOMENDASI
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


    const product =
        products.find(
            function(item) {

                return (
                    item.id ===
                    productId
                );

            }
        );


    if (!product) {
        return;
    }


    let idea = "";


    if (
        style === "Informatif"
    ) {

        idea =
            `Buat konten informatif tentang ${product.name} dengan menjelaskan keunggulan, manfaat, dan karakteristik produk.`;

    }

    else if (
        style === "Promosi"
    ) {

        idea =
            `Buat konten promosi ${product.name} dengan menonjolkan keunggulan produk dan alasan menarik untuk membelinya.`;

    }

    else if (
        style === "Storytelling"
    ) {

        idea =
            `Ceritakan kisah di balik ${product.name}, mulai dari proses pembuatan hingga menjadi produk yang siap digunakan atau dikonsumsi.`;

    }

    else {

        idea =
            `Buat konten santai tentang ${product.name} menggunakan bahasa ringan dan mudah dipahami oleh audiens.`;

    }


    const caption =

        `Kenalan dengan ${product.name}! ✨\n\n` +

        `${product.description}\n\n` +

        `Konten ini ditujukan untuk ${target} ` +

        `dan dapat dipublikasikan melalui ${platform}.\n\n` +

        `Yuk dukung produk UMKM lokal!`;


    const hashtag =

        `#UMKM ` +
        `#ProdukLokal ` +
        `#UMKMIndonesia ` +
        `#DigitalMarketing ` +
        `#${platform.replace(
            /\s/g,
            ""
        )}`;


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
   SALIN REKOMENDASI
========================= */

if (copyRecommendation) {

    copyRecommendation.addEventListener(
        "click",
        function() {

            const content =

                `${resultIdea.textContent}

${resultCaption.textContent}

${resultHashtag.textContent}`;


            navigator.clipboard
                .writeText(content)
                .then(
                    function() {

                        alert(
                            "Konten berhasil disalin."
                        );

                    }
                )
                .catch(
                    function() {

                        alert(
                            "Konten tidak dapat disalin otomatis."
                        );

                    }
                );

        }
    );

}


/* =========================
   INITIALIZE
========================= */

displayProducts();

loadRecommendationProducts();

showPage("beranda");
