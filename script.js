import { 
    auth, 
    db,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    googleProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail, 
    fetchSignInMethodsForEmail,
    sendEmailVerification,
    doc,
    setDoc,
    getDoc,
    collection,
    onSnapshot,
    updateDoc
} from './firebase.js';

// ========== AUTHENTICATION & RBAC LOGIC ==========
const path = window.location.pathname;
const loadingOverlay = document.getElementById('loading-overlay');

const showLoading = () => { if (loadingOverlay) loadingOverlay.style.display = 'flex'; };
const hideLoading = () => { if (loadingOverlay) loadingOverlay.style.display = 'none'; };
const handleError = (error) => { hideLoading(); alert("Error: " + error.message); };

// Auth State Observer with CRITICAL RBAC check & null email fix
onAuthStateChanged(auth, async (user) => {
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    
    if (user) {
        if (isAuthPage) window.location.href = 'index.html';
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.innerText = user.displayName || user.email?.split('@')[0] || "User";

        // Menyesuaikan Foto Profil dan Email
        const userAvatar = document.getElementById('user-avatar');
        const userEmail = document.getElementById('user-email');
        
        // Ensure safeEmail is NEVER null. Priority: Auth email -> Provider email -> Generated placeholder
        const safeEmail = user.email || (user.providerData && user.providerData.length > 0 && user.providerData[0].email) || `user-${user.uid.substring(0, 8)}@nexturastore.com`;

        if (userAvatar) {
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
            } else {
                const nameInitial = encodeURIComponent(user.displayName || safeEmail.split('@')[0]);
                userAvatar.src = `https://ui-avatars.com/api/?name=${nameInitial}&background=3b82f6&color=fff`;
            }
        }
        
        if (userEmail) {
            userEmail.innerText = safeEmail;
        }

        // RBAC & Critical Firestore Update: Check or Create User Document safely
        const userRef = doc(db, 'users', user.uid);
        try {
            const docSnap = await getDoc(userRef);
            if (!docSnap.exists()) {
                // Auto create document for new user with secure non-null email
                await setDoc(userRef, {
                    uid: user.uid,
                    email: safeEmail,
                    role: 'user', // Default role
                    createdAt: new Date()
                });
            } else {
                const userData = docSnap.data();
                const btnAdmin = document.getElementById('btn-admin');
                
                // Fix: if old user was stored with null email, update it
                if (!userData.email || userData.email === null) {
                    await updateDoc(userRef, { email: safeEmail });
                }

                // Tampilkan menu Admin Panel jika role == admin
                if (userData.role === 'admin' && btnAdmin) {
                    btnAdmin.style.display = 'flex';
                }
            }
        } catch (err) {
            console.error("Error fetching/creating user role: ", err);
            // Permissions might reject read if rules are extremely tight, but normally self-read is allowed.
        }
        
    } else {
        if (!isAuthPage) window.location.href = 'login.html';
    }
    if (!isAuthPage || !user) hideLoading(); 
});


