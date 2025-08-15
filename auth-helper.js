import { apiCall } from './api-helper.js';

let userSession = null;
let sessionCheckPromise = null;
let lastSessionCheck = 0;
const SESSION_CHECK_INTERVAL = 30000; // 30 detik

/**
 * Perbaikan v4.4.0: Mengisi cache sesi secara manual dari skrip login.
 * Ini mencegah race condition di mana browser melakukan redirect sebelum cookie sesi disimpan.
 * @param {object} userData - Objek data pengguna yang dikembalikan dari API login.
 */
export function setUserSession(userData) {
    userSession = userData;
    lastSessionCheck = Date.now();
    console.log('Session cache updated:', userData);
}

/**
 * Membersihkan cache sesi
 */
export function clearUserSession() {
    userSession = null;
    lastSessionCheck = 0;
    sessionCheckPromise = null;
    console.log('Session cache cleared');
}

/**
 * Memeriksa sesi pengguna saat ini. Menggunakan cache untuk mencegah panggilan API berulang.
 * @param {boolean} forceRefresh - Paksa refresh dari server
 * @returns {Promise<object|null>} Objek data pengguna jika login, atau null jika tidak.
 */
export async function checkSession(forceRefresh = false) {
    const now = Date.now();
    
    // Gunakan cache jika masih fresh dan tidak dipaksa refresh
    if (!forceRefresh && userSession && (now - lastSessionCheck) < SESSION_CHECK_INTERVAL) {
        console.log('Using cached session data');
        return userSession;
    }
    
    // Jika panggilan API sudah berjalan, tunggu hasilnya
    if (sessionCheckPromise) {
        console.log('Waiting for existing session check');
        return sessionCheckPromise;
    }

    console.log('Checking session from server...');
    sessionCheckPromise = apiCall('check_session', 'GET')
        .then(data => {
            if (data && data.user_id) {
                userSession = data;
                lastSessionCheck = now;
                console.log('Session validated:', data);
                return userSession;
            }
            console.log('No valid session found');
            clearUserSession();
            return null;
        })
        .catch(error => {
            console.error('Session check failed:', error);
            clearUserSession();
            return null;
        })
        .finally(() => {
            sessionCheckPromise = null;
        });

    return sessionCheckPromise;
}

/**
 * Melindungi halaman. Mengalihkan ke halaman login jika tidak diautentikasi atau tidak memiliki peran yang diperlukan.
 * @param {string|null} requiredRole - Peran yang diperlukan untuk mengakses halaman (cth: 'admin'). Jika null, hanya memeriksa login.
 * @returns {Promise<object|null>} Objek data pengguna jika otorisasi berhasil, atau null jika gagal.
 */
export async function protectPage(requiredRole = null) {
    const user = await checkSession();

    if (!user || !user.user_id) {
        window.location.href = 'login.html';
        return null;
    }

    if (requiredRole && user.role !== requiredRole) {
        // Jika peran tidak cocok, bisa arahkan ke halaman 'unauthorized' atau kembali ke dasbor
        alert('Anda tidak memiliki izin untuk mengakses halaman ini.');
        window.location.href = 'index.html';
        return null;
    }
    
    return user;
}

/**
 * Melakukan logout pengguna dan mengalihkan ke halaman login.
 */
export async function logout() {
    console.log('Logging out user...');
    
    try {
        // Panggil API logout untuk membersihkan session di server
        await apiCall('logout', 'POST');
        console.log('Server logout successful');
    } catch (error) {
        console.error('Server logout failed:', error);
        // Tetap lanjutkan logout di client meskipun server gagal
    }
    
    // Bersihkan cache session di client
    clearUserSession();
    
    // Redirect ke halaman login
    console.log('Redirecting to login page...');
    window.location.href = 'login.html';
}
