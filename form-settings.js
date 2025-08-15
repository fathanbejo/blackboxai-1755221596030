
// --- Elemen DOM ---
const fieldsConfigContainer = document.getElementById('fieldsConfigContainer');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const saveSpinner = document.getElementById('saveSpinner');
const addFieldBtn = document.getElementById('addFieldBtn');
const syncFromDbBtn = document.getElementById('syncFromDbBtn');
const visibilityActionBtn = document.getElementById('visibilityActionBtn');

// New Elements
const createFormPresetBtn = document.getElementById('createFormPresetBtn');
const createFormModal = document.getElementById('createFormModal');
const newPresetTitleInput = document.getElementById('newPresetTitle');
const newPresetSubtitle = document.getElementById('newPresetSubtitle');
const newPresetFieldsContainer = document.getElementById('newPresetFieldsContainer');
const performCreatePresetBtn = document.getElementById('performCreatePresetBtn');
const cancelCreatePresetBtn = document.getElementById('cancelCreatePresetBtn');
const importDataBtn = document.getElementById('importDataBtn');
const addColumnModal = document.getElementById('addColumnModal');
const performAddColumnBtn = document.getElementById('performAddColumnBtn');
const cancelAddColumnBtn = document.getElementById('cancelAddColumnBtn');
const newColumnNameInput = document.getElementById('newColumnName');
const newColumnTypeInput = document.getElementById('newColumnType');
const importModal = document.getElementById('importModal');
const excelFileInput = document.getElementById('excelFileInput');
const importProgressBar = document.getElementById('importProgressBar');
const importLog = document.getElementById('importLog');
const cancelImportBtn = document.getElementById('cancelImportBtn');
const toggleCollapseBtn = document.getElementById('toggleCollapseBtn');
const hideAllInFormBtn = document.getElementById('hideAllInFormBtn');

// Branding Elements
const schoolNameInput = document.getElementById('schoolNameInput');
const schoolSubtitleInput = document.getElementById('schoolSubtitleInput');
const formSubtitleInput = document.getElementById('formSubtitleInput');
const headerColorInput = document.getElementById('headerColorInput');

// Preset/History Elements
const saveConfigAsBtn = document.getElementById('saveConfigAsBtn');
const loadConfigBtn = document.getElementById('loadConfigBtn');
const deleteConfigBtn = document.getElementById('deleteConfigBtn');
const sharePresetBtn = document.getElementById('sharePresetBtn');
const savedConfigsDropdown = document.getElementById('savedConfigsDropdown');

// --- State & Data Global ---
let formSettings = { fields: [], displaySettings: {} };
let savedConfigs = [];
let draggedItem = null;
const protectedFields = ['id', 'ID_SISWA', 'NAMA', 'ROMBEL', 'Tanggal_Update_Terakhir'];