// Login Page Logic
if (path.includes('login.html')) {
    // --- Lupa Password / Reset Password Logic ---
    const btnForgot = document.getElementById('btn-forgot');
    const btnBackLogin = document.getElementById('btn-back-login');
    const loginForm = document.getElementById('login-form');
    const resetForm = document.getElementById('reset-form');
    const resetError = document.getElementById('reset-error');
    const authTitle = document.getElementById('auth-title');
    const authError = document.getElementById('auth-error'); 

    if (btnForgot && btnBackLogin && loginForm && resetForm) {
        btnForgot.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            resetForm.style.display = 'block';
            
            if (authTitle) authTitle.innerText = 'Reset Password';
            if (authError) authError.style.display = 'none';
        });

        btnBackLogin.addEventListener('click', () => {
            resetForm.style.display = 'none';
            loginForm.style.display = 'block';
            
            if (authTitle) authTitle.innerText = 'Login';
            if (resetError) resetError.style.display = 'none';
        });
    }

    const resetEmailInput = document.getElementById('reset-email');
    if (resetEmailInput) {
        resetEmailInput.addEventListener('input', () => {
            if (resetError) resetError.style.display = 'none';
        });
    }

    // FIXED: RESET PASSWORD SYSTEM
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoading();
            
            if (resetError) resetError.style.display = 'none';

            const resetEmail = document.getElementById('reset-email').value;
            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;

            try {
                // Set tombol ke state loading
                submitBtn.disabled = true;
                submitBtn.innerText = 'Mengirim Link Reset...';

                // Eksekusi langsung sendPasswordResetEmail
                await sendPasswordResetEmail(auth, resetEmail);

                // Success Handling
                hideLoading();
                if (resetError) {
                    resetError.style.display = 'block';
                    resetError.style.color = '#10b981';
                    resetError.style.borderColor = '#10b981';
                    resetError.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    resetError.innerText = "Link reset password berhasil dikirim. Silakan cek inbox atau folder spam email Anda.";
                }

                // Kosongkan form setelah sukses terkirim
                document.getElementById('reset-email').value = '';

            } catch (error) {
                // Error Handling
                hideLoading();
                if (resetError) {
                    resetError.style.display = 'block';
                    resetError.style.color = '#ef4444';
                    resetError.style.borderColor = '#ef4444';
                    resetError.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    
                    // Terjemahan Error Code Spesifik Firebase ke bahasa Indonesia
                    if (error.code === 'auth/user-not-found') {
                        resetError.innerText = "Email tidak ditemukan atau belum terdaftar.";
                    } else if (error.code === 'auth/invalid-email') {
                        resetError.innerText = "Format email tidak valid.";
                    } else if (error.code === 'auth/too-many-requests') {
                        resetError.innerText = "Terlalu banyak percobaan. Silakan coba lagi nanti.";
                    } else if (error.code === 'auth/network-request-failed') {
                        resetError.innerText = "Gangguan jaringan. Periksa koneksi internet Anda.";
                    } else {
                        resetError.innerText = "Terjadi kesalahan: " + error.message;
                    }
                }
            } finally {
                // Kembalikan state tombol ke bentuk awal
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    }

    const errorEl = document.getElementById('auth-error');

    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    if (emailInput) emailInput.addEventListener('input', () => { if (errorEl) errorEl.style.display = 'none'; });
    if (passInput) passInput.addEventListener('input', () => { if (errorEl) errorEl.style.display = 'none'; });

    const loginFormEl = document.getElementById('login-form');
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading();
            if (errorEl) errorEl.style.display = 'none';

            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;

            signInWithEmailAndPassword(auth, email, pass)
                .catch((error) => {
                    hideLoading();
                    if (errorEl) {
                        errorEl.style.display = 'block';
                        
                        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                            errorEl.innerText = 'Email atau password yang Anda masukkan salah.';
                        } else {
                            errorEl.innerText = 'Terjadi kesalahan: ' + error.message;
                        }
                    }
                });
        });
    }

    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            showLoading();
            if (errorEl) errorEl.style.display = 'none';
            
            signInWithPopup(auth, googleProvider).catch((error) => {
                hideLoading();
                if (errorEl) {
                    errorEl.style.display = 'block';
                    errorEl.innerText = 'Error: ' + error.message;
                }
            });
        });
    }
}

