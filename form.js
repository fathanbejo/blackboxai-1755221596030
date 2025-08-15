
// --- Elemen DOM ---
const dynamicFormContainer = document.getElementById('dynamicFormContainer');
const dataForm = document.getElementById('dataForm');
const submitButton = document.getElementById('submitButton');
const submitSpinner = document.getElementById('submitSpinner');
const responseDiv = document.getElementById('response');
const reviewModalOverlay = document.getElementById('reviewModalOverlay');
const reviewDataContainer = document.getElementById('reviewDataContainer');
const closeModalButton = document.getElementById('closeModalButton');
const schoolNameEl = document.getElementById('schoolName');
const schoolSubtitleEl = document.getElementById('schoolSubtitle');
const formTitleEl = document.getElementById('formTitle');
const formSubtitleEl = document.getElementById('formSubtitle');

// --- State & Data Global ---
let loadedFieldConfig = {};
let allStudentsData = []; 
let selectedStudentData = null; 
let activeSuggestionIndex = -1;
let currentPresetId = null;

// Mapping untuk Logika Bisnis
const extracurricularMapping = {
    'ALBANJARI': [1, 6], 'BULU TANGKIS': [4, 6], 'CATUR': [2, 5], 'DRUMBAND': [3, 5], 
    'JURNALISTIK': [3, 5], 'KALIGRAFI': [2, 5], 'KETERAMPILAN IT': [4, 6], 'MENYANYI': [2, 5], 
    'MEWARNA': [1, 2], 'MTQ': [2, 6], 'PENCAK SILAT': [1, 5], 'PRAMUKA (TIM INTI)': [4, 6], 
    'PUISI': [2, 5], 'ROBOTIK': [1, 5], 'SEPAK BOLA': [3, 6], 'TENIS MEJA': [2, 5], 'VOLI': [4, 6]
};

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

// --- Fungsi Helper ---

function getGradeFromRombel(rombel) {
    if (!rombel || typeof rombel !== 'string') return null;
    const gradeMatch = rombel.match(/^(\d)/);
    return gradeMatch ? parseInt(gradeMatch[1], 10) : null;
}

function sanitizeId(id) {
    if (typeof id !== 'string') id = String(id);
    return id.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function displayResponse(message, isError = false) {
  responseDiv.innerHTML = message;
  responseDiv.className = isError ? 'response-error' : 'response-success';
  responseDiv.style.display = 'block';
  setTimeout(() => { responseDiv.style.display = 'none'; }, 6000);
}

function showAutocompleteDataStatus(message, isError = true) {
    if (!loadedFieldConfig.fields) return;
    const namaConfig = loadedFieldConfig.fields.find(f => f.isNamaField);
    if (!namaConfig) return;
    const namaInput = document.getElementById('field_' + sanitizeId(namaConfig.name));
    if (!namaInput || !namaInput.parentElement) return;

    let statusMsgElement = namaInput.parentElement.querySelector('.field-note-autocomplete');
    if (statusMsgElement) {
        statusMsgElement.textContent = message;
        statusMsgElement.style.color = isError ? '#cc8400' : '#2E7D32';
        statusMsgElement.style.display = message ? 'block' : 'none';
    }
}

function updateSuggestionHighlight(items) { 
    items.forEach(item => item.classList.remove('active'));
    if (activeSuggestionIndex > -1 && items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].classList.add('active');
        items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }
}

function setDropdownValue(selectElement, value) {
    const customInput = document.getElementById(selectElement.id + '_custom');
    let valueExists = Array.from(selectElement.options).some(opt => opt.value === value && value !== "LAINNYA_CUSTOM_VALUE");

    if (valueExists) {
        selectElement.value = value;
    } else if (value) {
        selectElement.value = 'LAINNYA_CUSTOM_VALUE';
        if(customInput) customInput.value = value;
    } else {
        selectElement.value = '';
    }
    selectElement.dispatchEvent(new Event('change'));
}

