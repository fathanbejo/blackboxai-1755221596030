import { apiCall } from './api-helper.js';
import { protectPage } from './auth-helper.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Lindungi halaman, hanya admin yang bisa masuk
    const user = await protectPage('admin');
    if (!user) return; // Hentikan eksekusi jika tidak diotorisasi

    // --- Elemen DOM Pengaturan Global ---
    const saveBtn = document.getElementById('save-settings-btn');
    const saveSpinner = document.getElementById('save-spinner');
    const logoUpload = document.getElementById('logo-upload');
    const logoPreview = document.getElementById('logo-preview');

    const inputs = {
        'header_line_1': document.getElementById('header-line-1'), 'header_line_1_size': document.getElementById('header-line-1-size'), 'header_line_1_color': document.getElementById('header-line-1-color'),
        'header_line_2': document.getElementById('header-line-2'), 'header_line_2_size': document.getElementById('header-line-2-size'), 'header_line_2_color': document.getElementById('header-line-2-color'),
        'header_line_3': document.getElementById('header-line-3'), 'header_line_3_size': document.getElementById('header-line-3-size'), 'header_line_3_color': document.getElementById('header-line-3-color'),
        'header_line_4': document.getElementById('header-line-4'), 'header_line_4_size': document.getElementById('header-line-4-size'), 'header_line_4_color': document.getElementById('header-line-4-color'),
        'header_line_5': document.getElementById('header-line-5'), 'header_line_5_size': document.getElementById('header-line-5-size'), 'header_line_5_color': document.getElementById('header-line-5-color'),
        'header_line_6': document.getElementById('header-line-6'), 'header_line_6_size': document.getElementById('header-line-6-size'), 'header_line_6_color': document.getElementById('header-line-6-color'),
        'dashboard_title': document.getElementById('dashboard-title'),
        'dashboard_subtitle': document.getElementById('dashboard-subtitle'),
        'izin_form_title': document.getElementById('izin-form-title'),
        'izin_form_subtitle': document.getElementById('izin-form-subtitle'),
        'izin_dasbor_title': document.getElementById('izin-dasbor-title'),
        'rapat_form_title': document.getElementById('rapat-form-title'),
    };

    // --- Elemen DOM Manajemen Pengguna ---
    const userForm = document.getElementById('user-form');
    const userTableBody = document.getElementById('user-table-body');
    const userIdInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('user-username');
    const namaLengkapInput = document.getElementById('user-nama-lengkap');
    const passwordInput = document.getElementById('user-password');
    const roleSelect = document.getElementById('user-role');
    const saveUserBtn = document.getElementById('save-user-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    // --- Logika Pengaturan Global ---
    const defaults = { 'header_line_1_color': '#2E7D32', 'header_line_2_color': '#2E7D32', 'header_line_3_color': '#2E7D32', 'header_line_4_color': '#2E7D32', 'header_line_5_color': '#000000', 'header_line_6_color': '#000000' };

    async function loadSettings() {
        try {
            const settings = await apiCall('getGlobalSettings', 'GET');
            for (const key in inputs) {
                if (settings[key]) {
                    inputs[key].value = settings[key];
                } else if (defaults[key] && inputs[key].type === 'color') {
                    inputs[key].value = defaults[key];
                }
            }
            if (settings.logo_path) {
                logoPreview.src = settings.logo_path.startsWith('http') ? settings.logo_path : `${settings.logo_path}?t=${new Date().getTime()}`;
            }
        } catch (error) {
            console.error('Failed to load global settings:', error);
            alert('Gagal memuat pengaturan yang ada.');
        }
    }

    logoUpload.addEventListener('change', () => {
        const file = logoUpload.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { logoPreview.src = e.target.result; };
            reader.readAsDataURL(file);
        }
    });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveSpinner.style.display = 'inline-block';
        const formData = new FormData();
        for (const key in inputs) { formData.append(key, inputs[key].value); }
        if (logoUpload.files[0]) { formData.append('logo', logoUpload.files[0]); }
        try {
            await apiCall('saveGlobalSettings', 'POST', formData);
            alert('Pengaturan global berhasil disimpan!');
            await loadSettings();
        } catch (error) {
            alert(`Gagal menyimpan pengaturan: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveSpinner.style.display = 'none';
        }
    });

    // --- Logika Manajemen Pengguna ---
    async function loadUsers() {
        try {
            const users = await apiCall('getUsers', 'GET');
            userTableBody.innerHTML = '';
            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${u.username}</td>
                    <td>${u.nama_lengkap}</td>
                    <td><span class="role-badge role-${u.role}">${u.role}</span></td>
                    <td class="user-actions">
                        <button class="edit-user-btn" data-id="${u.id}" title="Edit Pengguna"><i class="fas fa-edit"></i></button>
                        <button class="delete-user-btn" data-id="${u.id}" title="Hapus Pengguna"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                userTableBody.appendChild(tr);
            });
        } catch (error) {
            userTableBody.innerHTML = `<tr><td colspan="4">Gagal memuat pengguna: ${error.message}</td></tr>`;
        }
    }
    
    function resetUserForm() {
        userForm.reset();
        userIdInput.value = '';
        saveUserBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Pengguna';
        cancelEditBtn.style.display = 'none';
        passwordInput.placeholder = "Isi untuk membuat";
        passwordInput.required = true;
    }

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id: userIdInput.value || null,
            username: usernameInput.value,
            nama_lengkap: namaLengkapInput.value,
            password: passwordInput.value || null,
            role: roleSelect.value
        };
        
        saveUserBtn.disabled = true;
        try {
            await apiCall('saveUser', 'POST', payload);
            alert('Pengguna berhasil disimpan.');
            resetUserForm();
            await loadUsers();
        } catch(error) {
            alert(`Gagal menyimpan pengguna: ${error.message}`);
        } finally {
            saveUserBtn.disabled = false;
        }
    });
    
    userTableBody.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-user-btn');
        const deleteBtn = e.target.closest('.delete-user-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            const users = await apiCall('getUsers', 'GET');
            const userToEdit = users.find(u => u.id == id);
            if (userToEdit) {
                userIdInput.value = userToEdit.id;
                usernameInput.value = userToEdit.username;
                namaLengkapInput.value = userToEdit.nama_lengkap;
                roleSelect.value = userToEdit.role;
                passwordInput.placeholder = "Isi untuk mengubah";
                passwordInput.required = false;
                saveUserBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Perubahan';
                cancelEditBtn.style.display = 'inline-block';
                window.scrollTo({ top: document.getElementById('user-management-section').offsetTop, behavior: 'smooth' });
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const username = deleteBtn.closest('tr').cells[0].textContent;
            if (confirm(`Anda yakin ingin menghapus pengguna "${username}"?`)) {
                try {
                    await apiCall('deleteUser', 'POST', { id });
                    alert('Pengguna berhasil dihapus.');
                    await loadUsers();
                } catch (error) {
                    alert(`Gagal menghapus: ${error.message}`);
                }
            }
        }
    });

    cancelEditBtn.addEventListener('click', resetUserForm);

    // --- Inisialisasi Halaman ---
    loadSettings();
    loadUsers();
});