// Register Page Logic
if (path.includes('register.html')) {
    const errorEl = document.getElementById('auth-error');

    const regEmail = document.getElementById('reg-email');
    const regPass = document.getElementById('reg-password');

    if (regEmail) regEmail.addEventListener('input', () => { if (errorEl) errorEl.style.display = 'none'; });
    if (regPass) regPass.addEventListener('input', () => { if (errorEl) errorEl.style.display = 'none'; });

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading();
            if (errorEl) errorEl.style.display = 'none';

            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;

            createUserWithEmailAndPassword(auth, email, pass)
                .then((userCredential) => {
                    sendEmailVerification(userCredential.user)
                        .then(() => {
                            hideLoading();
                            alert("Link verifikasi telah dikirim ke email Anda! Silakan cek kotak masuk atau folder spam sebelum login.");
                            signOut(auth);
                            window.location.href = 'login.html';
                        })
                        .catch((error) => {
                            hideLoading();
                            if (errorEl) {
                                errorEl.style.display = 'block';
                                errorEl.innerText = 'Gagal mengirim email verifikasi: ' + error.message;
                            }
                        });
                })
                .catch((error) => {
                    hideLoading();
                    if (errorEl) {
                        errorEl.style.display = 'block';
                        
                        if (error.code === 'auth/email-already-in-use') {
                            errorEl.innerText = 'Email ini sudah digunakan. Silakan gunakan email lain atau login.';
                        } else if (error.code === 'auth/weak-password') {
                            errorEl.innerText = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
                        } else {
                            errorEl.innerText = 'Terjadi kesalahan: ' + error.message;
                        }
                    }
                });
        });
    }
}


// ========== STORE UI & SPA LOGIC ==========
// Real-time Data Arrays
let products = [];
let mods = [];
let testimonials = [];