function applyDisplaySettings(displaySettings) {
    const settings = displaySettings || {};
    const defaultColor = '#2E7D32';
    const defaultName = 'MI ALMAARIF 02 SGS';
    const defaultSchoolSubtitle = 'Madrasah Ibtidaiyah Assalam 02 Surabaya';
    const defaultFormSubtitle = 'Ketik dan pilih nama siswa untuk mengisi data lainnya secara otomatis.';
    
    const headerColor = settings.headerColor || defaultColor;
    document.documentElement.style.setProperty('--header-bg-color', headerColor);
    
    if (schoolNameEl) schoolNameEl.textContent = settings.schoolName || defaultName;
    if (schoolSubtitleEl) schoolSubtitleEl.textContent = settings.schoolSubtitle || defaultSchoolSubtitle;
    if (formSubtitleEl) {
        formSubtitleEl.textContent = settings.formSubtitle || defaultFormSubtitle;
    }
}

// --- Logika Inti Aplikasi ---

async function loadStudentData() {
  showAutocompleteDataStatus("Memuat data siswa...", false);
  try {
    allStudentsData = await apiCall('getAllStudents');
    if (allStudentsData.length > 0) {
      showAutocompleteDataStatus("", false); 
    } else {
      showAutocompleteDataStatus("Tidak ada data siswa ditemukan di database.", true);
    }
  } catch(err) {
    displayResponse('Gagal memuat data siswa. Coba refresh halaman.', true);
    showAutocompleteDataStatus(`Error memuat data: ${err.message}. Autocomplete tidak akan berfungsi.`, true);
  }
}

async function updateExtracurricularOptions(studentGrade) {
    if (!loadedFieldConfig.fields) return;
    const ekskulConfig = loadedFieldConfig.fields.find(f => f.name.toUpperCase().includes('EKSTRAKURIKULER'));
    if (!ekskulConfig) return;

    const extracurricularSelectElement = document.getElementById('field_' + sanitizeId(ekskulConfig.name));
    if (!extracurricularSelectElement) return;

    if (!extracurricularSelectElement._originalOptions) {
        extracurricularSelectElement._originalOptions = Array.from(extracurricularSelectElement.options).map(opt => ({
            value: opt.value, text: opt.text
        })).filter(opt => opt.value && opt.value !== 'LAINNYA_CUSTOM_VALUE');
    }
    if (!extracurricularSelectElement._originalOptions) return;

    const currentValue = extracurricularSelectElement.value;
    const otherOption = extracurricularSelectElement.querySelector('option[value="LAINNYA_CUSTOM_VALUE"]');
    
    extracurricularSelectElement.innerHTML = '';
    extracurricularSelectElement.add(new Option(extracurricularSelectElement._originalOptions.length > 0 ? `Pilih ${ekskulConfig.label}...` : 'Tidak ada opsi', ""));
    if(otherOption) extracurricularSelectElement.add(otherOption);

    const optionsToShow = extracurricularSelectElement._originalOptions.filter(option => {
        if (studentGrade === null) return true; // Show all if no grade
        const mapping = extracurricularMapping[option.value.toUpperCase().trim()];
        if (mapping) {
            const [minGrade, maxGrade] = mapping;
            return studentGrade >= minGrade && studentGrade <= maxGrade;
        }
        return true; // Show if not in mapping
    });
    
    optionsToShow.forEach(option => {
        extracurricularSelectElement.insertBefore(new Option(option.text, option.value), otherOption);
    });

    if (studentGrade === null) {
        extracurricularSelectElement.disabled = true;
        extracurricularSelectElement.options[0].text = 'Pilih siswa terlebih dahulu';
    } else {
        extracurricularSelectElement.disabled = false;
        extracurricularSelectElement.options[0].text = `Pilih ${ekskulConfig.label}...`;
    }
    
    setDropdownValue(extracurricularSelectElement, currentValue);
}


