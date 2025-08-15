import { apiCall } from './api-helper.js';
import { protectPage } from './auth-helper.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Lindungi halaman, semua peran yang login bisa masuk
    const user = await protectPage();
    if (!user) return; // Hentikan eksekusi jika tidak login

    // Elemen DOM
    const elements = {
        appHeaderTitle: document.getElementById('app-header-title'),
        header: document.querySelector('header.header'),
        statsContainer: document.getElementById('statsContainer'),
        sidebar: document.getElementById('sidebar'),
        startDateInput: document.getElementById('startDate'),
        endDateInput: document.getElementById('endDate'),
        filterKelasSelect: document.getElementById('filterKelas'),
        filterKelasBilqolamSelect: document.getElementById('filterKelasBilqolam'),
        filterNamaInput: document.getElementById('filterNamaInput'),
        autocompleteSuggestions: document.getElementById('autocompleteSuggestions'),
        resetFilterButton: document.getElementById('resetFilterButton'),
        exportXlsxButton: document.getElementById('exportXlsxButton'),
        loader: document.getElementById('loader'),
        statusMessageDiv: document.getElementById('statusMessage'),
        tableTitle: document.getElementById('tableTitle'),
        noDataMessage: document.getElementById('noDataMessage'),
        rowsPerPageSelect: document.getElementById('rowsPerPageSelect'),
        prevPageButton: document.getElementById('prevPageButton'),
        nextPageButton: document.getElementById('nextPageButton'),
        pageInfoSpan: document.getElementById('pageInfo'),
        tableHeaders: document.querySelectorAll("#absensiTable th[data-sortable='true']"),
        statCardTotal: document.getElementById('statCardTotal'),
        statCardSakit: document.getElementById('statCardSakit'),
        statCardIzin: document.getElementById('statCardIzin'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        tabs: document.querySelectorAll('.tab'),
        tableView: document.getElementById('tableView'),
        chartView: document.getElementById('chartView'),
        absensiTableBody: document.getElementById('absensiTableBody'),
        absensiTable: document.getElementById('absensiTable'),
        paginationControls: document.querySelector('.pagination-controls'),
        currentSortDescription: document.getElementById('currentSortDescription'),
        // Admin & Import elements (tetap menggunakan ID yang sama)
        adminLoginBtn: document.getElementById('adminLoginBtn'),
        adminControls: document.getElementById('adminControls'),
        importFile: document.getElementById('importFile'),
        benarkanBilqolamBtn: document.getElementById('benarkanBilqolamBtn'),
        // Modals tidak lagi dibutuhkan untuk login
        importLogModal: document.getElementById('importLogModal'),
        importProgressBar: document.getElementById('importProgressBar'),
        importLog: document.getElementById('importLog'),
        importLogClose: document.getElementById('importLogClose'),
    };

    // State
    let allStudents = [];
    let currentFilteredData = [];
    let currentPage = 1;
    let rowsPerPage = 10;
    let currentSortColumn = 'tanggal_izin';
    let currentSortDirection = 'desc';
    let activeAlasanFilter = null;
    let attendanceChart = null;
    let debounceTimeout;
    
    // Sembunyikan tombol login admin lama
    if (elements.adminLoginBtn) elements.adminLoginBtn.style.display = 'none';

    // Tampilkan kontrol admin jika peran adalah 'admin'
    if (user.role === 'admin') {
        if (elements.adminControls) elements.adminControls.style.display = 'block';
        const adminHeader = document.querySelector('.admin-only-header');
        if (adminHeader) adminHeader.style.display = '';
    }

    // --- Inisialisasi & Pengambilan Data ---
    async function initializeDashboard() {
        showLoader();
        try {
            const todayStr = getTodayDateString();
            elements.startDateInput.value = todayStr;
            elements.endDateInput.value = todayStr;

            allStudents = await apiCall('getAllStudents', 'GET');
            populateFilterDropdowns();
            
            await fetchAndDisplayAbsensi();
            await loadGlobalHeaders();
            
            setActiveStatCard(elements.statCardTotal);
            updateSortArrows();
            updateBilqolamFilterState();

        } catch (error) {
            console.error("Initialization failed:", error);
        } finally {
            hideLoader();
        }
    }
    
    async function loadGlobalHeaders() {
        try {
            const settings = await apiCall('getGlobalSettings', 'GET');
            if(settings.izin_dasbor_title && elements.appHeaderTitle) {
                elements.appHeaderTitle.textContent = settings.izin_dasbor_title;
            }
        } catch (error) {
            console.warn("Could not load global headers:", error.message);
        }
    }

    async function fetchAndDisplayAbsensi() {
        showLoader();
        try {
            const filters = getCurrentFilters();
            let data = await apiCall('getAbsensiData', 'GET', filters);
            
            data.forEach(row => {
                 const { display } = normalizeAndFormatDate(row.tanggal_izin);
                 row.tanggalDisplay = display;
            });

            updateStatCards(data);

            if (activeAlasanFilter) {
                 data = data.filter(row => {
                    const alasan = row.alasan ? row.alasan.toLowerCase().trim() : '';
                    if (activeAlasanFilter === 'sakit') return alasan === 'sakit';
                    if (activeAlasanFilter === 'izin') return alasan === 'izin' || alasan === 'ijin';
                    return true;
                });
            }
            
            currentFilteredData = data;
            currentPage = 1;
            updateTable();
            updateChart();
            updateTableTitle(filters);
        } catch (error) {
            console.error("Failed to fetch absensi data:", error);
        } finally {
            hideLoader();
        }
    }

    function populateFilterDropdowns() {
        const uniqueKelas = [...new Set(allStudents.map(s => s.ROMBEL).filter(Boolean))];
        const uniqueKelasBilqolam = [...new Set(allStudents.map(s => s.KELAS_BILQOLAM).filter(Boolean))];
        populateDropdown(elements.filterKelasSelect, uniqueKelas, "Semua Kelas");
        populateDropdown(elements.filterKelasBilqolamSelect, uniqueKelasBilqolam, "Semua Kelas Bilqolam");
    }

    function updateTable() {
        elements.absensiTableBody.innerHTML = '';
        sortData(currentFilteredData, currentSortColumn, currentSortDirection);

        if (currentFilteredData.length > 0) {
            const pageData = currentFilteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
            pageData.forEach(row => {
                const tr = elements.absensiTableBody.insertRow();
                let cellsHtml = `
                    <td>${row.tanggalDisplay || "N/A"}</td>
                    <td>${row.NAMA || "N/A"}</td>
                    <td>${row.ROMBEL || "N/A"}</td>
                    <td>${row.KELAS_BILQOLAM || "N/A"}</td>
                    <td>${row.alasan || "N/A"}</td>
                    <td>${row.keterangan || ""}</td>
                `;
                if (user.role === 'admin') {
                    cellsHtml += `<td><button class="delete-btn" data-id="${row.id}" title="Hapus Entri"><i class="fas fa-trash-alt"></i></button></td>`;
                }
                tr.innerHTML = cellsHtml;
            });
            elements.absensiTable.style.display = 'table';
            elements.noDataMessage.style.display = 'none';
        } else {
            elements.absensiTable.style.display = 'none';
            elements.noDataMessage.style.display = 'block';
        }
        updatePaginationControls();
    }
    
    async function handleDeleteAbsensi(absensiId) {
        if (confirm('Anda yakin ingin menghapus data absensi ini?')) {
            try {
                await apiCall('deleteAbsensi', 'POST', { id: absensiId });
                showStatusMessage('Data berhasil dihapus.', 'success');
                // Hapus baris dari data lokal dan render ulang
                currentFilteredData = currentFilteredData.filter(item => item.id != absensiId);
                updateTable();
            } catch (error) {
                showStatusMessage(`Gagal menghapus data: ${error.message}`, 'error');
            }
        }
    }

    elements.absensiTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            handleDeleteAbsensi(deleteBtn.dataset.id);
        }
    });

    // ... (Sisa fungsi helper seperti updateStatCards, updateChart, dll. tetap sama) ...
    
    // --- Sisipkan sisa kode dari file asli di sini, dengan beberapa penyesuaian ---
    // Pastikan semua fungsi helper (seperti getTodayDateString, populateDropdown, dll.)
    // juga disalin ke sini.

    // Contoh fungsi yang perlu disalin:
    function getTodayDateString() {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function populateDropdown(selectElement, items, defaultOptionText) {
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        items.sort().forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            selectElement.appendChild(option);
        });
    }

    function getCurrentFilters() {
        return {
            startDate: elements.startDateInput.value,
            endDate: elements.endDateInput.value,
            kelas: elements.filterKelasSelect.value,
            kelasBilqolam: elements.filterKelasBilqolamSelect.value,
            nama: elements.filterNamaInput.value,
        };
    }

    function showLoader() { elements.loader.style.display = 'block'; }
    function hideLoader() { elements.loader.style.display = 'none'; }
    
    function updatePaginationControls() {
        const totalRecords = currentFilteredData.length;
        const totalPages = Math.ceil(totalRecords / rowsPerPage);
        elements.pageInfoSpan.textContent = `Halaman ${currentPage} dari ${totalPages}`;
        elements.prevPageButton.disabled = currentPage === 1;
        elements.nextPageButton.disabled = currentPage >= totalPages;
    }
    
    function sortData(data, column, direction) {
        data.sort((a, b) => {
            let valA = a[column] || '';
            let valB = b[column] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function updateSortArrows() {
        elements.tableHeaders.forEach(th => {
            const arrow = th.querySelector('.sort-arrow');
            if (th.dataset.column === currentSortColumn) {
                arrow.innerHTML = currentSortDirection === 'asc' ? '&#9650;' : '&#9660;';
                th.setAttribute('aria-sort', currentSortDirection === 'asc' ? 'ascending' : 'descending');
            } else {
                arrow.innerHTML = '';
                th.setAttribute('aria-sort', 'none');
            }
        });
    }

    function updateTableTitle(filters) {
        if (filters.startDate && filters.endDate) {
            const start = normalizeAndFormatDate(filters.startDate).display;
            const end = normalizeAndFormatDate(filters.endDate).display;
            elements.tableTitle.textContent = start === end ? `Data Absensi (${start})` : `Data Absensi (${start} - ${end})`;
        } else {
            elements.tableTitle.textContent = `Data Absensi Keseluruhan`;
        }
    }
    
    function normalizeAndFormatDate(dateStr) {
        if (!dateStr) return { normalized: '', display: '' };
        const date = new Date(dateStr + 'T00:00:00');
        const normalized = date.toISOString().slice(0, 10);
        const display = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return { normalized, display };
    }
    
    function showStatusMessage(message, type = 'info') {
        elements.statusMessageDiv.textContent = message;
        elements.statusMessageDiv.className = `status-message status-${type}`;
        elements.statusMessageDiv.style.display = 'block';
        setTimeout(() => { elements.statusMessageDiv.style.display = 'none'; }, 5000);
    }

    // ... sisa fungsi helper dan event listener yang tidak berhubungan langsung dengan login ...
    initializeDashboard();
});