// --- API Helper ---
async function apiCall(action, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`api.php?action=${action}`, options);
        const result = await response.json().catch(() => ({ success: false, message: 'Invalid JSON response from server.' }));
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP error! status: ${response.status}`);
        return result.data;
    } catch (error) {
        console.error(`API call failed for action "${action}":`, error);
        throw error;
    }
}

// --- Fungsi Helper ---
function displayStatus(message, isError = false) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('Toast container not found!');
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    const iconClass = isError ? 'fa-times-circle' : 'fa-check-circle';
    toast.classList.add(isError ? 'error' : 'success');
    
    // Using innerHTML to allow for spinners etc. in the message
    toast.innerHTML = `<i class="fas ${iconClass}"></i><div>${message}</div>`;

    toastContainer.appendChild(toast);

    // This event listener is more reliable than a simple timeout for removal
    toast.addEventListener('animationend', (e) => {
        if (e.animationName === 'toast-fade-out') {
            toast.remove();
        }
    });
}

function sanitizeColumnName(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .trim()
        .toUpperCase()
        .replace(/[\s/().,]+/g, '_') // Replace special characters and spaces with an underscore
        .replace(/__+/g, '_') // Replace multiple underscores with a single one
        .replace(/_$/, ''); // Remove trailing underscore
}


// --- Logika Render & UI ---

function renderFieldConfigItem(config, index) {
    if (!config || !config.name) {
        console.error("Attempted to render an invalid field config at index:", index, config);
        return;
    }
    const { name, type, visible, editable, required, isNamaField, placeholder, hiddenInSettings, dropdownSourceType, manualOptions, markedForHiding, isCollapsed } = config;
    const isProtected = protectedFields.some(pf => pf.toUpperCase() === name.toUpperCase());
    const fieldIdPrefix = `config_${index}`;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'field-config-item';
    if(isCollapsed) itemDiv.classList.add('is-collapsed');
    itemDiv.dataset.index = index;
    itemDiv.draggable = true; // All fields are draggable now
    if (hiddenInSettings) itemDiv.style.display = 'none';
    if (markedForHiding) itemDiv.classList.add('marked-for-hiding');
    
    itemDiv.innerHTML = `
        <div class="field-header">
            <div class="header-left">
              <i class="fas fa-grip-vertical drag-handle" title="Seret untuk mengubah urutan" style="cursor: grab;"></i>
              <span style="font-weight: 600;">${name}</span> ${isProtected || isNamaField ? `<i class="fas fa-key" title="Field Kunci Sistem"></i>`: ''}
            </div>
            <div class="header-actions">
                <button class="field-action-btn visibility-toggle-btn" title="${visible ? 'Sembunyikan di Form' : 'Tampilkan di Form'}"><i class="fas ${visible ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
                <button class="field-action-btn hide-field-btn" title="Tandai untuk disembunyikan/batal"><i class="fas fa-eye-slash"></i></button>
                ${!isProtected ? `<button class="field-action-btn delete-field-btn" title="Hapus kolom ini dan seluruh datanya di database"><i class="fas fa-trash-alt"></i></button>` : ''}
                <button class="field-action-btn toggle-collapse-btn" title="${isCollapsed ? 'Bentangkan' : 'Ciutkan'}"><i class="fas fa-chevron-up"></i></button>
            </div>
        </div>
        ${isProtected ? `<p class="field-note" style="margin-top: 15px;">Field "${name}" adalah field sistem dan memiliki beberapa pengaturan yang dikunci.</p>` : ''}
        
        <div class="field-content">
            <div class="config-grid two-cols" style="margin-top: 15px;">
              <div class="config-group">
                <label for="${fieldIdPrefix}_placeholder">Hint Form:</label>
                <input type="text" id="${fieldIdPrefix}_placeholder" value="${placeholder || ''}">
              </div>
              <div class="config-group">
                <label for="${fieldIdPrefix}_type">Tipe Field:</label>
                <select id="${fieldIdPrefix}_type" ${isProtected ? 'disabled' : ''}>
                    <option value="text" ${type === 'text' ? 'selected' : ''}>Text</option>
                    <option value="date" ${type === 'date' ? 'selected' : ''}>Date</option>
                    <option value="textarea" ${type === 'textarea' ? 'selected' : ''}>Textarea</option>
                    <option value="dropdown" ${type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
                </select>
              </div>
            </div>
            <div class="checkbox-group">
                <div class="checkbox-item"><input type="checkbox" id="${fieldIdPrefix}_visible" ${visible ? 'checked' : ''}><label for="${fieldIdPrefix}_visible" class="checkbox-label">Tampil di Form</label></div>
                <div class="checkbox-item"><input type="checkbox" id="${fieldIdPrefix}_editable" ${editable ? 'checked' : ''} ${isProtected ? 'disabled' : ''}><label for="${fieldIdPrefix}_editable" class="checkbox-label">Dapat Diedit</label></div>
                <div class="checkbox-item"><input type="checkbox" id="${fieldIdPrefix}_required" ${required ? 'checked' : ''} ${isProtected ? 'disabled' : ''}><label for="${fieldIdPrefix}_required" class="checkbox-label">Wajib Diisi</label></div>
                <div class="checkbox-item"><input type="checkbox" id="${fieldIdPrefix}_defaultHidden" ${config.defaultHiddenInSettings ? 'checked' : ''}><label for="${fieldIdPrefix}_defaultHidden" class="checkbox-label" title="Sembunyikan di halaman pengaturan ini secara default.">Sembunyikan di Pengaturan</label></div>
            </div>
            <div class="dropdown-config-section" id="${fieldIdPrefix}_dropdownConfigContainer" style="display: ${type === 'dropdown' && !isProtected ? 'block' : 'none'}; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 15px;">
                <strong>Sumber Opsi Dropdown:</strong>
                <div class="radio-group" style="margin-top: 5px; margin-bottom: 10px;">
                    <label class="radio-label"><input type="radio" name="${fieldIdPrefix}_dropdownSource" value="auto" ${dropdownSourceType !== 'manual' ? 'checked' : ''}> Otomatis dari Data Unik</label>
                    <label class="radio-label" style="margin-left: 15px;"><input type="radio" name="${fieldIdPrefix}_dropdownSource" value="manual" ${dropdownSourceType === 'manual' ? 'checked' : ''}> Masukkan Manual</label>
                </div>
                <div id="${fieldIdPrefix}_dropdownAutoConfig" style="display: ${dropdownSourceType !== 'manual' ? 'block' : 'none'};"><i>Opsi diisi dari nilai unik di database.</i></div>
                <div id="${fieldIdPrefix}_dropdownManualConfig" style="display: ${dropdownSourceType === 'manual' ? 'block' : 'none'};">
                    <div class="config-group"><label for="${fieldIdPrefix}_manualOptions">Opsi (satu per baris):</label><textarea id="${fieldIdPrefix}_manualOptions" placeholder="Opsi A\nOpsi B">${Array.isArray(manualOptions) ? manualOptions.join('\n') : ''}</textarea></div>
                </div>
            </div>
        </div>
    `;
    fieldsConfigContainer.appendChild(itemDiv);
    
    // --- Event Listeners ---
    const toggleButton = itemDiv.querySelector('.toggle-collapse-btn');
    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        config.isCollapsed = !config.isCollapsed;
        itemDiv.classList.toggle('is-collapsed', config.isCollapsed);
        toggleButton.title = config.isCollapsed ? 'Bentangkan' : 'Ciutkan';
    });
    
    itemDiv.querySelector('.field-header').addEventListener('click', (e) => {
        if(e.target.closest('.field-action-btn')) return;
        config.isCollapsed = !config.isCollapsed;
        itemDiv.classList.toggle('is-collapsed', config.isCollapsed);
        toggleButton.title = config.isCollapsed ? 'Bentangkan' : 'Ciutkan';
    });

    if (!isProtected) {
        itemDiv.querySelector('.delete-field-btn')?.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteColumn(name); });
    }
    
    itemDiv.querySelector('.hide-field-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        config.markedForHiding = !config.markedForHiding;
        itemDiv.classList.toggle('marked-for-hiding', config.markedForHiding);
        updateVisibilityActionBtnState();
    });

    const visibilityToggleBtn = itemDiv.querySelector('.visibility-toggle-btn');
    if (visibilityToggleBtn) {
        visibilityToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fieldConf = formSettings.fields[index];
            fieldConf.visible = !fieldConf.visible;
            const visibleCheckbox = document.getElementById(`${fieldIdPrefix}_visible`);
            if(visibleCheckbox) visibleCheckbox.checked = fieldConf.visible;
            visibilityToggleBtn.querySelector('i').className = `fas ${fieldConf.visible ? 'fa-eye' : 'fa-eye-slash'}`;
            visibilityToggleBtn.title = fieldConf.visible ? 'Sembunyikan di Form' : 'Tampilkan di Form';
        });
    }

    if (!isProtected) {
        itemDiv.querySelector(`#${fieldIdPrefix}_type`).addEventListener('change', function() {
            document.getElementById(`${fieldIdPrefix}_dropdownConfigContainer`).style.display = this.value === 'dropdown' ? 'block' : 'none';
        });
        itemDiv.querySelectorAll(`input[name="${fieldIdPrefix}_dropdownSource"]`).forEach(radio => {
            radio.addEventListener('change', function() { if (this.checked) {
                 const autoSection = document.getElementById(`${fieldIdPrefix}_dropdownAutoConfig`);
                 const manualSection = document.getElementById(`${fieldIdPrefix}_dropdownManualConfig`);
                 if(autoSection) autoSection.style.display = this.value === 'auto' ? 'block' : 'none';
                 if(manualSection) manualSection.style.display = this.value === 'manual' ? 'block' : 'none';
            }});
        });
    }
}


