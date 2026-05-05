import { 
    auth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    googleProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail, 
    fetchSignInMethodsForEmail,
    sendEmailVerification // 👈 Tambahkan ini
} from './firebase.js';


// ========== AUTHENTICATION LOGIC ==========
const path = window.location.pathname;
const loadingOverlay = document.getElementById('loading-overlay');

const showLoading = () => { if (loadingOverlay) loadingOverlay.style.display = 'flex'; };
const hideLoading = () => { if (loadingOverlay) loadingOverlay.style.display = 'none'; };
const handleError = (error) => { hideLoading(); alert("Error: " + error.message); };

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    
    if (user) {
        if (isAuthPage) window.location.href = 'index.html';
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.innerText = user.displayName || user.email.split('@')[0];

        // Menyesuaikan Foto Profil dan Email
        const userAvatar = document.getElementById('user-avatar');
        const userEmail = document.getElementById('user-email');
        
        if (userAvatar) {
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
            } else {
                const nameInitial = encodeURIComponent(user.displayName || user.email.split('@')[0]);
                userAvatar.src = `https://ui-avatars.com/api/?name=${nameInitial}&background=3b82f6&color=fff`;
            }
        }
        
        if (userEmail) {
            userEmail.innerText = user.email;
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
    const authTitle = document.getElementById('auth-title'); // 👈 Kontrol Judul
    const authError = document.getElementById('auth-error'); // 👈 Elemen Error Login

    if (btnForgot && btnBackLogin && loginForm && resetForm) {
        btnForgot.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            resetForm.style.display = 'block';
            
            // Ubah judul form
            if (authTitle) authTitle.innerText = 'Reset Password';
            // Sembunyikan pesan error login
            if (authError) authError.style.display = 'none';
        });

        btnBackLogin.addEventListener('click', () => {
            resetForm.style.display = 'none';
            loginForm.style.display = 'block';
            
            // Kembalikan judul form
            if (authTitle) authTitle.innerText = 'Login';
            // Sembunyikan pesan error reset password
            if (resetError) resetError.style.display = 'none';
        });
    }

    // 📌 Sembunyikan pesan reset ketika pengguna mengetik ulang email
    const resetEmailInput = document.getElementById('reset-email');
    if (resetEmailInput) {
        resetEmailInput.addEventListener('input', () => {
            if (resetError) resetError.style.display = 'none';
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading();
            if (resetError) resetError.style.display = 'none';

            const resetEmail = document.getElementById('reset-email').value;

            // Memeriksa apakah email ada di database Firebase
            fetchSignInMethodsForEmail(auth, resetEmail)
                .then((signInMethods) => {
                    if (signInMethods.length === 0) {
                        hideLoading();
                        if (resetError) {
                            resetError.style.display = 'block';
                            resetError.style.color = '#ef4444';
                            resetError.style.borderColor = '#ef4444';
                            resetError.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            resetError.innerText = "Email tidak ditemukan atau belum terdaftar. Silakan periksa kembali email Anda.";
                        }
                    } else {
                        // Jika email terdaftar
                        sendPasswordResetEmail(auth, resetEmail)
                            .then(() => {
                                hideLoading();
                                if (resetError) {
                                    resetError.style.display = 'block';
                                    resetError.style.color = '#10b981';
                                    resetError.style.borderColor = '#10b981';
                                    resetError.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                    resetError.innerText = "Tautan untuk mereset kata sandi telah dikirim! Silakan periksa kotak masuk atau folder spam Anda.";
                                }
                            })
                            .catch((error) => {
                                hideLoading();
                                if (resetError) {
                                    resetError.style.display = 'block';
                                    resetError.style.color = '#ef4444';
                                    resetError.style.borderColor = '#ef4444';
                                    resetError.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                    resetError.innerText = "Terjadi kesalahan: " + error.message;
                                }
                            });
                    }
                })
                .catch((error) => {
                    hideLoading();
                    if (resetError) {
                        resetError.style.display = 'block';
                        resetError.style.color = '#ef4444';
                        resetError.style.borderColor = '#ef4444';
                        resetError.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        resetError.innerText = "Terjadi kesalahan: " + error.message;
                    }
                });
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
                    errorEl.innerText = '❌ ' + error.message;
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
                    // Kirim email verifikasi setelah sukses dibuat
                    sendEmailVerification(userCredential.user)
                        .then(() => {
                            hideLoading();
                            alert("Link verifikasi telah dikirim ke email Anda! Silakan cek kotak masuk atau folder spam sebelum login.");
                            
                            // Logout otomatis agar tidak langsung masuk sebelum verifikasi
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


// Logika Penyaringan Pencarian Produk & Mod
const searchInput = document.querySelector('.search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        // Filter Produk Store
        const productCards = document.querySelectorAll('#store-list .card');
        productCards.forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            if (title.includes(query)) {
                card.style.display = ''; // Tampilkan kembali
            } else {
                card.style.display = 'none'; // Sembunyikan
            }
        });
        
        // Filter Mod
        const modCards = document.querySelectorAll('#mod-list .card');
        modCards.forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            if (title.includes(query)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// Logout Logic
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        showLoading();
        signOut(auth).catch(handleError);
    });
}

// ========== STORE UI & SPA LOGIC ==========
if (!path.includes('login.html') && !path.includes('register.html')) {

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

    // --- Data Produk dengan Gambar ---
    const products = [
        { id: 1, name: "Alight Motion Premium", price: "Rp2.000 - Rp5.000", desc: "Unlock semua efek premium, tanpa watermark, export 4K.", prices: ["1 akun privat (1 Tahun) - Rp2.000", "3 Akun Privat (1 Tahun) - Rp5.000", "7 Akun Privat (1 tahun) - Rp10.000"], img: "am.jpg" },
        { id: 2, name: "Spotify Premium", price: "Rp5.000 - Rp25.000", desc: "Dengarkan musik tanpa iklan, skip lagu tak terbatas, download offline.", prices: ["1 Bulan Inv Fam - Rp5.000", "3 Bulan Private - Rp15.000", "6 Bulan Private - Rp25.000"], img: "spotify.jpg" },
        { id: 3, name: "CapCut Premium", price: "Rp3.000 - Rp12.000", desc: "Akses semua template Pro, efek transisi premium, dan cloud space.", prices: ["1 Bulan Sharing - Rp3.000", "1 Tahun Private - Rp8.000", "Lifetime Private - Rp12.000"], img: "capcut.jpg" },
        { id: 4, name: "Wink Premium", price: "Rp4.000 - Rp18.000", desc: "Enhance video jadi jernih, akses semua alat retouch VIP.", prices: ["1 Bulan Sharing - Rp4.000", "1 Tahun Private - Rp12.000", "Lifetime Private - Rp18.000"], img: "wink.jpg" }
    ];

    const mods = [
        { id: 101, name: "Alight motion mod", price: "GRATIS", desc: "Unlock All Skins, God Mode.", link: "#", img: "am.jpg" },
        { id: 101, name: "hypic mod", price: "GRATIS", desc: "Unlock All Skins, God Mode.", link: "#", img: "hypic.jpg" },
        { id: 101, name: "autorespon wa  mod", price: "GRATIS", desc: "Unlock All Skins, God Mode.", link: "https://sfl.gl/y89HAaXM", img: "forwa.jpg" },
        { id: 101, name: "animein mod", price: "GRATIS", desc: "Unlock All Skins, God Mode.", link: "https://sfl.gl/y89HAaXM", img: "animein.jpg" },
        { id: 101, name: "Wink mod", price: "GRATIS", desc: "Unlock All Skins, God Mode.", link: "https://sfl.gl/DqVLGXa6", img: "wink.jpg" },
        { id: 102, name: "PicsArt Pro MOD", price: "GRATIS", desc: "Gold Unlocked, No Ads.", link: "#", img: "picsart.jpg" }
    ];

    const testimonials = [
        { name: "Anonim123", prod: "Spotify Premium", date: "02 Mei 2026", price: "Rp5.000", comment: "Cepat dan amanah!" },
        { name: "User_Keren", prod: "CapCut Pro", date: "01 Mei 2026", price: "Rp3.000", comment: "Satset gak ribet" },
        { name: "BudiS", prod: "Alight Motion", date: "30 Apr 2026", price: "Rp10.000", comment: "Amanah trusted seller" },
        { name: "Nisa_A", prod: "Wink Premium", date: "29 Apr 2026", price: "Rp4.000", comment: "Pelayanan cepat banget" }
    ];

    const cartSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
    const downloadSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

    // --- Render Functions dengan gambar/URL ---
    const renderStore = () => {
        const storeList = document.getElementById('store-list');
        if (storeList) {
            storeList.innerHTML = products.map(p => `
                <div class="card" onclick="openDetail(${p.id})">
                    <div class="card-img">
                        ${p.img ? `<img src="${p.img}" alt="${p.name}">` : p.name.charAt(0)}
                    </div>
                    <div class="card-info">
                        <div class="card-title">${p.name}</div>
                        <div class="card-price">${p.price}</div>
                    </div>
                    <div class="icon-btn">${cartSvg}</div>
                </div>
            `).join('');
        }
    };

        const renderMods = () => {
        const modList = document.getElementById('mod-list');
        if (modList) {
            modList.innerHTML = mods.map(m => `
                <div class="card" onclick="${m.link && m.link !== '#' ? `window.open('${m.link}', '_blank')` : `alert('Mendownload ${m.name}...')`}">
                    <div class="card-img" style="${m.img ? 'background:none' : 'background:#ef4444'}">
                        ${m.img ? `<img src="${m.img}" alt="${m.name}">` : m.name.charAt(0)}
                    </div>
                    <div class="card-info">
                        <div class="card-title">${m.name}</div>
                        <div class="card-price" style="color:var(--text-secondary)">${m.price}</div>
                    </div>
                    <div class="icon-btn">${downloadSvg}</div>
                </div>
            `).join('');
        }
    };

    const renderTesti = () => {
        const testiList = document.getElementById('testi-list');
        if (testiList) {
            const stars = `<div class="stars">` + `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`.repeat(5) + `</div>`;
            testiList.innerHTML = testimonials.map(t => `
                <div class="card testi-card">
                    <div class="testi-header">
                        <span class="testi-name">${t.name}</span>
                        <span class="testi-date">${t.date}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-secondary)">${t.prod} - ${t.price}</div>
                    ${stars}
                    <div class="testi-comment">"${t.comment}"</div>
                </div>
            `).join('');
        }
    };

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

        const pricesHTML = p.prices.map(price => `
            <div class="price-item">
                <span style="font-weight:600">${price.split('-')[0]}</span>
                <span style="color:var(--success); font-weight:700">${price.split('-')[1]}</span>
            </div>
        `).join('');

        const waText = encodeURIComponent(`Halo, saya ingin order ${p.name}`);
        const waLink = `https://wa.me/6283190718255?text=${waText}`;

        const detailContent = document.getElementById('detail-content');
        if (detailContent) {
            detailContent.innerHTML = `
                <div class="detail-img-box" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; border-radius: 50%; overflow: hidden;">
                    ${p.img ? `<img src="${p.img}" style="width:100%; height:100%; object-fit:cover;" alt="${p.name}">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:var(--accent-color); color:white; font-size:2rem">${p.name.charAt(0)}</div>`}
                </div>
                <h2 class="detail-title">${p.name}</h2>
                <p style="text-align:center; color:var(--text-secondary); margin-bottom: 1.5rem;">${p.desc}</p>
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

    renderStore();
    renderMods();
    renderTesti();
}

// Fungsi Dropdown Profil
window.toggleDropdown = function() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Menutup dropdown saat mengklik di luar area foto profil
window.onclick = function(event) {
    if (!event.target.matches('#user-avatar')) {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    }
};
// ==========================================
// TAMBAHAN FITUR: MENU HAMBURGER & DOWNLOAD
// ==========================================

// 1. Memperbarui fungsi renderMods agar tombol download berfungsi sungguhan
window.renderMods = function() {
    const modList = document.getElementById('mod-list');
    if (modList) {
        modList.innerHTML = mods.map(m => `
            <div class="card" onclick="${m.link && m.link !== '#' ? `window.open('${m.link}', '_blank')` : `alert('Mendownload ${m.name}...')`}">
                <div class="card-img" style="${m.img ? 'background:none' : 'background:#ef4444'}">
                    ${m.img ? `<img src="${m.img}" alt="${m.name}">` : m.name.charAt(0)}
                </div>
                <div class="card-info">
                    <div class="card-title">${m.name}</div>
                    <div class="card-price" style="color:var(--text-secondary)">${m.price}</div>
                </div>
                <div class="icon-btn">${downloadSvg}</div>
            </div>
        `).join('');
    }
};

// Panggil ulang renderMods setelah penambahan fungsi
if (document.getElementById('mod-list')) {
    renderMods();
}

// 2. Mengaktifkan logika menu hamburger & tema warna
document.addEventListener("DOMContentLoaded", function() {
    const btnMenu = document.getElementById("btn-menu");
    const sidebar = document.getElementById("hamburger-menu");
    const btnClose = document.getElementById("btn-close-menu");
    const btnLogout = document.getElementById("btn-sidebar-logout");

    if (btnMenu) {
        btnMenu.addEventListener("click", function() {
            sidebar.classList.add("active");
        });
    }

    if (btnClose) {
        btnClose.addEventListener("click", function() {
            sidebar.classList.remove("active");
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", function() {
            if (confirm("Apakah Anda yakin ingin keluar?")) {
                localStorage.clear();
                window.location.href = "login.html"; 
            }
        });
    }

    // Terapkan tema warna utama dari halaman Setting
    const savedColor = localStorage.getItem('web_theme_color');
    if (savedColor) {
        document.documentElement.style.setProperty('--primary-color', savedColor);
    }
});
