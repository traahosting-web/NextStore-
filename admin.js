import { 
    auth, 
    db, 
    onAuthStateChanged, 
    getDoc, 
    doc,
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc
} from './firebase.js';

const loadingOverlay = document.getElementById('loading-overlay');
const showLoading = () => { if(loadingOverlay) loadingOverlay.style.display = 'flex'; };
const hideLoading = () => { if(loadingOverlay) loadingOverlay.style.display = 'none'; };

// ==========================================
// 1. RBAC & AUTH CHECK
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            alert('Akses Ditolak! Anda bukan admin.');
            window.location.href = 'index.html';
        } else {
            hideLoading();
            initAdmin();
        }
    } catch (err) {
        alert('Gagal memverifikasi akses admin.');
        window.location.href = 'index.html';
    }
});

document.getElementById('btn-back-home').addEventListener('click', () => {
    window.location.href = 'index.html';
});


// ==========================================
// 2. ADMIN PANEL LOGIC & TABS
// ==========================================
function initAdmin() {
    
    // Tab Switching
    const navItems = document.querySelectorAll('.admin-nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.getAttribute('data-tab');
            tabContents.forEach(tc => tc.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });

    // Cloudinary Upload Helper
    async function uploadToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'traaweb'); 
        
        try {
            const res = await fetch('https://api.cloudinary.com/v1_1/dadqv0uny/image/upload', { 
                method: 'POST', 
                body: formData 
            });
            const data = await res.json();
            return data.secure_url;
        } catch (err) {
            console.error('Error uploading image', err);
            throw err;
        }
    }

    // --- USERS MANAGEMENT ---
    onSnapshot(collection(db, 'users'), (snapshot) => {
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const u = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size:0.75rem">${u.uid}</td>
                <td>${u.email}</td>
                <td>
                    <select onchange="window.changeRole('${docSnap.id}', this.value)">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    window.changeRole = async (uid, newRole) => {
        showLoading();
        try {
            await updateDoc(doc(db, 'users', uid), { role: newRole });
        } catch(e) {
            alert('Gagal merubah role');
        }
        hideLoading();
    };

    window.deleteDocument = async (collectionName, id) => {
        if(confirm('Hapus data ini?')) {
            showLoading();
            await deleteDoc(doc(db, collectionName, id));
            hideLoading();
        }
    }

    // --- PRODUCTS MANAGEMENT ---
    const btnAddPrice = document.getElementById('btn-add-price');
    const priceContainer = document.getElementById('price-list-container');
    
    btnAddPrice.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `
            <input type="text" class="form-control price-label" placeholder="Label" required>
            <input type="text" class="form-control price-val" placeholder="Harga" required>
            <button type="button" class="btn-danger" onclick="this.parentElement.remove()">X</button>
        `;
        priceContainer.appendChild(row);
    });

    document.getElementById('form-product').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const name = document.getElementById('prod-name').value;
            const desc = document.getElementById('prod-desc').value;
            
            let imageUrl = '';
            const fileInput = document.getElementById('prod-image');
            if (fileInput.files.length > 0) {
                imageUrl = await uploadToCloudinary(fileInput.files[0]);
            }

            const priceLabels = document.querySelectorAll('.price-label');
            const priceVals = document.querySelectorAll('.price-val');
            let prices = [];
            for(let i=0; i < priceLabels.length; i++) {
                prices.push({ label: priceLabels[i].value, price: priceVals[i].value });
            }

            const waText = encodeURIComponent(`Halo, saya ingin order ${name}`);
            const whatsappLink = `https://wa.me/6283190718255?text=${waText}`;

            await addDoc(collection(db, 'products'), {
                name, description: desc, imageUrl, prices, whatsappLink,
                createdAt: new Date(), updatedAt: new Date()
            });

            e.target.reset();
            alert('Produk berhasil ditambahkan!');
        } catch(err) {
            alert('Gagal: ' + err.message);
        }
        hideLoading();
    });

    onSnapshot(collection(db, 'products'), (snapshot) => {
        const tbody = document.getElementById('products-table-body');
        const select = document.getElementById('testi-product');
        tbody.innerHTML = '';
        select.innerHTML = '<option value="">-- Pilih Produk --</option>';

        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            
            // Populating Table
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.imageUrl ? `<img src="${p.imageUrl}">` : '-'}</td>
                <td>${p.name}</td>
                <td><button class="btn-danger" onclick="window.deleteDocument('products', '${docSnap.id}')">Hapus</button></td>
            `;
            tbody.appendChild(tr);

            // Populating Select for Testi
            const opt = document.createElement('option');
            opt.value = docSnap.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
    });


    // --- MODS MANAGEMENT ---
    document.getElementById('form-mod').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();

        try {
            const name = document.getElementById('mod-name').value;
            const link = document.getElementById('mod-link').value;
            const version = document.getElementById('mod-version').value;
            const isActive = document.getElementById('mod-active').checked;
            
            const fileInput = document.getElementById('mod-image');
            let imageUrl = '';
            if (fileInput.files.length > 0) {
                imageUrl = await uploadToCloudinary(fileInput.files[0]);
            }

            const catCheckboxes = document.querySelectorAll('.mod-cat:checked');
            let category = Array.from(catCheckboxes).map(cb => cb.value);

            await addDoc(collection(db, 'mods'), {
                name, downloadLink: link, version, category, isActive, imageUrl,
                createdAt: new Date(), updatedAt: new Date()
            });

            e.target.reset();
            alert('Mod berhasil ditambahkan!');
        } catch(err) {
            alert('Gagal: ' + err.message);
        }
        hideLoading();
    });

    window.toggleModStatus = async (id, currentStatus) => {
        showLoading();
        await updateDoc(doc(db, 'mods', id), { isActive: !currentStatus });
        hideLoading();
    }

    onSnapshot(collection(db, 'mods'), (snapshot) => {
        const tbody = document.getElementById('mods-table-body');
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.imageUrl ? `<img src="${m.imageUrl}">` : '-'}</td>
                <td>${m.name}</td>
                <td>${m.isActive ? '<span style="color:var(--success)">Aktif</span>' : '<span style="color:#ef4444">Nonaktif</span>'}</td>
                <td>
                    <button class="btn-success" onclick="window.toggleModStatus('${docSnap.id}', ${m.isActive})">Toggle</button>
                    <button class="btn-danger" onclick="window.deleteDocument('mods', '${docSnap.id}')">Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });


    // --- TESTIMONIALS MANAGEMENT ---
    document.getElementById('form-testi').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        try {
            const name = document.getElementById('testi-name').value;
            const productId = document.getElementById('testi-product').value;
            const rating = parseInt(document.getElementById('testi-rating').value);
            const comment = document.getElementById('testi-comment').value;

            await addDoc(collection(db, 'testimonials'), {
                name, productId, rating, comment, createdAt: new Date()
            });

            e.target.reset();
            alert('Testimoni berhasil ditambahkan!');
        } catch(err) {
            alert('Gagal: ' + err.message);
        }
        hideLoading();
    });

    onSnapshot(collection(db, 'testimonials'), (snapshot) => {
        const tbody = document.getElementById('testi-table-body');
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.name}</td>
                <td>${t.rating}/5</td>
                <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.comment}</td>
                <td><button class="btn-danger" onclick="window.deleteDocument('testimonials', '${docSnap.id}')">Hapus</button></td>
            `;
            tbody.appendChild(tr);
        });
    });
}