function renderAllFields() {
    fieldsConfigContainer.innerHTML = '';
    formSettings.fields.forEach((field, index) => renderFieldConfigItem(field, index));
    updateDragDropListeners();
    updateVisibilityActionBtnState();
}

async function handleAddColumn() {
    const rawName = newColumnNameInput.value;
    const name = sanitizeColumnName(rawName);
    const type = newColumnTypeInput.value;
    if (!name) { alert('Nama kolom tidak valid atau kosong setelah dibersihkan.'); return; }
    if (formSettings.fields.some(f => f.name.toUpperCase() === name.toUpperCase())) { alert('Kolom dengan nama ini sudah ada.'); return; }

    performAddColumnBtn.disabled = true;
    try {
        await apiCall('addColumn', 'POST', { name, type });
        formSettings.fields.push({ name, label: name, type: 'text', visible: true, editable: true, required: false });
        await saveSettings(false); // Save new field to config
        displayStatus(`Kolom '${name}' berhasil ditambahkan ke database dan konfigurasi.`, false);
        renderAllFields();
        addColumnModal.style.display = 'none';
    } catch (err) {
        alert(`Gagal menambah kolom: ${err.message}`);
    } finally {
        performAddColumnBtn.disabled = false;
    }
}

async function handleDeleteColumn(name) {
    if (!confirm(`PERINGATAN FINAL!\n\nAnda yakin ingin menghapus kolom '${name}' DAN SEMUA DATANYA secara permanen dari database?\n\nAksi ini TIDAK BISA DIURUNGKAN.`)) return;

    try {
        displayStatus(`Menghapus kolom '${name}'...`, false);
        await apiCall('deleteColumn', 'POST', { name });
        formSettings.fields = formSettings.fields.filter(f => f.name !== name);
        await saveSettings(false); // Save updated config
        displayStatus(`Kolom '${name}' dan semua datanya telah dihapus.`, false);
        renderAllFields();
    } catch(err) {
        displayStatus(`Gagal menghapus kolom: ${err.message}`, true);
    }
}