function populateAllVisibleFields(studentData) {
    if (!studentData || !loadedFieldConfig.fields) return;
    loadedFieldConfig.fields.forEach(config => {
        const fieldId = 'field_' + sanitizeId(config.name);
        const inputElement = document.getElementById(fieldId);

        if (inputElement && config.visible && !config.isNamaField) {
            const studentValue = studentData[config.name] || '';
            if (inputElement.tagName === 'SELECT') {
                setDropdownValue(inputElement, studentValue);
            } else {
                inputElement.value = studentValue;
            }
        }
    });
}

function clearEditableFieldsAndResetReadOnly() {
    if (!loadedFieldConfig.fields) return;
    loadedFieldConfig.fields.forEach(config => {
        const fieldId = 'field_' + sanitizeId(config.name);
        const inputElement = document.getElementById(fieldId);
        if (inputElement && !config.isNamaField) {
            if (config.editable) {
                if(inputElement.tagName === 'SELECT') {
                    setDropdownValue(inputElement, '');
                } else {
                    inputElement.value = '';
                }
            } else if (config.visible) {
                inputElement.value = '';
            }
        }
    });
}

function handleNamaInput(event, suggestionsListId) {
    const inputText = event.target.value.toLowerCase();
    const namaInputElement = event.target;
    const suggestionsList = document.getElementById(suggestionsListId);

    selectedStudentData = null;
    submitButton.disabled = true;
    if (suggestionsList) suggestionsList.innerHTML = '';
    activeSuggestionIndex = -1;

    clearEditableFieldsAndResetReadOnly();
    updateExtracurricularOptions(null);

    if (inputText.length < 2 || !allStudentsData || allStudentsData.length === 0) {
        if (suggestionsList) suggestionsList.style.display = 'none';
        return;
    }

    const filteredStudents = allStudentsData.filter(student =>
        student.NAMA && student.NAMA.toLowerCase().includes(inputText)
    );

    if (filteredStudents.length > 0 && suggestionsList) {
        filteredStudents.forEach(student => {
            const li = document.createElement('li');
            li.textContent = `${student.NAMA}${student.ROMBEL ? ` (${student.ROMBEL})` : ''}`;
            li.addEventListener('click', async () => {
                namaInputElement.value = student.NAMA;
                selectedStudentData = student; // Store the whole student object
                const studentGrade = getGradeFromRombel(student.ROMBEL);
                await updateExtracurricularOptions(studentGrade);
                populateAllVisibleFields(student);
                suggestionsList.style.display = 'none';
                submitButton.disabled = false;
                const firstEditableField = loadedFieldConfig.fields.find(f => f.editable && !f.isNamaField && f.visible);
                if(firstEditableField) document.getElementById('field_' + sanitizeId(firstEditableField.name))?.focus();
            });
            suggestionsList.appendChild(li);
        });
        suggestionsList.style.display = 'block';
    } else {
        if (suggestionsList) suggestionsList.style.display = 'none';
    }
}

