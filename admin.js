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
// DATA DICTIONARIES (Untuk Auto-fill Dropdown)
// ==========================================
let productsData = {};
let modsData = {};
let testiData = {};

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

    const handleFirestoreError = (err) => {
        if(err.code === 'permission-denied') {
            showToast('Akses ditolak: Anda tidak memiliki izin operasi (Permission Denied).', 'error');
        } else {
            showToast('Error: ' + err.message, 'error');
        }
    };

    // ==========================================
    // --- USERS MANAGEMENT ---
    // ==========================================
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
            } catch(err) { handleFirestoreError(err); }
            hideLoading();
        }
    }

    // ==========================================
    // --- PRODUCTS MANAGEMENT ---
    // ==========================================
    const prodSelector = document.getElementById('product-selector');
    const priceContainer = document.getElementById('price-list-container');
    const btnAddPrice = document.getElementById('btn-add-price');

    btnAddPrice.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `
            <input type="text" class="form-control price-label" placeholder="Label (Contoh: 1 Bulan)" required>
            <input type="text" class="form-control price-val" placeholder="Harga (Contoh: Rp10.000)" required>
            <button type="button" class="btn-danger" style="padding: 10px 14px;" onclick="this.parentElement.remove()">X</button>
        `;
        priceContainer.appendChild(row);
    });

    prodSelector.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id === 'new') {
            document.getElementById('prod-id').value = '';
            document.getElementById('form-product').reset();
            document.getElementById('prod-image-preview').style.display = 'none';
            priceContainer.innerHTML = `
                <div class="dynamic-row">
                    <input type="text" class="form-control price-label" placeholder="Label (Contoh: 1 Bulan Privat)" required>
                    <input type="text" class="form-control price-val" placeholder="Harga (Contoh: Rp10.000)" required>
                </div>
            `;
            document.getElementById('btn-delete-product').style.display = 'none';
            document.getElementById('btn-submit-product').innerText = 'Simpan Produk Baru';
        } else {
            const p = productsData[id];
            if(!p) return;
            document.getElementById('prod-id').value = id;
            document.getElementById('prod-name').value = p.name;
            document.getElementById('prod-desc').value = p.description;
            
            if(p.imageUrl) {
                document.getElementById('prod-image-preview').src = p.imageUrl;
                document.getElementById('prod-image-preview').style.display = 'block';
            } else {
                document.getElementById('prod-image-preview').style.display = 'none';
            }
            
            priceContainer.innerHTML = '';
            p.prices.forEach(price => {
                const row = document.createElement('div');
                row.className = 'dynamic-row';
                row.innerHTML = `
                    <input type="text" class="form-control price-label" value="${price.label}" required>
                    <input type="text" class="form-control price-val" value="${price.price}" required>
                    <button type="button" class="btn-danger" style="padding: 10px 14px;" onclick="this.parentElement.remove()">X</button>
                `;
                priceContainer.appendChild(row);
            });

            document.getElementById('btn-delete-product').style.display = 'block';
            document.getElementById('btn-submit-product').innerText = 'Update Produk';
        }
    });

    document.getElementById('btn-delete-product').addEventListener('click', async () => {
        const id = document.getElementById('prod-id').value;
        if(!id) return;
        if(confirm('Yakin ingin menghapus Produk ini beserta data visualnya?')) {
            showLoading();
            try {
                await deleteDoc(doc(db, 'products', id));
                showToast('Produk berhasil dihapus.', 'success');
                prodSelector.value = 'new';
                prodSelector.dispatchEvent(new Event('change'));
            } catch(err) { handleFirestoreError(err); }
            hideLoading();
        }
    });

    document.getElementById('form-product').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const desc = document.getElementById('prod-desc').value;
        
        if(!name.trim() || !desc.trim()) {
            showToast('Pastikan Nama dan Deskripsi Produk terisi.', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-product');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Menyimpan...';
        submitBtn.disabled = true;
        
        try {
            let imageUrl = (id && productsData[id]) ? productsData[id].imageUrl : '';
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
            const payload = {
                name, description: desc, imageUrl, prices, whatsappLink, updatedAt: new Date()
            };

            if(id) {
                await updateDoc(doc(db, 'products', id), payload);
                showToast('Produk berhasil diupdate!', 'success');
            } else {
                payload.createdAt = new Date();
                await addDoc(collection(db, 'products'), payload);
                showToast('Produk berhasil ditambahkan!', 'success');
                
                // Reset as new
                prodSelector.value = 'new';
                prodSelector.dispatchEvent(new Event('change'));
            }
        } catch(err) {
            handleFirestoreError(err);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    try {
        onSnapshot(collection(db, 'products'), (snapshot) => {
            const currentSelected = prodSelector.value;
            const selectTesti = document.getElementById('testi-product');
            
            let optionsHTML = '<option value="new">+ Create New Data...</option>';
            let testiOptionsHTML = '<option value="">-- Pilih Produk --</option>';
            productsData = {};

            snapshot.forEach(docSnap => {
                const p = docSnap.data();
                productsData[docSnap.id] = p;
                optionsHTML += `<option value="${docSnap.id}">Edit: ${p.name}</option>`;
                testiOptionsHTML += `<option value="${docSnap.id}">${p.name}</option>`;
            });

            prodSelector.innerHTML = optionsHTML;
            selectTesti.innerHTML = testiOptionsHTML;

            // Retain selection if exists
            if(productsData[currentSelected]) {
                prodSelector.value = currentSelected;
            } else {
                prodSelector.value = 'new';
                if(currentSelected !== 'new' && currentSelected !== '') {
                    prodSelector.dispatchEvent(new Event('change'));
                }
            }
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Products Snapshot Error", err);
    }


    // ==========================================
    // --- MODS MANAGEMENT ---
    // ==========================================
    const modSelector = document.getElementById('mod-selector');

    modSelector.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id === 'new') {
            document.getElementById('mod-id').value = '';
            document.getElementById('form-mod').reset();
            document.getElementById('mod-image-preview').style.display = 'none';
            document.getElementById('mod-active').checked = true;
            document.getElementById('btn-delete-mod').style.display = 'none';
            document.getElementById('btn-submit-mod').innerText = 'Simpan Mod Baru';
        } else {
            const m = modsData[id];
            if(!m) return;
            document.getElementById('mod-id').value = id;
            document.getElementById('mod-name').value = m.name;
            document.getElementById('mod-link').value = m.downloadLink;
            document.getElementById('mod-version').value = m.version;
            document.getElementById('mod-active').checked = m.isActive;
            
            if(m.imageUrl) {
                document.getElementById('mod-image-preview').src = m.imageUrl;
                document.getElementById('mod-image-preview').style.display = 'block';
            } else {
                document.getElementById('mod-image-preview').style.display = 'none';
            }

            document.querySelectorAll('.mod-cat').forEach(cb => {
                cb.checked = m.category && m.category.includes(cb.value);
            });

            document.getElementById('btn-delete-mod').style.display = 'block';
            document.getElementById('btn-submit-mod').innerText = 'Update Mod';
        }
    });

    document.getElementById('btn-delete-mod').addEventListener('click', async () => {
        const id = document.getElementById('mod-id').value;
        if(!id) return;
        if(confirm('Yakin ingin menghapus Aplikasi Mod ini?')) {
            showLoading();
            try {
                await deleteDoc(doc(db, 'mods', id));
                showToast('Aplikasi Mod berhasil dihapus.', 'success');
                modSelector.value = 'new';
                modSelector.dispatchEvent(new Event('change'));
            } catch(err) { handleFirestoreError(err); }
            hideLoading();
        }
    });

    document.getElementById('form-mod').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('mod-id').value;
        const name = document.getElementById('mod-name').value;
        const link = document.getElementById('mod-link').value;
        const version = document.getElementById('mod-version').value;
        const isActive = document.getElementById('mod-active').checked;
        const fileInput = document.getElementById('mod-image');

        if(!name.trim() || !link.trim() || (!id && fileInput.files.length === 0)) {
            showToast('Pastikan Nama, Link, dan Gambar (untuk baru) terisi dengan benar.', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-mod');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Mengunggah Gambar...';
        submitBtn.disabled = true;

        try {
            let imageUrl = (id && modsData[id]) ? modsData[id].imageUrl : '';
            if (fileInput.files.length > 0) {
                imageUrl = await uploadToCloudinary(fileInput.files[0]);
            }

            const catCheckboxes = document.querySelectorAll('.mod-cat:checked');
            let category = Array.from(catCheckboxes).map(cb => cb.value);

            submitBtn.innerText = 'Menyimpan ke Database...';
            const payload = {
                name, downloadLink: link, version, category, isActive, imageUrl, updatedAt: new Date()
            };

            if(id) {
                await updateDoc(doc(db, 'mods', id), payload);
                showToast('Aplikasi Mod berhasil diupdate!', 'success');
            } else {
                payload.createdAt = new Date();
                await addDoc(collection(db, 'mods'), payload);
                showToast('Aplikasi Mod berhasil ditambahkan!', 'success');
                modSelector.value = 'new';
                modSelector.dispatchEvent(new Event('change'));
            }
        } catch(err) {
            handleFirestoreError(err);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    try {
        onSnapshot(collection(db, 'mods'), (snapshot) => {
            const currentSelected = modSelector.value;
            let optionsHTML = '<option value="new">+ Create New Data...</option>';
            modsData = {};

            snapshot.forEach(docSnap => {
                const m = docSnap.data();
                modsData[docSnap.id] = m;
                optionsHTML += `<option value="${docSnap.id}">Edit: ${m.name}</option>`;
            });

            modSelector.innerHTML = optionsHTML;
            if(modsData[currentSelected]) {
                modSelector.value = currentSelected;
            } else {
                modSelector.value = 'new';
                if(currentSelected !== 'new' && currentSelected !== '') {
                    modSelector.dispatchEvent(new Event('change'));
                }
            }
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Mods Snapshot Error", err);
    }


    // ==========================================
    // --- TESTIMONIALS MANAGEMENT & STAR RATING
    // ==========================================
    const testiSelector = document.getElementById('testi-selector');
    const stars = document.querySelectorAll('#star-rating-container svg');
    const ratingInput = document.getElementById('testi-rating');

    // Star Rating Logic
    function updateStarsVisual(val) {
        stars.forEach(star => {
            if (parseInt(star.dataset.val) <= val) {
                star.classList.add('selected');
            } else {
                star.classList.remove('selected');
            }
        });
    }

    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.dataset.val);
            stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.val) <= val));
        });
        star.addEventListener('mouseout', () => {
            stars.forEach(s => s.classList.remove('hovered'));
        });
        star.addEventListener('click', () => {
            const val = parseInt(star.dataset.val);
            ratingInput.value = val;
            updateStarsVisual(val);
        });
    });

    testiSelector.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id === 'new') {
            document.getElementById('testi-id').value = '';
            document.getElementById('form-testi').reset();
            updateStarsVisual(5);
            ratingInput.value = '5';
            document.getElementById('btn-delete-testi').style.display = 'none';
            document.getElementById('btn-submit-testi').innerText = 'Simpan Testi Baru';
        } else {
            const t = testiData[id];
            if(!t) return;
            document.getElementById('testi-id').value = id;
            document.getElementById('testi-name').value = t.name;
            document.getElementById('testi-product').value = t.productId;
            document.getElementById('testi-comment').value = t.comment;
            
            updateStarsVisual(t.rating);
            ratingInput.value = t.rating;
            
            document.getElementById('btn-delete-testi').style.display = 'block';
            document.getElementById('btn-submit-testi').innerText = 'Update Testi';
        }
    });

    document.getElementById('btn-delete-testi').addEventListener('click', async () => {
        const id = document.getElementById('testi-id').value;
        if(!id) return;
        if(confirm('Yakin ingin menghapus Testimoni ini?')) {
            showLoading();
            try {
                await deleteDoc(doc(db, 'testimonials', id));
                showToast('Testimoni berhasil dihapus.', 'success');
                testiSelector.value = 'new';
                testiSelector.dispatchEvent(new Event('change'));
            } catch(err) { handleFirestoreError(err); }
            hideLoading();
        }
    });

    document.getElementById('form-testi').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('testi-id').value;
        const name = document.getElementById('testi-name').value;
        const productId = document.getElementById('testi-product').value;
        const rating = parseInt(ratingInput.value);
        const comment = document.getElementById('testi-comment').value;

        if(!name.trim() || !productId || !comment.trim() || !rating) {
            showToast('Mohon lengkapi seluruh field testimoni.', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-testi');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Menyimpan...';

        try {
            const payload = { name, productId, rating, comment };
            
            if(id) {
                await updateDoc(doc(db, 'testimonials', id), payload);
                showToast('Testimoni berhasil diupdate!', 'success');
            } else {
                payload.createdAt = new Date();
                await addDoc(collection(db, 'testimonials'), payload);
                showToast('Testimoni berhasil ditambahkan!', 'success');
                
                testiSelector.value = 'new';
                testiSelector.dispatchEvent(new Event('change'));
            }
        } catch(err) {
            handleFirestoreError(err);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    try {
        onSnapshot(collection(db, 'testimonials'), (snapshot) => {
            const currentSelected = testiSelector.value;
            let optionsHTML = '<option value="new">+ Create New Data...</option>';
            testiData = {};

            snapshot.forEach(docSnap => {
                const t = docSnap.data();
                testiData[docSnap.id] = t;
                optionsHTML += `<option value="${docSnap.id}">Edit: ${t.name}</option>`;
            });

            testiSelector.innerHTML = optionsHTML;
            if(testiData[currentSelected]) {
                testiSelector.value = currentSelected;
            } else {
                testiSelector.value = 'new';
                if(currentSelected !== 'new' && currentSelected !== '') {
                    testiSelector.dispatchEvent(new Event('change'));
                }
            }
        }, (err) => handleFirestoreError(err));
    } catch(err) {
        console.error("Testimonials Snapshot Error", err);
    }
}