function updateVisibilityActionBtnState() {
    const hiddenCount = formSettings.fields.filter(f => f.hiddenInSettings).length;
    const markedCount = formSettings.fields.filter(f => f.markedForHiding).length;

    if (hiddenCount > 0) {
        visibilityActionBtn.innerHTML = `<i class="fas fa-eye"></i> Tampilkan (${hiddenCount})`;
        visibilityActionBtn.onclick = handleShowAll;
        visibilityActionBtn.disabled = false;
    } else if (markedCount > 0) {
        visibilityActionBtn.innerHTML = `<i class="fas fa-eye-slash"></i> Sembunyikan (${markedCount})`;
        visibilityActionBtn.onclick = handleHideMarked;
        visibilityActionBtn.disabled = false;
    } else {
        visibilityActionBtn.innerHTML = `<i class="fas fa-eye-slash"></i> Sembunyikan`;
        visibilityActionBtn.disabled = true;
    }
}

function handleShowAll() {
    formSettings.fields.forEach(f => {
        f.hiddenInSettings = false;
        f.markedForHiding = false;
    });
    renderAllFields();
    displayStatus('Semua field yang tersembunyi telah ditampilkan.', false);
}

function handleHideMarked() {
    let count = 0;
    formSettings.fields.forEach(f => {
        if (f.markedForHiding) {
            f.hiddenInSettings = true;
            f.markedForHiding = false;
            count++;
        }
    });
    if (count > 0) {
        displayStatus(`${count} field telah disembunyikan. Tekan 'Simpan Pengaturan' untuk finalisasi.`, false);
    }
    renderAllFields();
}

function handleHideAllInForm() {
    if (!confirm('Anda yakin ingin menyembunyikan semua field dari formulir? Field NAMA tidak akan terpengaruh.')) return;
    
    let changedCount = 0;
    formSettings.fields.forEach(f => {
        const isProtected = protectedFields.some(pf => pf.toUpperCase() === f.name.toUpperCase());
        // Do not hide the main 'NAMA' field, but hide others
        if (!isProtected && !f.isNamaField && f.visible) {
            f.visible = false;
            changedCount++;
        }
    });

    if (changedCount > 0) {
        renderAllFields();
        displayStatus(`${changedCount} field telah disembunyikan. Tekan "Simpan Pengaturan" untuk menerapkan.`, false);
    } else {
        displayStatus('Semua field yang dapat disembunyikan sudah tidak tampil di form.', true);
    }
}


// --- Logika Penyimpanan & Pemuatan ---

async function loadSettings() {
    fieldsConfigContainer.innerHTML = 'Memuat konfigurasi... <span class="spinner" style="border-top-color: var(--secondary-color);"></span>';
    try {
        await syncFromDatabase(false); // Sync silently on load
        
        // Load display settings
        const displaySettings = formSettings.displaySettings || {};
        schoolNameInput.value = displaySettings.schoolName || '';
        schoolSubtitleInput.value = displaySettings.schoolSubtitle || '';
        formSubtitleInput.value = displaySettings.formSubtitle || '';
        headerColorInput.value = displaySettings.headerColor || '#2E7D32';

    } catch (err) {
        let userMessage = `<strong>Gagal memuat pengaturan:</strong> ${err.message}.<br>Pastikan API berjalan dan tabel 'app_settings' ada.`;
        displayStatus(userMessage, true);
        fieldsConfigContainer.innerHTML = `<p class="status-error" style="text-align: left; padding: 15px;">${userMessage}</p>`;
    }
}

