
// --- DOM Elements ---
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const presetFilter = document.getElementById('presetFilter');
const columnFilterField = document.getElementById('columnFilterField');
const columnFilterValue = document.getElementById('columnFilterValue');
const exportXlsxBtn = document.getElementById('exportXlsxBtn');
const addSiswaBtn = document.getElementById('addSiswaBtn');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');

// Modal Elements
const studentDetailModal = document.getElementById('studentDetailModal');
const modalStudentName = document.getElementById('modalStudentName');
const modalStudentSubtitle = document.getElementById('modalStudentSubtitle');
const modalStudentData = document.getElementById('modalStudentData');
const closeStudentModalBtn = document.getElementById('closeStudentModalBtn');


// --- Global State ---
let formSettings = { fields: [] };
let allStudentsData = [];
let allPresetsData = {};
let filteredData = [];
let orderedFields = [];
let currentPage = 1;
const RECORDS_PER_PAGE = 10;
const CORE_FIELDS = ['ID_SISWA', 'NAMA', 'ROMBEL', 'TANGGAL_UPDATE_TERAKHIR', 'ID'];

// --- API Helper ---
async function apiCall(action, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`api.php?action=${action}`, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Unknown API error');
        return result.data;
    } catch (error) {
        console.error(`API call failed for action "${action}":`, error);
        throw error;
    }
}

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

// --- Core Application Logic ---

async function loadDataAndSettings() {
    tableBody.innerHTML = `<tr><td colspan="100%" class="loading-message">Memuat konfigurasi dan data... <span class="spinner"></span></td></tr>`;
    try {
        const [settings, students, presets] = await Promise.all([
            apiCall('getSettings'),
            apiCall('getAllStudents'),
            apiCall('getPresets')
        ]);
        
        formSettings = settings;
        allStudentsData = students;
        allPresetsData = presets.presets || {};

        if (!formSettings.fields) throw new Error("Konfigurasi field tidak valid.");
        
        let fieldsForGrid = [...formSettings.fields];
        orderedFields = fieldsForGrid;

        Object.entries(allPresetsData).forEach(([id, config]) => {
            presetFilter.add(new Option(config.name, id));
        });

        columnFilterField.innerHTML = '<option value="">-- Pilih Kolom --</option>';
        orderedFields.forEach(field => {
            columnFilterField.add(new Option(field.label || field.name, field.name));
        });
        
        applyFilter();

    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="100%" class="empty-message" style="color: red;">Gagal memuat data: ${err.message}</td></tr>`;
    }
}

function updateColumnValueFilter() {
    const selectedField = columnFilterField.value;
    columnFilterValue.innerHTML = '<option value="">-- Semua Nilai --</option>';

    if (!selectedField) {
        columnFilterValue.disabled = true;
        applyFilter();
        return;
    }

    const uniqueValues = [...new Set(allStudentsData.map(student => student[selectedField]).filter(Boolean))];
    uniqueValues.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    uniqueValues.forEach(value => {
        columnFilterValue.add(new Option(value, value));
    });
    columnFilterValue.disabled = false;
    applyFilter();
}


function applyFilter() {
    let data = [...allStudentsData];
    
    const selectedPresetId = presetFilter.value;
    if (selectedPresetId) {
        if (selectedPresetId === 'none') {
            const allPresetFields = new Set();
            Object.values(allPresetsData).forEach(p => {
                p.fields.forEach(f => {
                    if (!CORE_FIELDS.includes(f.name.toUpperCase())) {
                        allPresetFields.add(f.name);
                    }
                });
            });
            
            data = data.filter(student => {
                return ![...allPresetFields].some(field => student[field] != null && student[field] !== '');
            });
        } else {
            const presetConfig = allPresetsData[selectedPresetId];
            if (presetConfig && presetConfig.fields) {
                // BUG FIX: Filter only by fields that are VISIBLE in the preset, not all fields.
                const presetContentFields = presetConfig.fields
                    .filter(f => f.visible && !CORE_FIELDS.includes(f.name.toUpperCase()))
                    .map(f => f.name);

                if (presetContentFields.length > 0) {
                     data = data.filter(student => 
                        presetContentFields.some(field => student[field] != null && student[field] !== '')
                    );
                } else {
                    // If a preset has no visible content fields, it means no student can match it.
                    data = [];
                }
            }
        }
    }

    const colField = columnFilterField.value;
    const colValue = columnFilterValue.value;
    if (colField && colValue) {
        data = data.filter(student => String(student[colField] || '') === colValue);
    }
    
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
        data = data.filter(student =>
            Object.values(student).some(value =>
                String(value).toLowerCase().includes(query)
            )
        );
    }

    filteredData = data;
    currentPage = 1;
    renderTable();
}


function renderTable() {
    renderHeader();
    renderBody();
    renderPagination();
}

function renderHeader() {
    tableHeader.innerHTML = '';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>ID Siswa</th>
        <th>Nama Siswa (Klik untuk Detail)</th>
        <th style="text-align:center;">Aksi</th>
    `;
    tableHeader.appendChild(headerRow);
}

function renderBody() {
    tableBody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" class="empty-message">Tidak ada data ditemukan.</td></tr>`;
        return;
    }

    const paginatedData = filteredData.slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE);

    paginatedData.forEach(student => {
        const row = document.createElement('tr');
        row.dataset.docId = student.ID_SISWA;
        
        const idCell = row.insertCell();
        idCell.textContent = student.ID_SISWA;

        const nameCell = row.insertCell();
        nameCell.textContent = student.NAMA || '';
        nameCell.className = 'student-name';
        
        const actionTd = row.insertCell();
        actionTd.style.textAlign = 'center';
        actionTd.innerHTML = `<button class="delete-btn" title="Hapus Siswa"><i class="fas fa-trash-alt"></i></button>`;
        
        // Add event listeners
        nameCell.addEventListener('click', () => openStudentDetailModal(student.ID_SISWA));
        actionTd.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click event
            handleDelete(student.ID_SISWA, student.NAMA);
        });

        tableBody.appendChild(row);
    });
}

