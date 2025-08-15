
import { apiCall } from './api-helper.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elemen DOM
    const elements = {
        izinForm: document.getElementById('izinForm'),
        tanggalInput: document.getElementById('tanggal'),
        namaInput: document.getElementById('nama'),
        namaDropdown: document.getElementById('namaDropdown'),
        kelasInput: document.getElementById('kelas'),
        kelasBilqolamGroup: document.getElementById('kelasBilqolam').parentElement,
        kelasBilqolamInput: document.getElementById('kelasBilqolam'),
        alasanSelect: document.getElementById('alasan'),
        keteranganTextarea: document.getElementById('keterangan'),
        namaStatusEl: document.getElementById('namaStatus'),
        submitButton: document.getElementById('submitButton'),
        submitSpinner: document.getElementById('submitSpinner'),
        responseDiv: document.getElementById('response'),
        receiptModal: document.getElementById('receiptModal'),
        receiptContent: document.getElementById('receiptContent'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        holidayWarning: document.getElementById('holiday-warning'),
        appHeaderTitle: document.getElementById('app-header-title'),
        appHeaderSubtitle: document.getElementById('app-header-subtitle'),
    };

    // State
    let studentsList = [];
    let selectedStudent = null;
    window.holidays = window.holidays || {}; // Share holiday data
    let calendarDataCache = {}; // Cache for fetched calendar data by month/year


    async function loadGlobalHeaders() {
        try {
            const settings = await apiCall('getGlobalSettings', 'GET');
            if(settings.izin_form_title && elements.appHeaderTitle) {
                elements.appHeaderTitle.textContent = settings.izin_form_title;
            }
            if(settings.izin_form_subtitle && elements.appHeaderSubtitle) {
                elements.appHeaderSubtitle.textContent = settings.izin_form_subtitle;
            }
        } catch (error) {
            console.warn("Could not load global headers:", error.message);
        }
    }

    // --- Inisialisasi ---
    async function initializeForm() {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${('0' + (today.getMonth() + 1)).slice(-2)}-${('0' + today.getDate()).slice(-2)}`;
        elements.tanggalInput.value = todayString;
        
        await fetchAndCacheCalendarData(today.getFullYear(), today.getMonth());
        
        toggleBilqolamVisibility(todayString);
        checkAndDisableFormForHoliday(todayString);
        
        elements.namaStatusEl.innerHTML = '<span class="spinner"></span> Memuat...';
        await loadStudentData();
        await loadGlobalHeaders();
    }
    
    async function fetchAndCacheCalendarData(year, month) {
        const cacheKey = `${year}-${month}`;
        if (calendarDataCache[cacheKey]) {
            return; 
        }
        try {
            const data = await apiCall('getCalendarData', 'GET', { year, month: String(month + 1).padStart(2, '0') });
            window.holidays = { ...window.holidays, ...data.holidays };
    
            if (data.agendas) {
                data.agendas.forEach(agenda => {
                    if (agenda.is_holiday) {
                        const startDate = new Date(agenda.agenda_date + 'T00:00:00');
                        const endDate = agenda.end_date ? new Date(agenda.end_date + 'T00:00:00') : startDate;
                        let currentDate = new Date(startDate.getTime());
                        while(currentDate <= endDate) {
                            const dateStr = currentDate.toISOString().slice(0, 10);
                            if (!window.holidays[dateStr]) {
                                 window.holidays[dateStr] = { holiday_name: agenda.description };
                            }
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                });
            }
            calendarDataCache[cacheKey] = true; 
        } catch (error) {
            console.error('Gagal memuat data kalender untuk form:', error);
        }
    }

    async function loadStudentData() {
        try {
            const result = await apiCall('getAllStudents', 'GET');
             studentsList = result.map(student => ({
                id: student.ID_SISWA,
                nama: student.NAMA,
                kelas: student.ROMBEL,
                kelasBilqolam: student.KELAS_BILQOLAM,
                displayText: `${student.NAMA} (${student.ROMBEL})`,
            }));
            elements.namaStatusEl.innerHTML = '<span class="status-ready"><i class="fa fa-check-circle"></i> Data siswa siap</span>';
        } catch (error) {
            displayResponse(`Gagal memuat daftar siswa: ${error.message}`, true);
            elements.namaStatusEl.innerHTML = '<span class="status-error"><i class="fa fa-times-circle"></i> Gagal</span>';
        }
    }

    // --- Logika UI & Event Listener ---
    function toggleBilqolamVisibility(dateString) {
        if (!dateString) {
            elements.kelasBilqolamGroup.style.display = 'none';
            elements.kelasBilqolamInput.value = '';
            return;
        }
        const date = new Date(dateString + 'T00:00:00');
        const dayOfWeek = date.getDay(); // 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu
        const isBilqolamDay = [1, 2, 3].includes(dayOfWeek);

        elements.kelasBilqolamGroup.style.display = isBilqolamDay ? 'block' : 'none';
        if (!isBilqolamDay) {
            elements.kelasBilqolamInput.value = '';
        } else if (selectedStudent) {
            elements.kelasBilqolamInput.value = selectedStudent.kelasBilqolam || '';
        }
    }
    
    function checkAndDisableFormForHoliday(dateString) {
        const holiday = window.holidays[dateString];
        const isFormDisabled = !!holiday;

        elements.namaInput.disabled = isFormDisabled;
        elements.alasanSelect.disabled = isFormDisabled;
        elements.keteranganTextarea.disabled = isFormDisabled;
        
        elements.submitButton.disabled = isFormDisabled;
        
        if (isFormDisabled) {
            elements.holidayWarning.textContent = `Tanggal yang dipilih adalah hari libur: ${holiday.holiday_name}`;
            elements.holidayWarning.style.display = 'block';
        } else {
            elements.holidayWarning.style.display = 'none';
            if (selectedStudent) {
                elements.submitButton.disabled = false;
            }
        }
    }


    elements.tanggalInput.addEventListener('change', async (e) => {
        const newDate = e.target.value;
        const newDateObj = new Date(newDate + 'T00:00:00');
        await fetchAndCacheCalendarData(newDateObj.getFullYear(), newDateObj.getMonth());
        toggleBilqolamVisibility(newDate);
        checkAndDisableFormForHoliday(newDate);
    });

    elements.namaInput.addEventListener('input', function() {
        const filter = this.value.toLowerCase();
        elements.namaDropdown.innerHTML = '';
        selectedStudent = null; // Reset selection on new input
        elements.submitButton.disabled = true; // Disable button until a student is selected
        elements.kelasInput.value = '';
        elements.kelasBilqolamInput.value = '';

        if (filter.length > 1) {
            const filtered = studentsList
                .filter(s => s.displayText.toLowerCase().includes(filter))
                .slice(0, 10);
            
            filtered.forEach(student => {
                const li = document.createElement('li');
                li.textContent = student.displayText;
                li.addEventListener('click', () => selectStudent(student));
                elements.namaDropdown.appendChild(li);
            });
            elements.namaDropdown.style.display = filtered.length ? 'block' : 'none';
        } else {
            elements.namaDropdown.style.display = 'none';
        }
    });

    function selectStudent(student) {
        selectedStudent = student;
        elements.namaInput.value = student.nama;
        elements.kelasInput.value = student.kelas;
        elements.namaDropdown.style.display = 'none';
        toggleBilqolamVisibility(elements.tanggalInput.value);
        
        if (!elements.holidayWarning.style.display || elements.holidayWarning.style.display === 'none') {
            elements.submitButton.disabled = false;
        }
    }
    
    document.addEventListener('click', (e) => {
        if (!elements.namaInput.contains(e.target) && !elements.namaDropdown.contains(e.target)) {
            elements.namaDropdown.style.display = 'none';
        }
    });

    elements.izinForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!selectedStudent) {
            return displayResponse("Silakan pilih siswa dari daftar yang muncul.", true);
        }

        setLoadingState(true);

        const dataToSend = {
            id_siswa: selectedStudent.id,
            tanggal: elements.tanggalInput.value,
            alasan: document.getElementById('alasan').value,
            keterangan: document.getElementById('keterangan').value,
            kelasBilqolam: elements.kelasBilqolamInput.value,
        };
        
        try {
            const result = await apiCall('saveIzin', 'POST', dataToSend);
            displayResponse(result.message, false);
            showReceiptModal(dataToSend, selectedStudent);
            elements.izinForm.reset();
            resetFormState();
        } catch (error) {
            displayResponse(`Gagal mengirim formulir: ${error.message}`, true);
        } finally {
            setLoadingState(false);
        }
    });

    elements.closeModalBtn.addEventListener('click', () => {
        elements.receiptModal.classList.remove('active');
    });

    // --- Fungsi Helper ---
    function displayResponse(message, isError = false) {
        elements.responseDiv.textContent = message;
        elements.responseDiv.className = isError ? 'response-error' : 'response-success';
        elements.responseDiv.style.display = 'block';
        setTimeout(() => { elements.responseDiv.style.display = 'none'; }, 6000);
    }

    function setLoadingState(isLoading) {
        elements.submitButton.disabled = isLoading;
        elements.submitSpinner.style.display = isLoading ? 'inline-block' : 'none';
    }

    function resetFormState() {
        selectedStudent = null;
        const today = new Date();
        const todayString = `${today.getFullYear()}-${('0' + (today.getMonth() + 1)).slice(-2)}-${('0' + today.getDate()).slice(-2)}`;
        elements.tanggalInput.value = todayString;
        toggleBilqolamVisibility(todayString);
        checkAndDisableFormForHoliday(todayString);
        elements.namaDropdown.style.display = 'none';
        elements.submitButton.disabled = true; // Disable until a student is selected
    }

    function showReceiptModal(submittedData, studentData) {
        const date = new Date(submittedData.tanggal + 'T00:00:00');
        const formattedDate = date.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        const bilqolamHtml = elements.kelasBilqolamGroup.style.display === 'block' && submittedData.kelasBilqolam ? `
            <div class="modal-row">
                <div class="modal-label">Kelas Bilqolam:</div>
                <div class="modal-value">${submittedData.kelasBilqolam}</div>
            </div>` : '';
        
        let remarksHtml = '';
        if (submittedData.alasan === 'Sakit') {
            remarksHtml = '<hr style="border:0;height:1px;background:#2E7D32;margin:10px 0;"><div style="margin-bottom:10px;color:#2E7D32;font-weight:600;">Semoga ananda lekas diberikan kesembuhan yang sempurna oleh Allah SWT. sehingga bisa beraktivitas kembali,<br>اللَّهُمَّ اشْفِهِ(هَا) شِفَاءً لَا يُغَادِرُ سَقَمًا</div><hr style="border:0;height:1px;background:#2E7D32;margin:10px 0;">';
        } else if (submittedData.alasan === 'Izin') {
            remarksHtml = '<hr style="border:0;height:1px;background:#2E7D32;margin:10px 0;"><div style="margin-bottom:10px;color:#2E7D32;font-weight:600;">Semoga Allah melancarkan dan memberkahi segala urusan kita di dunia akhirat.. aamiin</div><hr style="border:0;height:1px;background:#2E7D32;margin:10px 0;">';
        }

        elements.receiptContent.innerHTML = `
            <div class="modal-row"><div class="modal-label">Tanggal Izin:</div><div class="modal-value">${formattedDate}</div></div>
            <div class="modal-row"><div class="modal-label">Nama Siswa:</div><div class="modal-value">${studentData.nama}</div></div>
            <div class="modal-row"><div class="modal-label">Kelas:</div><div class="modal-value">${studentData.kelas}</div></div>
            ${bilqolamHtml}
            <div class="modal-row"><div class="modal-label">Alasan:</div><div class="modal-value">${submittedData.alasan}</div></div>
            <div class="modal-row"><div class="modal-label">Keterangan:</div><div class="modal-value">${submittedData.keterangan || '-'}</div></div>
            <div style="text-align:center;width:100%;margin-top:20px;">
                ${remarksHtml}
                <div style="font-style:italic; font-size:0.9em; margin-top: 15px;">*lakukan screenshot sebagai bukti pengajuan izin</div>
            </div>
        `;

        elements.receiptModal.classList.add('active');
    }

    // Mulai aplikasi
    initializeForm();
});