async function saveSettings(showSuccessMessage = true) {
    saveSettingsButton.disabled = true;
    saveSpinner.style.display = 'inline-block';

    try {
        const domItems = Array.from(fieldsConfigContainer.querySelectorAll('.field-config-item'));
        // Build map from old index to its new position in the DOM
        const newOrderMap = new Map(domItems.map((item, newIndex) => [parseInt(item.dataset.index), newIndex]));
        
        // Create a new array and place fields in their new order
        const reorderedFields = new Array(formSettings.fields.length);
        formSettings.fields.forEach((field, oldIndex) => {
            const newIndex = newOrderMap.get(oldIndex);
            if (typeof newIndex === 'number') {
                reorderedFields[newIndex] = field;
            }
        });

        const updatedFields = reorderedFields.filter(Boolean).map((originalConfig, index) => {
            const fieldIdPrefix = `config_${formSettings.fields.indexOf(originalConfig)}`;
            const type = document.getElementById(`${fieldIdPrefix}_type`).value;

            const newConfig = {
                ...originalConfig,
                placeholder: document.getElementById(`${fieldIdPrefix}_placeholder`).value.trim(),
                type: type,
                visible: document.getElementById(`${fieldIdPrefix}_visible`).checked,
                editable: document.getElementById(`${fieldIdPrefix}_editable`).checked,
                required: document.getElementById(`${fieldIdPrefix}_required`).checked,
                defaultHiddenInSettings: document.getElementById(`${fieldIdPrefix}_defaultHidden`)?.checked || false,
            };

            const isProtected = protectedFields.some(pf => pf.toUpperCase() === newConfig.name.toUpperCase());
            if (newConfig.type === 'dropdown' && !isProtected) {
                const selectedSourceRadio = document.querySelector(`input[name="${fieldIdPrefix}_dropdownSource"]:checked`);
                newConfig.dropdownSourceType = selectedSourceRadio ? selectedSourceRadio.value : 'auto';
                if (newConfig.dropdownSourceType === 'manual') {
                    newConfig.manualOptions = document.getElementById(`${fieldIdPrefix}_manualOptions`).value.split('\n').map(opt => opt.trim()).filter(Boolean);
                } else {
                    newConfig.manualOptions = [];
                }
            }
            return newConfig;
        });
        
        const displaySettings = {
            schoolName: schoolNameInput.value.trim(),
            schoolSubtitle: schoolSubtitleInput.value.trim(),
            formSubtitle: formSubtitleInput.value.trim(),
            headerColor: headerColorInput.value,
        };

        const newSettings = { fields: updatedFields, displaySettings: displaySettings };
        await apiCall('saveSettings', 'POST', newSettings);
        
        formSettings = newSettings;
        formSettings.fields.forEach(f => {
             f.markedForHiding = false;
             const isProtected = protectedFields.some(pf => pf.toUpperCase() === f.name.toUpperCase());
             if (f.defaultHiddenInSettings && !isProtected) {
                f.hiddenInSettings = true;
             }
        });
        
        if (showSuccessMessage) displayStatus('Pengaturan berhasil disimpan!', false);
        renderAllFields(); 
    } catch (err) {
        displayStatus(`Gagal menyimpan: ${err.message}`, true);
    } finally {
        saveSettingsButton.disabled = false;
        saveSpinner.style.display = 'none';
    }
}


async function syncFromDatabase(showAlerts = true) {
    if (showAlerts) displayStatus('Menyelaraskan dengan kolom database... <span class="spinner"></span>', false);
    syncFromDbBtn.disabled = true;
    try {
        const [dbFields, settingsData] = await Promise.all([
            apiCall('syncFromDb'),
            apiCall('getSettings')
        ]);
        
        formSettings = settingsData;

        // Enforce system field properties
        formSettings.fields.forEach(field => {
            if (field.name.toUpperCase() === 'ID_SISWA') {
                field.editable = false; // <<< Ensure ID_SISWA is never editable
                field.required = true;
            }
            if (field.name.toUpperCase() === 'NAMA') {
                field.isNamaField = true;
                field.required = true;
                field.editable = true;
            }
        });
        
        const configFieldNames = new Set(formSettings.fields.map(f => f.name.toUpperCase()));
        let fieldsAdded = 0;
        
        dbFields.forEach(dbField => {
            if (!configFieldNames.has(dbField.toUpperCase())) {
                const newField = { name: dbField, label: dbField, type: 'text', visible: true, editable: true, required: false };
                if (dbField.toUpperCase() === 'ID_SISWA') newField.editable = false;
                formSettings.fields.push(newField);
                fieldsAdded++;
            }
        });

        // Add transient properties
        formSettings.fields.forEach(field => {
            field.markedForHiding = false;
            if (field.defaultHiddenInSettings) field.hiddenInSettings = true;
            if (typeof field.isCollapsed === 'undefined') {
                field.isCollapsed = true; // Collapse by default
            }
        });

        if (fieldsAdded > 0) {
            await apiCall('saveSettings', 'POST', formSettings); 
            if (showAlerts) {
                displayStatus(`Sinkronisasi berhasil! ${fieldsAdded} field baru dari database ditambahkan ke konfigurasi.`, false);
            }
        } else {
            if (showAlerts) {
                displayStatus('Konfigurasi sudah sinkron dengan database.', false);
            }
        }
        
        renderAllFields();

    } catch (error) {
        if (showAlerts) displayStatus(`Error saat sinkronisasi: ${error.message}`, true);
        else throw error;
    } finally {
        syncFromDbBtn.disabled = false;
    }
}