function openStudentDetailModal(studentId) {
    const student = allStudentsData.find(s => s.ID_SISWA == studentId);
    if (!student) return;

    modalStudentName.textContent = student.NAMA;

    const selectedPresetId = presetFilter.value;
    let fieldsToShow;
    if (selectedPresetId && selectedPresetId !== 'none' && allPresetsData[selectedPresetId]) {
        fieldsToShow = allPresetsData[selectedPresetId].fields.filter(f => f.visible);
        modalStudentSubtitle.textContent = `Data berdasarkan preset: ${allPresetsData[selectedPresetId].name}`;
    } else {
        fieldsToShow = formSettings.fields.filter(f => f.visible);
        modalStudentSubtitle.textContent = 'Menampilkan semua data yang terlihat';
    }
    
    modalStudentData.innerHTML = '';
    fieldsToShow.forEach(field => {
        const value = student[field.name] || '-';
        const dataItem = document.createElement('div');
        dataItem.className = 'data-item';
        dataItem.innerHTML = `
            <span class="data-item-label">${field.label || field.name}</span>
            <span class="data-item-value">${value}</span>
        `;
        modalStudentData.appendChild(dataItem);
    });

    studentDetailModal.style.display = 'flex';
}


function renderPagination() {
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);

    paginationInfo.textContent = totalRecords > 0 
        ? `Menampilkan ${Math.min((currentPage - 1) * RECORDS_PER_PAGE + 1, totalRecords)}-${Math.min(currentPage * RECORDS_PER_PAGE, totalRecords)} dari ${totalRecords} data`
        : '';
    paginationControls.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (text, page, isDisabled) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = isDisabled;
        if (!isDisabled) button.onclick = () => { currentPage = page; renderTable(); };
        if (page === currentPage) button.classList.add('active');
        return button;
    };

    paginationControls.appendChild(createButton('<i class="fas fa-angle-double-left"></i>', 1, currentPage === 1));
    paginationControls.appendChild(createButton('<i class="fas fa-angle-left"></i>', currentPage - 1, currentPage === 1));
    const pageDisplay = document.createElement('span');
    pageDisplay.textContent = ` Halaman ${currentPage} / ${totalPages} `;
    pageDisplay.style.padding = '0 10px';
    paginationControls.appendChild(pageDisplay);
    paginationControls.appendChild(createButton('<i class="fas fa-angle-right"></i>', currentPage + 1, currentPage === totalPages));
    paginationControls.appendChild(createButton('<i class="fas fa-angle-double-right"></i>', totalPages, currentPage === totalPages));
}

async function handleDelete(docId, studentName) {
    if (confirm(`Anda yakin ingin menghapus siswa "${studentName}" (ID: ${docId}) secara permanen?`)) {
        try {
            await apiCall('deleteStudent', 'POST', { id: docId });
            allStudentsData = allStudentsData.filter(s => s.ID_SISWA != docId);
            applyFilter();
            alert('Data berhasil dihapus.');
        } catch (err) {
            alert(`Gagal menghapus data: ${err.message}`);
        }
    }
}

async function handleAddSiswa() {
    const idSiswa = prompt("Masukkan ID Siswa (wajib):");
    if (!idSiswa) return;
    const namaSiswa = prompt("Masukkan Nama Siswa (wajib):");
    if (!namaSiswa) return;
    const rombelSiswa = prompt("Masukkan Rombel:");
    if (rombelSiswa === null) return;

    const newStudent = { 'ID_SISWA': idSiswa.trim(), 'NAMA': namaSiswa.trim(), 'ROMBEL': rombelSiswa.trim() };
    addSiswaBtn.disabled = true;
    try {
        const response = await apiCall('addStudent', 'POST', newStudent);
        allStudentsData.unshift({ ...newStudent, ID_SISWA: response.id });
        applyFilter();
        alert('Siswa baru berhasil ditambahkan.');
    } catch (err) {
        alert(`Gagal menambahkan siswa: ${err.message}`);
    } finally {
        addSiswaBtn.disabled = false;
    }
}

function handleExport() {
    if (filteredData.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }
    
    const visibleFields = orderedFields;
    
    const dataToExport = filteredData.map(row => {
        const newRow = {};
        visibleFields.forEach(field => {
            newRow[field.label || field.name] = row[field.name] || '';
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");
    
    XLSX.writeFile(workbook, `data_siswa_export_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadDataAndSettings();
    const debouncedFilter = debounce(applyFilter, 300);
    searchInput.addEventListener('input', debouncedFilter);
    presetFilter.addEventListener('change', applyFilter);
    columnFilterField.addEventListener('change', updateColumnValueFilter);
    columnFilterValue.addEventListener('change', applyFilter);
    addSiswaBtn.addEventListener('click', handleAddSiswa);
    exportXlsxBtn.addEventListener('click', handleExport);
    closeStudentModalBtn.addEventListener('click', () => { studentDetailModal.style.display = 'none'; });
});
