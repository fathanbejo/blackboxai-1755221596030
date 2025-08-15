
document.addEventListener('DOMContentLoaded', () => {
    const calendarApp = document.getElementById('calendar-app');
    if (!calendarApp) return;

    // --- CONTEXT DETECTION ---
    const isStandalonePage = !document.getElementById('izinForm');

    // DOM Elements
    const monthYearDisplay = document.getElementById('month-year-display');
    const calendarGrid = document.getElementById('calendar-days-grid');
    const eventsList = document.getElementById('calendar-events-list');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const prevYearBtn = document.getElementById('prev-year-btn');
    const nextYearBtn = document.getElementById('next-year-btn');
    const gotoTodayBtn = document.getElementById('goto-today-btn');
    
    // Standalone-only elements
    const weekdaysGrid = document.getElementById('calendar-weekdays-grid');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminPanel = document.getElementById('admin-panel');
    const agendaIdInput = document.getElementById('agenda-id');
    const agendaStartDateInput = document.getElementById('agenda-start-date');
    const agendaEndDateInput = document.getElementById('agenda-end-date');
    const agendaDescInput = document.getElementById('agenda-desc');
    const agendaIsHolidayCheckbox = document.getElementById('agenda-is-holiday');
    const saveAgendaBtn = document.getElementById('save-agenda-btn');
    const clearAgendaFormBtn = document.getElementById('clear-agenda-form-btn');
    const holidayDateInput = document.getElementById('holiday-date');
    const holidayNameInput = document.getElementById('holiday-name');
    const saveHolidayBtn = document.getElementById('save-holiday-btn');
    const clearHolidayFormBtn = document.getElementById('clear-holiday-form-btn');
    const importEventsFile = document.getElementById('import-events-file');
    const importEventsBtn = document.getElementById('import-events-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    const eventModal = document.getElementById('event-modal');
    const modalDateTitle = document.getElementById('modal-date-title');
    const modalEventList = document.getElementById('modal-event-list');
    const modalAttachmentList = document.getElementById('modal-attachment-list');
    const modalAdminActions = document.getElementById('modal-admin-actions');

    // State
    let currentDate = new Date();
    window.holidays = window.holidays || {};
    let customAgendas = [];
    let calendarDocuments = {};
    let isAdminLoggedIn = false;
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    // --- API Helper ---
    async function apiCall(action, method = 'GET', body = null) {
        const options = { method };
        let url = new URL('api.php', window.location.href);
        url.searchParams.set('action', action);
        
        if (method.toUpperCase() === 'GET') {
            const getParams = body || {};
            for (const key in getParams) {
                if (getParams[key]) url.searchParams.set(key, getParams[key]);
            }
        } else if (body instanceof FormData) {
            options.body = body;
        } else {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Unknown API error');
            return result.data;
        } catch (error) {
            console.error(`API call failed for action "${action}":`, error);
            throw error;
        }
    }

    // --- Data Fetching ---
    async function fetchCalendarData(year, month) {
        try {
            const data = await apiCall('getCalendarData', 'GET', { year, month: String(month + 1).padStart(2, '0') });
            window.holidays = { ...window.holidays, ...data.holidays };
            customAgendas = data.agendas || [];
            calendarDocuments = data.documents || {};

            if(!isStandalonePage) {
                const izinTanggalInput = document.getElementById('tanggal');
                if(izinTanggalInput && typeof checkAndDisableFormForHoliday === 'function') {
                    checkAndDisableFormForHoliday(izinTanggalInput.value);
                }
            }
        } catch (error) {
            console.error('Failed to fetch calendar data:', error);
            if (eventsList) eventsList.innerHTML = '<p style="color: red;">Gagal memuat data kalender.</p>';
        }
    }

    // --- Modal Logic ---
    function closeModal() {
        if (eventModal) eventModal.classList.remove('active');
    }

    async function handleModalAgendaSave(dateStr) {
        const description = document.getElementById('modal-agenda-desc').value.trim();
        const endDate = document.getElementById('modal-agenda-end-date').value;
        const isHoliday = document.getElementById('modal-agenda-is-holiday').checked;
        const saveBtn = document.getElementById('modal-save-agenda-btn');

        if (!description) return alert('Deskripsi agenda harus diisi.');
        if (endDate && endDate < dateStr) return alert('Tanggal Akhir tidak boleh sebelum Tanggal Mulai.');

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        
        try {
            const payload = { startDate: dateStr, endDate: endDate || null, description, isHoliday };
            await apiCall('addAgenda', 'POST', payload);
            await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            
            closeModal();
            const dayCell = document.querySelector(`.day-cell[data-date-str='${dateStr}']`);
            if (dayCell) dayCell.click();

        } catch (error) {
            alert(`Gagal menyimpan agenda: ${error.message}`);
        } finally {
            if(saveBtn) {
               saveBtn.disabled = false;
               saveBtn.textContent = 'Simpan Agenda';
            }
        }
    }
    
    async function handleModalDocUpload(dateStr) {
        const filesInput = document.getElementById('modal-doc-files');
        const uploadBtn = document.getElementById('modal-upload-btn');
        const files = filesInput.files;

        if (files.length === 0) return alert('Silakan pilih file untuk diunggah.');
    
        const formData = new FormData();
        formData.append('date', dateStr);
        for (const file of files) {
            formData.append('files[]', file);
        }
    
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';
    
        try {
            await apiCall('uploadDocument', 'POST', formData);
            await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            
            closeModal();
            const dayCell = document.querySelector(`.day-cell[data-date-str='${dateStr}']`);
            if (dayCell) dayCell.click();

        } catch (error) {
            alert('Gagal mengunggah dokumen: ' + error.message);
        } finally {
            if (uploadBtn) {
               uploadBtn.disabled = false;
               uploadBtn.textContent = 'Unggah ke Tanggal Ini';
            }
        }
    }

    function buildAdminModalForms(dateStr) {
        modalAdminActions.innerHTML = ''; // Start clean

        // --- Agenda Form ---
        const agendaSection = document.createElement('div');
        agendaSection.className = 'admin-actions-section';
        agendaSection.style.cssText = 'border-top: 1px solid #eee; margin-top: 15px; padding-top: 15px;';
        
        const agendaTitle = document.createElement('h5');
        agendaTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Agenda Baru';
        agendaSection.appendChild(agendaTitle);

        const descGroup = document.createElement('div');
        descGroup.className = 'form-group';
        const agendaDescInput = document.createElement('input');
        agendaDescInput.type = 'text';
        agendaDescInput.id = 'modal-agenda-desc';
        agendaDescInput.placeholder = 'Deskripsi agenda...';
        agendaDescInput.style.fontSize = '0.9em';
        descGroup.appendChild(agendaDescInput);
        agendaSection.appendChild(descGroup);

        const endDateGroup = document.createElement('div');
        endDateGroup.className = 'form-group';
        const endDateLabel = document.createElement('label');
        endDateLabel.htmlFor = 'modal-agenda-end-date';
        endDateLabel.textContent = 'Tanggal Akhir (Opsional):';
        endDateLabel.style.cssText = 'font-size:0.8em; margin-bottom:2px;';
        const agendaEndDateInput = document.createElement('input');
        agendaEndDateInput.type = 'date';
        agendaEndDateInput.id = 'modal-agenda-end-date';
        agendaEndDateInput.style.cssText = 'font-size: 0.9em; padding: 5px;';
        endDateGroup.append(endDateLabel, agendaEndDateInput);
        agendaSection.appendChild(endDateGroup);

        const holidayGroup = document.createElement('div');
        holidayGroup.className = 'form-group checkbox-group';
        holidayGroup.style.fontSize = '0.9em';
        const agendaIsHolidayCheckbox = document.createElement('input');
        agendaIsHolidayCheckbox.type = 'checkbox';
        agendaIsHolidayCheckbox.id = 'modal-agenda-is-holiday';
        const holidayLabel = document.createElement('label');
        holidayLabel.htmlFor = 'modal-agenda-is-holiday';
        holidayLabel.textContent = 'Jadikan hari libur';
        holidayGroup.append(agendaIsHolidayCheckbox, holidayLabel);
        agendaSection.appendChild(holidayGroup);

        const saveAgendaBtn = document.createElement('button');
        saveAgendaBtn.id = 'modal-save-agenda-btn';
        saveAgendaBtn.className = 'action-btn';
        saveAgendaBtn.style.cssText = 'width: 100%; font-size: 0.9em; padding: 8px;';
        saveAgendaBtn.textContent = 'Simpan Agenda';
        saveAgendaBtn.addEventListener('click', () => handleModalAgendaSave(dateStr)); 
        agendaSection.appendChild(saveAgendaBtn);
        
        // --- Upload Form ---
        const uploadSection = document.createElement('div');
        uploadSection.className = 'admin-upload-section';
        uploadSection.style.cssText = 'border-top: 1px solid #eee; margin-top: 15px; padding-top: 15px;';

        const uploadTitle = document.createElement('h5');
        uploadTitle.innerHTML = '<i class="fas fa-upload"></i> Unggah Dokumen Baru';
        uploadSection.appendChild(uploadTitle);

        const fileGroup = document.createElement('div');
        fileGroup.className = 'form-group';
        const docFilesInput = document.createElement('input');
        docFilesInput.type = 'file';
        docFilesInput.id = 'modal-doc-files';
        docFilesInput.multiple = true;
        docFilesInput.style.fontSize = '0.9em';
        fileGroup.appendChild(docFilesInput);
        uploadSection.appendChild(fileGroup);

        const uploadBtn = document.createElement('button');
        uploadBtn.id = 'modal-upload-btn';
        uploadBtn.className = 'action-btn';
        uploadBtn.style.cssText = 'width: 100%; margin-top: 5px; font-size: 0.9em; padding: 8px;';
        uploadBtn.textContent = 'Unggah ke Tanggal Ini';
        uploadBtn.addEventListener('click', () => handleModalDocUpload(dateStr));
        uploadSection.appendChild(uploadBtn);

        // Append both sections to the modal
        modalAdminActions.append(agendaSection, uploadSection);
    }
    
    function showEventsModal(dateStr, day, allMonthEvents) {
        if (!isStandalonePage) return;
        
        const dateObj = new Date(dateStr + 'T00:00:00');
        modalDateTitle.textContent = dateObj.toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        modalEventList.innerHTML = '';
        modalAttachmentList.innerHTML = '';
        modalAdminActions.innerHTML = '';

        const uniqueEventsMap = new Map();
        
        const eventsForDay = allMonthEvents.filter(e => {
            const currentDateForLoop = new Date(dateStr + 'T00:00:00');
            const startDate = new Date(e.dateStr + 'T00:00:00');
            if(e.type === 'agenda' && e.endDate) {
                 const endDate = new Date(e.endDate + 'T00:00:00');
                 return currentDateForLoop >= startDate && currentDateForLoop <= endDate;
            }
            return e.date === day;
        });

        eventsForDay.forEach(event => {
            const key = event.type === 'agenda' ? `agenda-${event.id}` : `holiday-${event.desc}`;
            if (!uniqueEventsMap.has(key)) {
                uniqueEventsMap.set(key, event);
            }
        });

        if (uniqueEventsMap.size > 0) {
            uniqueEventsMap.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'event-item ' + event.type;
                if(event.isHoliday) eventEl.classList.add('holiday');
                
                const icon = event.type === 'holiday' ? 'fa-flag' : 'fa-star';
                
                let desc = event.desc;
                if(event.type === 'agenda' && event.endDate && event.endDate !== event.dateStr) {
                    const start = new Date(event.dateStr + 'T00:00:00').getDate();
                    const end = new Date(event.endDate + 'T00:00:00').getDate();
                    desc = `(${start}-${end} ${monthNames[dateObj.getMonth()].substring(0,3)}) ${event.desc}`;
                }

                eventEl.innerHTML = `<i class="fas ${icon}"></i> <span>${desc}</span>`;
                modalEventList.appendChild(eventEl);
            });
        } else {
            modalEventList.innerHTML = '<p>Tidak ada acara pada tanggal ini.</p>';
        }

        const documentsForDay = calendarDocuments[dateStr] || [];
        if (documentsForDay.length > 0) {
            let attachmentsHtml = '<h5><i class="fas fa-paperclip"></i> Dokumen Terlampir</h5>';
            documentsForDay.forEach(doc => {
                attachmentsHtml += `
                    <div class="attachment-item">
                        <a href="${doc.path}" target="_blank">${doc.name}</a>
                        ${isAdminLoggedIn ? `<button class="action-btn-icon delete-btn" title="Hapus dokumen" onclick="deleteDocument(${doc.id}, '${dateStr}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>`;
            });
            modalAttachmentList.innerHTML = attachmentsHtml;
        }

        if (isAdminLoggedIn) {
            buildAdminModalForms(dateStr);
        }

        eventModal.classList.add('active');
    }

    // --- Admin & Import Logic (only for standalone page) ---
    if (isStandalonePage) {
        function clearAgendaForm() {
            agendaIdInput.value = '';
            agendaStartDateInput.value = '';
            agendaEndDateInput.value = '';
            agendaDescInput.value = '';
            agendaIsHolidayCheckbox.checked = false;
        }

        async function saveAgenda() {
            const id = agendaIdInput.value;
            const startDate = agendaStartDateInput.value;
            const endDate = agendaEndDateInput.value;
            const description = agendaDescInput.value.trim();
            const isHoliday = agendaIsHolidayCheckbox.checked;

            if (!startDate || !description) return alert('Tanggal Mulai dan deskripsi agenda harus diisi.');
            if (endDate && endDate < startDate) return alert('Tanggal Akhir tidak boleh sebelum Tanggal Mulai.');

            saveAgendaBtn.disabled = true;
            try {
                const payload = { startDate, endDate: endDate || null, description, isHoliday };
                if (id) {
                    payload.id = id;
                    await apiCall('updateAgenda', 'POST', payload);
                } else {
                    await apiCall('addAgenda', 'POST', payload);
                }
                clearAgendaForm();
                await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            } catch (error) {
                alert(`Gagal menyimpan agenda: ${error.message}`);
            } finally {
                saveAgendaBtn.disabled = false;
            }
        }

        function editAgenda(id, startDate, endDate, description, isHoliday) {
            agendaIdInput.value = id;
            agendaStartDateInput.value = startDate;
            agendaEndDateInput.value = endDate || '';
            agendaDescInput.value = description;
            agendaIsHolidayCheckbox.checked = !!isHoliday;
            agendaDescInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            agendaDescInput.focus();
        }

        async function deleteAgenda(id) {
            if (!confirm('Anda yakin ingin menghapus agenda ini?')) return;
            try {
                await apiCall('deleteAgenda', 'POST', { id });
                await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            } catch (error) {
                alert('Gagal menghapus agenda: ' + error.message);
            }
        }
        
        function clearHolidayForm() {
            holidayDateInput.value = '';
            holidayNameInput.value = '';
        }
        
        async function saveHoliday() {
            const date = holidayDateInput.value;
            const name = holidayNameInput.value.trim();
            if (!date || !name) return alert('Tanggal dan keterangan libur harus diisi.');

            saveHolidayBtn.disabled = true;
            try {
                await apiCall('saveHoliday', 'POST', { date, name });
                clearHolidayForm();
                await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            } catch (error) {
                alert('Gagal menyimpan hari libur: ' + error.message);
            } finally {
                saveHolidayBtn.disabled = false;
            }
        }

        async function deleteHoliday(date) {
             if (!confirm(`Anda yakin ingin menghapus hari libur pada tanggal ${date}?`)) return;
            try {
                await apiCall('deleteHoliday', 'POST', { date });
                await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            } catch (error) {
                alert('Gagal menghapus hari libur: ' + error.message);
            }
        }

        async function deleteDocument(docId, dateStr) {
            if (!confirm(`Anda yakin ingin menghapus dokumen ini secara permanen?`)) return;
            try {
                await apiCall('deleteDocument', 'POST', { id: docId });
                await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
                
                closeModal();
                const dayCell = document.querySelector(`.day-cell[data-date-str='${dateStr}']`);
                if (dayCell) dayCell.click();

            } catch (error) {
                alert('Gagal menghapus dokumen: ' + error.message);
            }
        }

        function editHoliday(date, name) {
            holidayDateInput.value = date;
            holidayNameInput.value = name;
            holidayNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            holidayNameInput.focus();
        }

        function handleDownloadTemplate() {
            const templateData = [
                { tanggal_mulai: '2025-12-25', tanggal_akhir: '', deskripsi: 'Libur Nasional Natal', apakah_libur: 'YA' },
                { tanggal_mulai: '2025-06-10', tanggal_akhir: '2025-06-15', deskripsi: 'Penilaian Akhir Semester', apakah_libur: 'TIDAK' }
            ];
            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Agenda & Libur");
            XLSX.writeFile(workbook, "template_agenda_libur.xlsx");
        }
        
        async function handleImportEvents() {
            const file = importEventsFile.files[0];
            if (!file) return alert('Silakan pilih file Excel terlebih dahulu.');

            importEventsBtn.disabled = true;
            importEventsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengimpor...';
            
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const sheetName = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheetName, { defval: "" });

                if (jsonData.length === 0) throw new Error("File Excel kosong.");

                const eventsToImport = jsonData.map(row => {
                    if (!row.tanggal_mulai || !row.deskripsi) return null;
                    
                    const convertDate = (excelDate) => {
                        if (!excelDate) return null;
                        let date;
                        if (typeof excelDate === 'number') {
                            const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
                            const tzOffset = jsDate.getTimezoneOffset() * 60000;
                            date = new Date(jsDate.getTime() + tzOffset);
                        } else if (typeof excelDate === 'string') {
                            const isoMatch = excelDate.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
                            if (isoMatch) {
                                date = new Date(isoMatch[1], isoMatch[2] - 1, isoMatch[3]);
                            } else {
                                date = new Date(excelDate);
                            }
                        } else {
                            return null;
                        }

                        if (!date || isNaN(date.getTime())) return null;

                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    };

                    const startDate = convertDate(row.tanggal_mulai);
                    if (!startDate) return null;

                    return { 
                        agenda_date: startDate,
                        end_date: convertDate(row.tanggal_akhir) || null,
                        description: row.deskripsi,
                        is_holiday: String(row.apakah_libur).trim().toUpperCase() === 'YA' ? 1 : 0
                    };
                }).filter(Boolean);

                if (eventsToImport.length === 0) throw new Error("Tidak ada data valid untuk diimpor.");

                await apiCall('importEvents', 'POST', eventsToImport);
                alert(`${eventsToImport.length} acara/agenda berhasil diimpor!`);
                await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());

            } catch (error) {
                alert('Gagal mengimpor file: ' + error.message);
            } finally {
                importEventsFile.value = '';
                importEventsBtn.disabled = false;
                importEventsBtn.innerHTML = 'Impor';
            }
        }

        function handleAdminLogin() {
            const password = prompt('Masukkan password admin:');
            if (password === 'bismillah') {
                isAdminLoggedIn = true;
                adminLoginBtn.style.display = 'none';
                adminPanel.style.display = 'grid';
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            } else if (password) {
                alert('Password salah.');
            }
        }
        
        // Attach Admin Event Listeners
        adminLoginBtn.addEventListener('click', handleAdminLogin);
        saveAgendaBtn.addEventListener('click', saveAgenda);
        clearAgendaFormBtn.addEventListener('click', clearAgendaForm);
        saveHolidayBtn.addEventListener('click', saveHoliday);
        clearHolidayFormBtn.addEventListener('click', clearHolidayForm);
        importEventsBtn.addEventListener('click', handleImportEvents);
        downloadTemplateBtn.addEventListener('click', handleDownloadTemplate);
        
        // Attach Modal Listeners
        document.body.addEventListener('click', (e) => {
            if (eventModal && eventModal.classList.contains('active')) {
                if (e.target === eventModal || e.target.closest('#modal-close-btn')) {
                    closeModal();
                }
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && eventModal && eventModal.classList.contains('active')) {
                closeModal();
            }
        });
        
        // Expose functions to be callable from dynamically created elements
        window.editAgenda = editAgenda;
        window.deleteAgenda = deleteAgenda;
        window.editHoliday = editHoliday;
        window.deleteHoliday = deleteHoliday;
        window.deleteDocument = deleteDocument;
    }


    // --- Calendar Rendering ---
    async function renderCalendar(year, month) {
        await fetchCalendarData(year, month);
        
        monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
        calendarGrid.innerHTML = '';
        if (eventsList) eventsList.innerHTML = '';

        if(isStandalonePage && weekdaysGrid) {
            weekdaysGrid.innerHTML = '';
             ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach((day, index) => {
                const dayNameEl = document.createElement('div');
                dayNameEl.textContent = day;
                dayNameEl.classList.add('day-name');
                if (index === 0) dayNameEl.classList.add('sunday');
                weekdaysGrid.appendChild(dayNameEl);
            });
        } else if(!isStandalonePage) {
            ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach((day, index) => {
                const dayNameEl = document.createElement('div');
                dayNameEl.textContent = day;
                dayNameEl.classList.add('day-name');
                if (index === 0) dayNameEl.classList.add('sunday');
                calendarGrid.appendChild(dayNameEl);
            });
        }

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const monthEvents = [];

        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('day-cell', 'not-current-month');
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.classList.add('day-cell');
            cell.innerHTML = `<span class="day-number">${day}</span>`;
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            cell.dataset.dateStr = dateStr; 
            let hasHoliday = false, hasAgenda = false, hasDocument = false;
            
            if (new Date(Date.UTC(year, month, day)).getUTCDay() === 0) cell.classList.add('sunday');
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) cell.classList.add('today');
            
            const holidayData = window.holidays[dateStr];
            if (holidayData) {
                cell.classList.add('holiday');
                hasHoliday = true;
                monthEvents.push({ type: 'holiday', date: day, desc: holidayData.holiday_name, source: holidayData.source, dateStr: dateStr });
            }

            const currentDateForLoop = new Date(dateStr + 'T00:00:00');
            const dayAgendas = customAgendas.filter(agenda => {
                const startDate = new Date(agenda.agenda_date + 'T00:00:00');
                const endDate = agenda.end_date ? new Date(agenda.end_date + 'T00:00:00') : startDate;
                return currentDateForLoop >= startDate && currentDateForLoop <= endDate;
            });
            
            if (dayAgendas.length > 0) {
                cell.classList.add('agenda');
                hasAgenda = true;
                dayAgendas.forEach(agenda => {
                    monthEvents.push({ type: 'agenda', date: day, desc: agenda.description, id: agenda.id, dateStr: agenda.agenda_date, endDate: agenda.end_date, isHoliday: agenda.is_holiday });
                    if (agenda.is_holiday) {
                        cell.classList.add('holiday');
                        hasHoliday = true;
                    }
                });
            }

            if (calendarDocuments[dateStr] && calendarDocuments[dateStr].length > 0) {
                hasDocument = true;
                cell.innerHTML += '<i class="fas fa-paperclip" style="position:absolute; bottom:2px; right:4px; font-size:0.7em; color:#6c757d;"></i>';
            }
            
            if (isStandalonePage && (hasHoliday || hasAgenda || hasDocument || isAdminLoggedIn)) {
                cell.classList.add('interactive');
                cell.setAttribute('title', 'Klik untuk lihat detail');
                cell.addEventListener('click', () => showEventsModal(dateStr, day, monthEvents));
            }
            calendarGrid.appendChild(cell);
        }
        
        if (eventsList) {
             renderEventsList(monthEvents);
        }
    }
    
    function renderEventsList(events) {
        if (!eventsList) return;
        eventsList.innerHTML = '';

        if (events.length === 0) {
            if(isStandalonePage) {
                eventsList.innerHTML = '<p style="text-align: center; color: #999; font-style: italic;">Tidak ada agenda atau hari libur di bulan ini.</p>';
            }
            return;
        }

        events.sort((a, b) => a.date - b.date);
        const uniqueEvents = [...new Map(events.map(item => [`${item.dateStr}-${item.desc}`, item])).values()];

        uniqueEvents.forEach(event => {
            const eventEl = document.createElement('div');
            eventEl.classList.add('event-item');
            
            if ((event.type === 'agenda' && event.isHoliday) || event.type === 'holiday') {
                eventEl.classList.add('holiday');
            } else if (event.type === 'agenda') {
                eventEl.classList.add('agenda');
            }

            const startDateObj = new Date(event.dateStr + 'T00:00:00');
            let eventDateFormatted = `${startDateObj.getDate()} ${monthNames[startDateObj.getMonth()].substring(0,3)}`;
            
            if(event.type === 'agenda' && event.endDate && event.endDate !== event.dateStr) {
                 const endDateObj = new Date(event.endDate + 'T00:00:00');
                 eventDateFormatted += ` - ${endDateObj.getDate()} ${monthNames[endDateObj.getMonth()].substring(0,3)}`;
            }
            
            let actionsHtml = '';
            if (isStandalonePage && isAdminLoggedIn) {
                 if (event.type === 'agenda') {
                    const safeDesc = event.desc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    actionsHtml = `<div class="event-actions">
                        <button class="action-btn-icon edit-btn" title="Edit agenda" onclick="editAgenda(${event.id}, '${event.dateStr}', '${event.endDate || ''}', '${safeDesc}', ${event.isHoliday})"><i class="fas fa-pencil-alt"></i></button>
                        <button class="action-btn-icon delete-btn" title="Hapus agenda" onclick="deleteAgenda(${event.id})"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
                } else if (event.type === 'holiday' && event.source !== 'API') {
                    const safeDesc = event.desc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    actionsHtml = `<div class="event-actions">
                         <button class="action-btn-icon edit-btn" title="Edit libur" onclick="editHoliday('${event.dateStr}', '${safeDesc}')"><i class="fas fa-pencil-alt"></i></button>
                         <button class="action-btn-icon delete-btn" title="Hapus libur" onclick="deleteHoliday('${event.dateStr}')"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
                }
            }
            
            eventEl.innerHTML = `
                <div class="event-date">${eventDateFormatted}</div>
                <div class="event-desc">${event.desc} ${event.isHoliday ? '<i class="fas fa-flag" style="color:var(--holiday-text); margin-left: 5px;" title="Hari libur"></i>' : ''}</div>
                ${actionsHtml}
            `;
            eventsList.appendChild(eventEl);
        });
    }

    // --- Initializer & Event Listeners ---
    async function initializeCalendar() {
        await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());

        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        });

        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        });
        
        gotoTodayBtn.addEventListener('click', () => {
            currentDate = new Date();
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        });

        if (isStandalonePage) {
            prevYearBtn.addEventListener('click', () => {
                currentDate.setFullYear(currentDate.getFullYear() - 1);
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            });
            nextYearBtn.addEventListener('click', () => {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            });
        }
    }

    initializeCalendar();
});