// --- Import Logic ---
function logImport(message, isError = false) {
    const p = document.createElement('p');
    p.innerHTML = message;
    if(isError) p.style.color = 'red';
    importLog.appendChild(p);
    importLog.scrollTop = importLog.scrollHeight;
}
function updateProgressBar(value) {
    value = Math.min(100, Math.max(0, value));
    importProgressBar.style.width = value + '%';
    importProgressBar.textContent = Math.round(value) + '%';
}
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    importLog.innerHTML = '';
    importProgressBar.parentElement.style.display = 'block';
    updateProgressBar(0);
    logImport(`Membaca file: ${file.name}...`);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) { logImport("File Excel kosong atau format tidak didukung.", true); return; }
            
            const headers = Object.keys(jsonData[0]);
            if (!headers.find(h => h.toUpperCase() === 'ID_SISWA')) {
                logImport('PROSES GAGAL: Kolom "ID_SISWA" wajib ada di file Excel.', true); return;
            }

            const headerMap = {};
            headers.forEach(h => { headerMap[h] = sanitizeColumnName(h); });

            const sanitizedJsonData = jsonData.map(row => {
                const newRow = {};
                for (const key in row) {
                    if (headerMap[key]) newRow[headerMap[key]] = row[key];
                }
                return newRow;
            });
            
            logImport(`Ditemukan ${sanitizedJsonData.length} baris data dengan ${headers.length} kolom.`);
            updateProgressBar(10);
            
            logImport("Menyelaraskan kolom database...");
            const currentDbColumns = formSettings.fields.map(f => f.name.toUpperCase());
            const sanitizedHeaders = Object.values(headerMap);
            const newColumnsToAdd = [...new Set(sanitizedHeaders.filter(h => h && !currentDbColumns.includes(h)))];
            
            if (newColumnsToAdd.length > 0) {
                logImport(`Menambahkan ${newColumnsToAdd.length} kolom baru:`);
                for (const newCol of newColumnsToAdd) {
                    const originalName = Object.keys(headerMap).find(key => headerMap[key] === newCol);
                    logImport(`- "${originalName}" diubah menjadi "${newCol}"`);
                    await apiCall('addColumn', 'POST', { name: newCol, type: 'VARCHAR(255)' });
                }
                await syncFromDatabase(false);
                logImport("Kolom baru berhasil ditambahkan ke database.");
            } else {
                logImport("Skema database sudah sesuai.");
            }
            updateProgressBar(30);

            logImport("Mengirim data ke server dalam batch...");
            const batchSize = 200;
            let successCount = 0;
            for (let i = 0; i < sanitizedJsonData.length; i += batchSize) {
                const batch = sanitizedJsonData.slice(i, i + batchSize);
                await apiCall('batchUpdate', 'POST', batch);
                successCount += batch.length;
                logImport(`Mengirim ${successCount} dari ${sanitizedJsonData.length} data...`);
                updateProgressBar(30 + (successCount / sanitizedJsonData.length) * 70);
            }
            logImport(`<strong>Impor Selesai! ${successCount} baris data telah berhasil diproses.</strong>`, false);
            updateProgressBar(100);

        } catch (err) {
            logImport(`PROSES GAGAL: ${err.message}`, true);
        } finally {
            excelFileInput.value = '';
        }
    };
    reader.onerror = () => logImport("Gagal membaca file.", true);
    reader.readAsArrayBuffer(file);
}