if (!path.includes('login.html') && !path.includes('register.html') && !path.includes('admin.html')) {

    const body = document.body;
    const btnTheme = document.getElementById('btn-theme');
    const btnSearch = document.getElementById('btn-search');
    const searchBar = document.getElementById('search-bar');
    const btnCloseSearch = document.getElementById('btn-close-search');

    const sunIcon = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zm5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`;
    const moonIcon = `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8C12.18 3.06 12.09 3 12 3z"/></svg>`;

    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const isDark = body.getAttribute('data-theme') === 'dark';
            body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            btnTheme.innerHTML = isDark ? sunIcon : moonIcon;
        });
    }

    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            if (searchBar) searchBar.classList.add('active');
        });
    }

    if (btnCloseSearch) {
        btnCloseSearch.addEventListener('click', () => {
            if (searchBar) searchBar.classList.remove('active');
        });
    }

    const cartSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
    const downloadSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

    // --- Render Functions from Firebase Data ---
    window.renderStore = () => {
        const storeList = document.getElementById('store-list');
        if (storeList) {
            storeList.innerHTML = products.map(p => {
                const basePrice = p.prices && p.prices.length > 0 ? p.prices[0].price : '';
                return `
                <div class="card" onclick="openDetail('${p.id}')">
                    <div class="card-img">
                        ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}">` : p.name.charAt(0)}
                    </div>
                    <div class="card-info">
                        <div class="card-title">${p.name}</div>
                        <div class="card-price">Mulai ${basePrice}</div>
                    </div>
                    <div class="icon-btn">${cartSvg}</div>
                </div>
            `}).join('');
        }
    };

    window.renderMods = () => {
        const modList = document.getElementById('mod-list');
        if (modList) {
            modList.innerHTML = mods.map(m => `
                <div class="card" onclick="${m.downloadLink && m.downloadLink !== '#' ? `window.open('${m.downloadLink}', '_blank')` : `alert('Mendownload ${m.name}...')`}">
                    <div class="card-img" style="${m.imageUrl ? 'background:none' : 'background:#ef4444'}">
                        ${m.imageUrl ? `<img src="${m.imageUrl}" alt="${m.name}">` : m.name.charAt(0)}
                    </div>
                    <div class="card-info">
                        <div class="card-title">${m.name} <span style="font-size:0.7rem; background:#3b82f6; padding:2px 6px; border-radius:4px; color:white;">v${m.version || '1.0'}</span></div>
                        <div class="card-price" style="color:var(--text-secondary)">GRATIS</div>
                    </div>
                    <div class="icon-btn">${downloadSvg}</div>
                </div>
            `).join('');
        }
    };

    window.renderTesti = () => {
        const testiList = document.getElementById('testi-list');
        if (testiList) {
            testiList.innerHTML = testimonials.map(t => {
                const p = products.find(prod => prod.id === t.productId);
                const prodName = p ? p.name : 'Produk Nextura';
                const dateObj = t.createdAt ? new Date(t.createdAt.seconds * 1000) : new Date();
                const dateStr = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});
                const ratingCount = t.rating || 5;
                const stars = `<div class="stars">` + `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`.repeat(ratingCount) + `</div>`;
                
                return `
                <div class="card testi-card">
                    <div class="testi-header">
                        <span class="testi-name">${t.name}</span>
                        <span class="testi-date">${dateStr}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-secondary)">${prodName}</div>
                    ${stars}
                    <div class="testi-comment">"${t.comment}"</div>
                </div>
            `}).join('');
        }
    };

    // Listeners Real-time Firestore safely wrapped
    try {
        onSnapshot(collection(db, 'products'), (snapshot) => {
            products = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            renderStore();
            renderTesti(); 
        }, (err) => console.error(err));

        onSnapshot(collection(db, 'mods'), (snapshot) => {
            mods = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).filter(m => m.isActive !== false);
            renderMods();
        }, (err) => console.error(err));

        onSnapshot(collection(db, 'testimonials'), (snapshot) => {
            testimonials = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            renderTesti();
        }, (err) => console.error(err));
    } catch(err) {
        console.error("Firestore Error:", err);
    }

    // --- Pencarian ---
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            const productCards = document.querySelectorAll('#store-list .card');
            productCards.forEach(card => {
                const title = card.querySelector('.card-title').textContent.toLowerCase();
                card.style.display = title.includes(query) ? '' : 'none';
            });
            
            const modCards = document.querySelectorAll('#mod-list .card');
            modCards.forEach(card => {
                const title = card.querySelector('.card-title').textContent.toLowerCase();
                card.style.display = title.includes(query) ? '' : 'none';
            });
        });
    }

    // --- Nav & Detail Logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            sections.forEach(s => s.classList.remove('active'));
            const targetEl = document.getElementById(item.dataset.target);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    window.openDetail = (id) => {
        const p = products.find(x => x.id === id);
        if (!p) return;

        sections.forEach(s => s.classList.remove('active'));
        const detailSection = document.getElementById('detail-section');
        if (detailSection) detailSection.classList.add('active');
        navItems.forEach(n => n.classList.remove('active'));

        let pricesHTML = '';
        if(p.prices && p.prices.length > 0) {
            pricesHTML = p.prices.map(pr => `
                <div class="price-item">
                    <span style="font-weight:600">${pr.label}</span>
                    <span style="color:var(--success); font-weight:700">${pr.price}</span>
                </div>
            `).join('');
        }

        const waLink = p.whatsappLink || `https://wa.me/6283190718255?text=${encodeURIComponent(`Halo, saya ingin order ${p.name}`)}`;

        const detailContent = document.getElementById('detail-content');
        if (detailContent) {
            detailContent.innerHTML = `
                <div class="detail-img-box" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; border-radius: 50%; overflow: hidden;">
                    ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%; height:100%; object-fit:cover;" alt="${p.name}">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:var(--accent-color); color:white; font-size:2rem">${p.name.charAt(0)}</div>`}
                </div>
                <h2 class="detail-title">${p.name}</h2>
                <p style="text-align:center; color:var(--text-secondary); margin-bottom: 1.5rem;">${p.description || ''}</p>
                <div class="price-list">${pricesHTML}</div>
                <a href="${waLink}" target="_blank" class="btn-primary">Order via WhatsApp</a>
            `;
        }
    };

    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            const detailSection = document.getElementById('detail-section');
            const storeSection = document.getElementById('store-section');
            if (detailSection) detailSection.classList.remove('active');
            if (storeSection) storeSection.classList.add('active');
            
            const storeNav = document.querySelector('.nav-item[data-target="store-section"]');
            if (storeNav) storeNav.classList.add('active');
        });
    }
}

// Fungsi Dropdown Profil
window.toggleDropdown = function() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

window.onclick = function(event) {
    if (!event.target.matches('#user-avatar')) {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    }
};

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        showLoading();
        signOut(auth).catch(handleError);
    });
}