async function renderSingleField(config) {
    const { name, label, type, required, editable, isNamaField, placeholder, dropdownSourceType, manualOptions } = config;

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    // Add class for layout
    if (isNamaField || type === 'textarea') {
        formGroup.classList.add('form-group-full-width');
    } else {
        formGroup.classList.add('form-group-half-width');
    }

    const fieldLabel = document.createElement('label');
    const fieldId = 'field_' + sanitizeId(name);
    fieldLabel.setAttribute('for', fieldId);
    fieldLabel.innerHTML = `${label || name}${required ? '<span style="color:red">*</span>' : ''}:`;
    formGroup.appendChild(fieldLabel);

    let inputElement;
    if (type === 'dropdown') {
        inputElement = document.createElement('select');
        inputElement.add(new Option(`Pilih ${label || name}...`, ""));
        if (dropdownSourceType === 'manual' && Array.isArray(manualOptions)) {
            manualOptions.forEach(opt => inputElement.add(new Option(opt, opt)));
        } else {
            const uniqueValues = [...new Set(allStudentsData.map(s => s[name]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b)));
            uniqueValues.forEach(val => inputElement.add(new Option(val, val)));
        }
    } else {
        inputElement = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
        if (type !== 'textarea') inputElement.type = type;
    }

    inputElement.id = fieldId;
    inputElement.name = name;
    if (required) inputElement.required = true;
    inputElement.disabled = !editable;
    if(inputElement.tagName !== 'SELECT') inputElement.readOnly = !editable;
    formGroup.appendChild(inputElement);

    if (placeholder) {
        const hintElement = document.createElement('p');
        hintElement.className = 'form-field-hint';
        hintElement.textContent = placeholder;
        formGroup.appendChild(hintElement);
    }

    if (type === 'dropdown') {
        inputElement.add(new Option('LAINNYA...', 'LAINNYA_CUSTOM_VALUE'));
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.id = fieldId + '_custom';
        customInput.name = name + '_custom';
        customInput.placeholder = 'Ketik pilihan kustom...';
        customInput.style.cssText = 'display: none; margin-top: 8px; width: 100%;';
        customInput.disabled = !editable;
        formGroup.appendChild(customInput);
        inputElement.addEventListener('change', () => {
            const showCustom = inputElement.value === 'LAINNYA_CUSTOM_VALUE';
            customInput.style.display = showCustom ? 'block' : 'none';
            if (showCustom && editable) customInput.focus();
            if (!showCustom) customInput.value = '';
        });
    }

    if (isNamaField) {
        const suggestionsUl = document.createElement('ul');
        suggestionsUl.id = fieldId + '_suggestions_list';
        suggestionsUl.className = 'autocomplete-suggestions-list';
        formGroup.appendChild(suggestionsUl);

        const statusMsgElement = document.createElement('p');
        statusMsgElement.className = 'field-note-autocomplete';
        formGroup.appendChild(statusMsgElement);

        inputElement.setAttribute('autocomplete', 'off');
        inputElement.addEventListener('input', (event) => handleNamaInput(event, suggestionsUl.id));
        inputElement.addEventListener('blur', () => setTimeout(() => { suggestionsUl.style.display = 'none'; }, 150));
        inputElement.addEventListener('keydown', (event) => {
            const items = Array.from(suggestionsUl.getElementsByTagName('li'));
            if (!items.length || suggestionsUl.style.display === 'none') return;
            if (event.key === 'ArrowDown') { event.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length; }
            else if (event.key === 'ArrowUp') { event.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length; }
            else if (event.key === 'Enter') { event.preventDefault(); if (activeSuggestionIndex > -1) items[activeSuggestionIndex].click(); }
            else if (event.key === 'Escape') { suggestionsUl.style.display = 'none'; }
            updateSuggestionHighlight(items);
        });
    }

    return formGroup;
}

async function generateFormFields() {
    dynamicFormContainer.innerHTML = '';
    if (!loadedFieldConfig.fields || loadedFieldConfig.fields.length === 0) {
        dynamicFormContainer.innerHTML = '<p class="form-loading response-error">Tidak ada field yang dikonfigurasi. Silakan atur di halaman Pengaturan.</p>';
        submitButton.disabled = true;
        return;
    }
    for (const config of loadedFieldConfig.fields) {
        if (config.visible) {
            const fieldElement = await renderSingleField(config);
            dynamicFormContainer.appendChild(fieldElement);
        }
    }
}