// --- Preset/History Logic ---
async function loadSavedConfigs() {
    try {
        const presetsData = await apiCall('getPresets');
        savedConfigs = Object.values(presetsData.presets || {}).sort((a,b) => a.name.localeCompare(b.name));
        
        savedConfigsDropdown.innerHTML = '<option value="">Pilih preset untuk dimuat...</option>';
        savedConfigs.forEach(config => {
            const option = new Option(config.name, config.id);
            savedConfigsDropdown.add(option);
        });
    } catch(err) {
        displayStatus(`Gagal memuat riwayat preset: ${err.message}`, true);
    }
}
async function handleSaveConfigAs() {
    const presetName = prompt("Masukkan nama untuk preset konfigurasi ini:", `Preset ${new Date().toLocaleDateString()}`);
    if (!presetName || presetName.trim() === '') return;
    saveConfigAsBtn.disabled = true;
    
    const currentFields = JSON.parse(JSON.stringify(formSettings.fields));
    currentFields.forEach(field => {
        delete field.hiddenInSettings;
        delete field.markedForHiding;
        delete field.isCollapsed; // Don't save transient state
    });

    const currentDisplaySettings = {
        schoolName: schoolNameInput.value.trim(),
        schoolSubtitle: schoolSubtitleInput.value.trim(),
        formSubtitle: formSubtitleInput.value.trim(),
        headerColor: headerColorInput.value,
    };

    const newPresetData = {
        name: presetName.trim(),
        fields: currentFields,
        displaySettings: currentDisplaySettings,
    };

    try {
        await apiCall('savePreset', 'POST', newPresetData);
        displayStatus(`Preset "${presetName}" berhasil disimpan.`, false);
        await loadSavedConfigs();
    } catch(err) {
        displayStatus(`Gagal menyimpan preset: ${err.message}`, true);
    } finally {
        saveConfigAsBtn.disabled = false;
    }
}
function handleLoadConfig() {
    const selectedId = savedConfigsDropdown.value;
    if (!selectedId) return;

    const selectedConfig = savedConfigs.find(c => c.id === selectedId);
    if (!selectedConfig) return displayStatus("Preset yang dipilih tidak ditemukan.", true);

    if (confirm(`Anda yakin ingin memuat preset "${selectedConfig.name}"? Perubahan yang belum disimpan di editor akan hilang.`)) {
        formSettings.fields = JSON.parse(JSON.stringify(selectedConfig.fields));
        formSettings.fields.forEach(f => {
            f.markedForHiding = false;
            f.hiddenInSettings = !!f.defaultHiddenInSettings;
            f.isCollapsed = true;
        });

        const presetDisplaySettings = selectedConfig.displaySettings || {};
        schoolNameInput.value = presetDisplaySettings.schoolName || '';
        schoolSubtitleInput.value = presetDisplaySettings.schoolSubtitle || '';
        formSubtitleInput.value = presetDisplaySettings.formSubtitle || '';
        headerColorInput.value = presetDisplaySettings.headerColor || '#2E7D32';

        renderAllFields();
        displayStatus(`Preset "${selectedConfig.name}" telah dimuat. Tekan 'Simpan Pengaturan' untuk menjadikannya aktif.`, false);
    }
}
async function handleDeleteConfig() {
    const selectedId = savedConfigsDropdown.value;
    const selectedConfig = savedConfigs.find(c => c.id === selectedId);
    if (!selectedId || !selectedConfig) return;

    if(confirm(`Anda yakin ingin menghapus preset "${selectedConfig.name}" secara permanen?`)) {
        deleteConfigBtn.disabled = true;
        try {
            await apiCall('deletePreset', 'POST', { id: selectedId });
            displayStatus(`Preset "${selectedConfig.name}" berhasil dihapus.`, false);
            await loadSavedConfigs();
        } catch(err) {
            displayStatus(`Gagal menghapus preset: ${err.message}`, true);
        } finally {
            deleteConfigBtn.disabled = false;
        }
    }
}
async function handleSharePreset() {
    const selectedId = savedConfigsDropdown.value;
    if (!selectedId) return;
    const url = new URL(window.location.href);
    const formUrl = url.href.replace('form-settings.html', 'form-entri.html');
    const shareableLink = `${formUrl}?preset=${selectedId}`;
    try {
        await navigator.clipboard.writeText(shareableLink);
        displayStatus('Link unik untuk preset telah disalin ke clipboard!', false);
    } catch(err) {
        displayStatus('Gagal menyalin link. Silakan salin secara manual.', true);
        prompt('Salin link ini:', shareableLink);
    }
}

function openCreateFormModal() {
    newPresetTitleInput.value = '';
    newPresetSubtitle.value = '';
    newPresetFieldsContainer.innerHTML = ''; // Clear previous fields
    formSettings.fields.forEach(field => {
        // Automatically check the core fields
        const isCoreField = field.name.toUpperCase() === 'NAMA' || field.name.toUpperCase() === 'ID_SISWA' || field.name.toUpperCase() === 'ROMBEL';
        const checkedAttribute = isCoreField ? 'checked' : '';
        const disabledAttribute = isCoreField ? 'disabled' : '';

        const itemHTML = `
            <div class="checkbox-item">
                <input type="checkbox" id="preset_field_${field.name}" value="${field.name}" ${checkedAttribute} ${disabledAttribute}>
                <label for="preset_field_${field.name}" class="checkbox-label">${field.label || field.name}</label>
            </div>
        `;
        newPresetFieldsContainer.insertAdjacentHTML('beforeend', itemHTML);
    });
    createFormModal.style.display = 'flex';
}

