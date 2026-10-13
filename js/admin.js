import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ADMIN_EMAIL = "adipranatasetiawan9@gmail.com";
const db = getFirestore(app);

const adminNotice = document.getElementById("onlyAdminNotice");
const adminStockList = document.getElementById("adminStockList");

let stockMapAdmin = {};
let isAdmin = false;

function renderAdminStock() {
    if (!adminStockList) return;
    adminStockList.innerHTML = products.map(function (product) {
        const qty = stockMapAdmin[product.id];
        const value = qty === undefined ? 0 : qty;
        return '<div class="admin-stock-row">' +
            '<span class="admin-stock-name">' + product.name + '</span>' +
            '<input type="number" min="0" class="admin-stock-input" data-id="' + product.id + '" value="' + value + '">' +
            '<button type="button" class="button secondary admin-stock-save" data-id="' + product.id + '">Simpan</button>' +
            '</div>';
    }).join("");
}

if (adminStockList) {
    adminStockList.addEventListener("click", function (event) {
        const button = event.target.closest(".admin-stock-save");
        if (!button) return;
        const id = button.dataset.id;
        const input = adminStockList.querySelector('.admin-stock-input[data-id="' + id + '"]');
        const value = Math.max(0, parseInt(input.value, 10) || 0);
        setDoc(doc(db, "stock", id), { quantity: value }).then(function () {
            button.textContent = "Tersimpan ✓";
            setTimeout(function () { button.textContent = "Simpan"; }, 1500);
        }).catch(function (error) {
            alert("Gagal menyimpan: " + error.message);
        });
    });
}

onSnapshot(collection(db, "stock"), function (snapshot) {
    stockMapAdmin = {};
    snapshot.forEach(function (docSnap) { stockMapAdmin[docSnap.id] = docSnap.data().quantity; });
    if (isAdmin) renderAdminStock();
});

onAuthStateChanged(auth, function (user) {
    isAdmin = !!(user && user.email === ADMIN_EMAIL);
    if (adminNotice) adminNotice.style.display = isAdmin ? "none" : "block";
    if (adminStockList) adminStockList.style.display = isAdmin ? "block" : "none";
    if (isAdmin) renderAdminStock();
});
