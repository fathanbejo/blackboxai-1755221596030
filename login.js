import { apiCall } from './api-helper.js';
import { setUserSession, checkSession } from './auth-helper.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const spinner = loginButton.querySelector('.spinner');
    const errorMessage = document.getElementById('error-message');
    const schoolLogo = document.getElementById('schoolLogo');
    const headerLine1 = document.getElementById('headerLine1');
    const headerLine3 = document.getElementById('headerLine3');
    const successModal = document.getElementById('success-modal-overlay');

    // Periksa apakah user sudah login
    checkSession().then(user => {
        if (user) {
            console.log('User already logged in, redirecting to dashboard');
            window.location.href = 'index.html';
        }
    });

    async function loadBranding() {
        try {
            const settings = await apiCall('getGlobalSettings', 'GET');
            if (settings.logo_path) {
                schoolLogo.src = settings.logo_path.startsWith('http') ? settings.logo_path : `${settings.logo_path}?t=${new Date().getTime()}`;
            }
            if (settings.dashboard_title) {
                headerLine1.textContent = settings.dashboard_title;
            }
             if (settings.dashboard_subtitle) {
                headerLine3.textContent = `Silakan masuk ke dasbor ${settings.dashboard_subtitle}`;
            }
        } catch (error) {
            console.warn('Could not load global branding settings:', error);
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.style.display = 'none';
        loginButton.disabled = true;
        spinner.style.display = 'inline-block';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // Validasi input
        if (!username || !password) {
            errorMessage.textContent = 'Username dan password harus diisi.';
            errorMessage.style.display = 'block';
            loginButton.disabled = false;
            spinner.style.display = 'none';
            return;
        }

        try {
            console.log('Attempting login for user:', username);
            const userData = await apiCall('login', 'POST', { username, password });
            console.log('Login API response:', userData);
            
            // Set session cache di client
            setUserSession(userData);
            
            // Tampilkan modal sukses
            if (successModal) {
                successModal.style.display = 'flex';
            }
            
            // PERBAIKAN v4.4.0: Verifikasi session tersimpan sebelum redirect
            console.log('Verifying session before redirect...');
            
            // Tunggu sebentar untuk memastikan session tersimpan
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verifikasi session dengan server
            const verifiedSession = await checkSession(true); // Force refresh
            
            if (verifiedSession && verifiedSession.user_id) {
                console.log('Session verified, redirecting to dashboard');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000); // Jeda tambahan untuk UX
            } else {
                throw new Error('Session tidak dapat diverifikasi. Silakan coba lagi.');
            }

        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = error.message || 'Login gagal. Periksa kembali username dan password Anda.';
            errorMessage.style.display = 'block';
            loginButton.disabled = false;
            spinner.style.display = 'none';
            
            // Sembunyikan modal jika ada error
            if (successModal) {
                successModal.style.display = 'none';
            }
        }
    });

    loadBranding();
});