async function handleCreatePreset() {
    const presetName = newPresetTitleInput.value.trim();
    const presetSubtitle = newPresetSubtitle.value.trim();
    if (!presetName) {
        alert('Judul Form tidak boleh kosong.');
        return;
    }

    const selectedFields = new Set();
    newPresetFieldsContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selectedFields.add(cb.value);
    });

    if (selectedFields.size === 0) {
        alert('Pilih setidaknya satu kolom untuk ditampilkan di form.');
        return;
    }
    
    performCreatePresetBtn.disabled = true;
    
    const newPresetFields = JSON.parse(JSON.stringify(formSettings.fields));
    newPresetFields.forEach(field => {
        field.visible = selectedFields.has(field.name);
        delete field.hiddenInSettings;
        delete field.markedForHiding;
        delete field.isCollapsed;
    });
    
    const newPresetDisplaySettings = {
        schoolName: schoolNameInput.value.trim(),
        schoolSubtitle: schoolSubtitleInput.value.trim(),
        headerColor: headerColorInput.value,
        formSubtitle: presetSubtitle,
    };

    try {
        const newPresetPayload = {
            name: presetName,
            fields: newPresetFields,
            displaySettings: newPresetDisplaySettings
        };
        const newPresetData = await apiCall('savePreset', 'POST', newPresetPayload);
        createFormModal.style.display = 'none';
        await loadSavedConfigs();
        
        const url = new URL(window.location.href);
        const formUrl = url.href.replace('form-settings.html', 'form-entri.html');
        const shareableLink = `${formUrl}?preset=${newPresetData.id}`;
        displayStatus(`Preset "${presetName}" berhasil dibuat! Link: <a href="${shareableLink}" target="_blank">${shareableLink}</a>`, false);

    } catch(err) {
        displayStatus(`Gagal membuat preset: ${err.message}`, true);
    } finally {
        performCreatePresetBtn.disabled = false;
    }
}


// --- Drag and Drop Logic ---
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.field-config-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
function handleDragStart(e) {
    if(!e.target.draggable) return;
    draggedItem = e.currentTarget;
    setTimeout(() => { if(draggedItem) draggedItem.classList.add('dragging'); }, 0);
}
function handleDragEnd() {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        // The save function will now read the order directly from the DOM
        displayStatus('Urutan field diubah. Tekan "Simpan Pengaturan" untuk finalisasi.', false);
    }
}
function handleDragOver(e) {
    e.preventDefault();
    if (!draggedItem) return;
    const afterElement = getDragAfterElement(fieldsConfigContainer, e.clientY);
    if (afterElement) {
        fieldsConfigContainer.insertBefore(draggedItem, afterElement);
    } else {
        fieldsConfigContainer.appendChild(draggedItem);
    }
}
function updateDragDropListeners() {
    const items = fieldsConfigContainer.querySelectorAll('.field-config-item');
    items.forEach(item => {
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragend', handleDragEnd);
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadSavedConfigs();
    
    // Modal Listeners
    createFormPresetBtn.addEventListener('click', openCreateFormModal);
    performCreatePresetBtn.addEventListener('click', handleCreatePreset);
    cancelCreatePresetBtn.addEventListener('click', () => { createFormModal.style.display = 'none'; });
    
    addFieldBtn.addEventListener('click', () => { addColumnModal.style.display = 'flex'; });
    cancelAddColumnBtn.addEventListener('click', () => { addColumnModal.style.display = 'none'; });
    performAddColumnBtn.addEventListener('click', handleAddColumn);

    importDataBtn.addEventListener('click', () => { importModal.style.display = 'flex'; });
    cancelImportBtn.addEventListener('click', () => { importModal.style.display = 'none'; });
    excelFileInput.addEventListener('change', handleFileImport);
    
    saveSettingsButton.addEventListener('click', () => saveSettings(true));
    syncFromDbBtn.addEventListener('click', () => syncFromDatabase(true));
    hideAllInFormBtn.addEventListener('click', handleHideAllInForm);
    
    toggleCollapseBtn.addEventListener('click', () => {
        const areAnyExpanded = formSettings.fields.some(f => !f.isCollapsed);
        formSettings.fields.forEach(f => { f.isCollapsed = areAnyExpanded; });
        renderAllFields();
        if (areAnyExpanded) {
            toggleCollapseBtn.innerHTML = `<i class="fas fa-expand-alt"></i> Bentangkan Semua`;
            toggleCollapseBtn.title = "Bentangkan Semua Field";
        } else {
            toggleCollapseBtn.innerHTML = `<i class="fas fa-compress-alt"></i> Ciutkan Semua`;
            toggleCollapseBtn.title = "Ciutkan Semua Field";
        }
    });

    saveConfigAsBtn.addEventListener('click', handleSaveConfigAs);
    loadConfigBtn.addEventListener('click', handleLoadConfig);
    deleteConfigBtn.addEventListener('click', handleDeleteConfig);
    sharePresetBtn.addEventListener('click', handleSharePreset);
    savedConfigsDropdown.addEventListener('change', () => {
        const hasSelection = !!savedConfigsDropdown.value;
        loadConfigBtn.disabled = !hasSelection;
        deleteConfigBtn.disabled = !hasSelection;
        sharePresetBtn.disabled = !hasSelection;
    });
    fieldsConfigContainer.addEventListener('dragover', handleDragOver);
});
