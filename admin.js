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
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const successIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    const errorIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    
    toast.innerHTML = `${type === 'success' ? successIcon : errorIcon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => { 
        toast.style.animation = 'fadeOut 0.3s ease forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 4000);
}

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
        alert('Gagal memverifikasi akses admin. ' + err.message);
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
    
    // Hamburger Menu Mobile Logic
    const btnHamburger = document.getElementById('btn-hamburger');
    const sidebar = document.getElementById('admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if(btnHamburger) {
        btnHamburger.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });
    }
    
    if(sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

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
            
            // Auto close sidebar on mobile after clicking tab
            if(window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Setup Image Previews
    function setupImagePreview(inputId, previewId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        if(input && preview) {
            input.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    preview.src = URL.createObjectURL(this.files[0]);
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                    preview.src = '';
                }
            });
        }
    }
    setupImagePreview('prod-image', 'prod-image-preview');
    setupImagePreview('mod-image', 'mod-image-preview');

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
            if(data.error) throw new Error(data.error.message);
            return data.secure_url;
        } catch (err) {
            console.error('Error uploading image', err);
            throw new Error('Gagal mengunggah gambar ke Cloudinary.');
        }
    }

    // Handle Auth Error Permissions Safely
    const handleFirestoreError = (err) => {
        if(err.code === 'permission-denied') {
            showToast('Akses ditolak: Anda tidak memiliki izin operasi (Permission Denied).', 'error');
        } else {
            showToast('Error: ' + err.message, 'error');
        }
    };

    // --- USERS MANAGEMENT ---
    try {
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
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Users Snapshot Error", err);
    }

    window.changeRole = async (uid, newRole) => {
        showLoading();
        try {
            await updateDoc(doc(db, 'users', uid), { role: newRole });
            showToast(`Role berhasil dirubah menjadi ${newRole}`, 'success');
        } catch(err) {
            handleFirestoreError(err);
        }
        hideLoading();
    };

    window.deleteDocument = async (collectionName, id) => {
        if(confirm('Yakin ingin menghapus data ini?')) {
            showLoading();
            try {
                await deleteDoc(doc(db, collectionName, id));
                showToast('Data berhasil dihapus.', 'success');
            } catch(err) {
                handleFirestoreError(err);
            }
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
        
        const name = document.getElementById('prod-name').value;
        const desc = document.getElementById('prod-desc').value;
        if(!name.trim() || !desc.trim()) {
            showToast('Pastikan Nama dan Deskripsi Produk terisi.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Menyimpan...';
        submitBtn.disabled = true;
        
        try {
            let imageUrl = '';
            const fileInput = document.getElementById('prod-image');
            if (fileInput.files.length > 0) {
                submitBtn.innerText = 'Mengunggah Gambar...';
                imageUrl = await uploadToCloudinary(fileInput.files[0]);
            }

            const priceLabels = document.querySelectorAll('.price-label');
            const priceVals = document.querySelectorAll('.price-val');
            let prices = [];
            for(let i=0; i < priceLabels.length; i++) {
                if(priceLabels[i].value.trim() && priceVals[i].value.trim()){
                    prices.push({ label: priceLabels[i].value, price: priceVals[i].value });
                }
            }

            const waText = encodeURIComponent(`Halo, saya ingin order ${name}`);
            const whatsappLink = `https://wa.me/6283190718255?text=${waText}`;

            submitBtn.innerText = 'Menyimpan ke Database...';
            await addDoc(collection(db, 'products'), {
                name, description: desc, imageUrl, prices, whatsappLink,
                createdAt: new Date(), updatedAt: new Date()
            });

            e.target.reset();
            document.getElementById('prod-image-preview').style.display = 'none';
            showToast('Produk berhasil ditambahkan!', 'success');
        } catch(err) {
            handleFirestoreError(err);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    try {
        onSnapshot(collection(db, 'products'), (snapshot) => {
            const tbody = document.getElementById('products-table-body');
            const select = document.getElementById('testi-product');
            tbody.innerHTML = '';
            
            // Preserve the first placeholder option, remove others
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
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Products Snapshot Error", err);
    }


    // --- MODS MANAGEMENT ---
    document.getElementById('form-mod').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('mod-name').value;
        const link = document.getElementById('mod-link').value;
        const version = document.getElementById('mod-version').value;
        const isActive = document.getElementById('mod-active').checked;
        const fileInput = document.getElementById('mod-image');

        if(!name.trim() || !link.trim() || fileInput.files.length === 0) {
            showToast('Pastikan Nama, Link, dan Gambar terisi dengan benar.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Mengunggah Gambar...';
        submitBtn.disabled = true;

        try {
            let imageUrl = await uploadToCloudinary(fileInput.files[0]);

            const catCheckboxes = document.querySelectorAll('.mod-cat:checked');
            let category = Array.from(catCheckboxes).map(cb => cb.value);

            submitBtn.innerText = 'Menyimpan ke Database...';
            await addDoc(collection(db, 'mods'), {
                name, downloadLink: link, version, category, isActive, imageUrl,
                createdAt: new Date(), updatedAt: new Date()
            });

            e.target.reset();
            document.getElementById('mod-image-preview').style.display = 'none';
            showToast('Aplikasi Mod berhasil ditambahkan!', 'success');
        } catch(err) {
            handleFirestoreError(err);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    window.toggleModStatus = async (id, currentStatus) => {
        showLoading();
        try {
            await updateDoc(doc(db, 'mods', id), { isActive: !currentStatus });
            showToast('Status Mod berhasil diperbarui', 'success');
        } catch(err) {
            handleFirestoreError(err);
        }
        hideLoading();
    }

    try {
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
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Mods Snapshot Error", err);
    }


    // --- TESTIMONIALS MANAGEMENT ---
    document.getElementById('form-testi').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('testi-name').value;
        const productId = document.getElementById('testi-product').value;
        const rating = parseInt(document.getElementById('testi-rating').value);
        const comment = document.getElementById('testi-comment').value;

        if(!name.trim() || !productId || !comment.trim()) {
            showToast('Mohon lengkapi seluruh field testimoni.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Menyimpan...';

        try {
            await addDoc(collection(db, 'testimonials'), {
                name, productId, rating, comment, createdAt: new Date()
            });

            e.target.reset();
            showToast('Testimoni berhasil ditambahkan!', 'success');
        } catch(err) {
            handleFirestoreError(err);
        } finally {
            submitBtn.innerText = 'Simpan Testi';
            submitBtn.disabled = false;
        }
    });

    try {
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
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Testimonials Snapshot Error", err);
    }
}