function populateReviewModal(data) {
    reviewDataContainer.innerHTML = '';
    if (!loadedFieldConfig.fields) return;
    loadedFieldConfig.fields.forEach(config => {
        if (config.editable && data.hasOwnProperty(config.name)) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'review-item';
            itemDiv.innerHTML = `<strong>${config.label || config.name}:</strong> <span>${data[config.name] || '-'}</span>`;
            reviewDataContainer.appendChild(itemDiv);
        }
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!selectedStudentData || !selectedStudentData.ID_SISWA) {
        displayResponse('Harap pilih nama siswa yang valid dari daftar autocomplete.', true);
        return;
    }
    submitButton.disabled = true;
    submitSpinner.style.display = 'inline-block';

    const dataToUpdate = {};
    const dataForReview = { NAMA: selectedStudentData.NAMA, ROMBEL: selectedStudentData.ROMBEL };

    loadedFieldConfig.fields.forEach(config => {
        if (config.editable && config.visible && !config.isNamaField) {
            const field = dataForm.elements[config.name];
            if (field) {
                let valueToSave = field.tagName === 'SELECT' && field.value === 'LAINNYA_CUSTOM_VALUE'
                    ? document.getElementById(field.id + '_custom')?.value.trim()
                    : field.value;
                dataToUpdate[config.name] = valueToSave;
                dataForReview[config.name] = valueToSave;
            }
        }
    });

    try {
        await apiCall('updateStudent', 'POST', { id: selectedStudentData.ID_SISWA, data: dataToUpdate });
        populateReviewModal(dataForReview);
        reviewModalOverlay.style.display = 'flex';
    } catch (err) {
        displayResponse(`Error: ${err.message}`, true);
    } finally {
        submitButton.disabled = false;
        submitSpinner.style.display = 'none';
    }
}

function resetFormForNextEntry() {
    reviewModalOverlay.style.display = 'none';
    dataForm.reset();
    clearEditableFieldsAndResetReadOnly();
    updateExtracurricularOptions(null);
    selectedStudentData = null;
    document.querySelectorAll('input[id$="_custom"]').forEach(el => el.style.display = 'none');
    
    const namaConfig = loadedFieldConfig.fields.find(f => f.isNamaField);
    if (namaConfig) document.getElementById('field_' + sanitizeId(namaConfig.name))?.focus();
    
    submitButton.disabled = true;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        currentPresetId = urlParams.get('preset');

        const globalSettings = await apiCall('getSettings');
        let displaySettingsToApply = globalSettings.displaySettings || {};

        if (currentPresetId) {
            const presetData = await apiCall('getSinglePreset', 'POST', { id: currentPresetId });
            loadedFieldConfig = presetData;
            if (formTitleEl && presetData.name) {
                formTitleEl.textContent = presetData.name;
            }
            // If preset has its own display settings, use them. Otherwise, stick with global.
            if (presetData.displaySettings) {
                displaySettingsToApply = presetData.displaySettings;
            }
        } else {
            loadedFieldConfig = globalSettings; 
        }

        // Apply the determined display settings
        applyDisplaySettings(displaySettingsToApply);
        
        // Reorder ROMBEL to be after NAMA
        if (loadedFieldConfig.fields) {
            const namaIndex = loadedFieldConfig.fields.findIndex(f => f.name.toUpperCase() === 'NAMA');
            const rombelIndex = loadedFieldConfig.fields.findIndex(f => f.name.toUpperCase() === 'ROMBEL');
            if (namaIndex !== -1 && rombelIndex !== -1 && rombelIndex !== namaIndex + 1) {
                const rombelField = loadedFieldConfig.fields.splice(rombelIndex, 1)[0];
                const newNamaIndex = loadedFieldConfig.fields.findIndex(f => f.name.toUpperCase() === 'NAMA');
                loadedFieldConfig.fields.splice(newNamaIndex + 1, 0, rombelField);
            }
        }

        await loadStudentData();
        await generateFormFields();
        await updateExtracurricularOptions(null);
        dataForm.addEventListener('submit', handleFormSubmit);
        closeModalButton.addEventListener('click', resetFormForNextEntry);
    } catch (err) {
        dynamicFormContainer.innerHTML = `<p class="form-loading response-error">Terjadi kesalahan fatal: ${err.message}</p>`;
    }
});
