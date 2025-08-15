/**
 * Test API Helper - menggunakan test-api.php untuk testing session logic
 */
export async function apiCall(action, method = 'GET', body = null) {
    console.log(`API Call: ${method} ${action}`, body ? body : '(no body)');
    
    const options = { 
        method,
        credentials: 'include' 
    };
    
    // Gunakan test-api.php untuk testing
    const apiPath = 'test-api.php';

    const url = new URL(apiPath, window.location.href);
    url.searchParams.set('action', action);

    if (method.toUpperCase() === 'GET' && body) {
        for (const key in body) {
            if (body[key] !== null && body[key] !== undefined) {
                url.searchParams.set(key, body[key]);
            }
        }
    } else if (body) {
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }
    }

    let response;
    try {
        response = await fetch(url, options);
    } catch (networkError) {
        console.error(`Panggilan API gagal karena masalah jaringan untuk aksi "${action}":`, networkError);
        throw new Error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }

    const responseText = await response.text();

    if (response.status === 401) {
        console.log('Session expired or invalid, redirecting to login');
        if (!window.location.pathname.includes('login.html')) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 100);
        }
        throw new Error('Sesi tidak valid, mengalihkan ke halaman login.');
    }
    if (response.status === 403) {
        console.log('Access denied for action:', action);
        alert('Anda tidak memiliki izin untuk melakukan aksi ini.');
        throw new Error('Akses ditolak.');
    }

    if (!response.ok) {
        console.error("API Error Response Text:", responseText);
        try {
            const errorJson = JSON.parse(responseText);
            throw new Error(errorJson.message || `HTTP error! Status: ${response.status}`);
        } catch (e) {
            throw new Error(`HTTP error! Status: ${response.status}. Respons server tidak dapat dibaca.`);
        }
    }
    
    try {
        const result = JSON.parse(responseText);
        if (result && result.success === false) {
            console.error(`API Error for ${action}:`, result.message);
            throw new Error(result.message || 'Terjadi kesalahan API yang tidak diketahui.');
        }
        console.log(`API Success for ${action}:`, result.data);
        return result.data;
    } catch (e) {
        if (e.message.includes('API Error') || e.message.includes('Terjadi kesalahan')) {
            throw e;
        }
        console.error("Respons server bukan JSON yang valid. Konten mentah:", responseText);
        throw new Error('Respons server bukan JSON yang valid. Silakan periksa konsol untuk detail teknis.');
    }
}
