
import { apiCall } from './api-helper.js';
import { drawPdfHeader, processImageForPdf } from './pdf-helper.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const academicYearTitle = document.getElementById('academic-year-title');
    const eventsTbody = document.getElementById('events-tbody');
    const loader = document.getElementById('loader');
    const addEventBtn = document.getElementById('add-event-btn');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminActionsHeader = document.getElementById('admin-actions-header');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    
    // Filter & Pagination Elements
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const searchFilter = document.getElementById('search-filter');
    const paginationInfo = document.getElementById('pagination-info');
    const rowsPerPageSelect = document.getElementById('rows-per-page');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    // Detail Modal Elements
    const detailModal = document.getElementById('event-detail-modal');
    const modalDetailTitle = document.getElementById('modal-detail-title');
    const modalDetailDate = document.getElementById('modal-detail-date');
    const modalDetailDescription = document.getElementById('modal-detail-description');
    const modalAttachmentList = document.getElementById('modal-attachment-list');
    const closeDetailModalBtn = document.getElementById('close-detail-modal-btn');

    // Form Modal Elements
    const eventFormModal = document.getElementById('event-form-modal');
    const modalFormTitle = document.getElementById('modal-form-title');
    const eventIdInput = document.getElementById('event-id');
    const eventStartDateInput = document.getElementById('event-start-date');
    const eventEndDateInput = document.getElementById('event-end-date');
    const eventDescriptionInput = document.getElementById('event-description');
    const eventIsHolidayCheckbox = document.getElementById('event-is-holiday');
    const saveEventBtn = document.getElementById('save-event-btn');
    const cancelEventBtn = document.getElementById('cancel-event-btn');

    // State
    let isAdminLoggedIn = false;
    let allEvents = [];
    let filteredEvents = [];
    let allDocuments = {};
    let currentPage = 1;
    let rowsPerPage = 10;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    // --- Core Logic ---
    async function initializePage() {
        const { start, end, title } = getAcademicYearRange();
        academicYearTitle.textContent = title;
        startDateFilter.value = start;
        endDateFilter.value = end;
        await loadAndRenderEvents();
    }

    function getAcademicYearRange() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const startYear = currentMonth < 6 ? currentYear - 1 : currentYear;
        const endYear = startYear + 1;
        return {
            start: `${startYear}-07-01`,
            end: `${endYear}-06-30`,
            title: `Tahun Ajaran ${startYear}/${endYear}`
        };
    }

    async function loadAndRenderEvents() {
        loader.style.display = 'block';
        eventsTbody.innerHTML = '';
        try {
            const startDate = startDateFilter.value;
            const endDate = endDateFilter.value;
            if (!startDate || !endDate) return;

            const data = await apiCall('getAcademicYearEvents', 'GET', { start: startDate, end: endDate });
            allDocuments = data.documents || {};
            allEvents = processEvents(data);
            applyFiltersAndRender();
        } catch (error) {
            eventsTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Gagal memuat data.</td></tr>`;
        } finally {
            loader.style.display = 'none';
        }
    }
    
    function processEvents({ agendas, holidays }) {
        const combinedEvents = [];
        agendas.forEach(agenda => {
            combinedEvents.push({
                id: agenda.id, startDate: agenda.agenda_date, endDate: agenda.end_date,
                description: agenda.description, isHoliday: agenda.is_holiday, type: 'agenda'
            });
        });
        holidays.forEach(holiday => {
            combinedEvents.push({
                startDate: holiday.holiday_date, endDate: null, description: holiday.holiday_name,
                isHoliday: true, type: 'holiday'
            });
        });
        return combinedEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }
    
    function applyFiltersAndRender() {
        const searchTerm = searchFilter.value.toLowerCase();
        
        filteredEvents = allEvents.filter(event => {
            const matchesSearch = searchTerm ? event.description.toLowerCase().includes(searchTerm) : true;
            return matchesSearch;
        });
        
        currentPage = 1;
        renderTable();
    }

    function renderTable() {
        eventsTbody.innerHTML = '';
        if (filteredEvents.length === 0) {
            eventsTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada agenda ditemukan.</td></tr>`;
            updatePagination();
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pageData = rowsPerPage === -1 
            ? filteredEvents 
            : filteredEvents.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

        pageData.forEach(event => {
            const tr = document.createElement('tr');
            tr.classList.add('interactive-row');
            tr.addEventListener('click', () => openDetailModal(event));
            
            const startDate = new Date(event.startDate + 'T00:00:00');
            const isPast = event.endDate ? new Date(event.endDate + 'T00:00:00') < today : startDate < today;
            if (isPast) tr.classList.add('past-event');

            const dateCell = tr.insertCell();
            dateCell.className = 'event-date';
            dateCell.textContent = formatDateRange(event.startDate, event.endDate);

            const descCell = tr.insertCell();
            let descHtml = event.description;
            if (allDocuments[event.startDate] && allDocuments[event.startDate].length > 0) {
                 descHtml = `<i class="fas fa-paperclip" title="Ada lampiran" style="margin-right: 8px; color: var(--secondary-text);"></i> ${descHtml}`;
            }
            if (event.isHoliday) {
                // The flag icon was removed as per the request to color the text red instead.
            }
            descCell.innerHTML = descHtml;

            const countdownCell = tr.insertCell();
            const { text, className } = calculateCountdown(event.startDate);
            countdownCell.textContent = text;
            countdownCell.className = `countdown-cell ${className}`;

            if (event.isHoliday) {
                dateCell.style.color = 'var(--holiday-text, #dc3545)';
                descCell.style.color = 'var(--holiday-text, #dc3545)';
            }
            
            if (isAdminLoggedIn) {
                const actionCell = tr.insertCell();
                actionCell.className = 'admin-actions';
                actionCell.addEventListener('click', e => e.stopPropagation()); // Prevent modal from opening
                if (event.type === 'agenda') {
                    const editBtn = document.createElement('button');
                    editBtn.className = 'edit-btn';
                    editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
                    editBtn.title = 'Edit Agenda';
                    editBtn.onclick = () => openEditModal(event);
                    actionCell.appendChild(editBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    deleteBtn.title = 'Hapus Agenda';
                    deleteBtn.onclick = () => handleDeleteEvent(event.id);
                    actionCell.appendChild(deleteBtn);
                }
            }
            eventsTbody.appendChild(tr);
        });
        updatePagination();
    }
    
    function updatePagination() {
        const totalItems = filteredEvents.length;
        const totalPages = rowsPerPage > 0 ? Math.ceil(totalItems / rowsPerPage) : 1;
        
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;

        if(totalItems === 0){
            paginationInfo.textContent = '0 hasil';
        } else if (rowsPerPage === -1) {
            paginationInfo.textContent = `Menampilkan semua ${totalItems} hasil`;
        } else {
             const startItem = (currentPage - 1) * rowsPerPage + 1;
             const endItem = Math.min(currentPage * rowsPerPage, totalItems);
             paginationInfo.textContent = `Menampilkan ${startItem}-${endItem} dari ${totalItems} hasil`;
        }
    }

    function formatDateRange(start, end) {
        const startDate = new Date(start + 'T00:00:00');
        const startDay = startDate.getDate();
        const startMonth = monthNames[startDate.getMonth()];
        if (!end || start === end) return `${startDay} ${startMonth}`;
        const endDate = new Date(end + 'T00:00:00');
        const endDay = endDate.getDate();
        const endMonth = monthNames[endDate.getMonth()];
        return startMonth === endMonth ? `${startDay} - ${endDay} ${startMonth}` : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    }

    function calculateCountdown(startDateStr) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const eventDate = new Date(startDateStr + 'T00:00:00');
        const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { text: `${-diffDays} hari lalu`, className: 'past' };
        if (diffDays === 0) return { text: 'Hari ini', className: 'today' };
        if (diffDays === 1) return { text: 'Besok', className: 'upcoming' };
        return { text: `${diffDays} hari lagi`, className: 'upcoming' };
    }

    // --- Modal Logic ---
    function openDetailModal(event) {
        modalDetailTitle.textContent = event.description;
        modalDetailDate.textContent = formatDateRange(event.startDate, event.endDate);
        modalDetailDescription.textContent = event.isHoliday ? 'Acara ini ditandai sebagai hari libur.' : 'Acara Madrasah.';
        
        modalAttachmentList.innerHTML = '';
        const documents = allDocuments[event.startDate] || [];
        if (documents.length > 0) {
            let attachmentsHtml = '<h5><i class="fas fa-paperclip"></i> Dokumen Terlampir</h5>';
            documents.forEach(doc => {
                attachmentsHtml += `<a href="${doc.path}" target="_blank">${doc.name}</a>`;
            });
            modalAttachmentList.innerHTML = attachmentsHtml;
        }
        detailModal.classList.add('active');
    }

    function setupAdmin(isAdmin) {
        isAdminLoggedIn = isAdmin;
        adminLoginBtn.style.display = isAdmin ? 'none' : 'inline-flex';
        addEventBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        adminActionsHeader.style.display = isAdmin ? '' : 'none';
        // Re-render table to show/hide the actions column
        renderTable(); 
    }

    function openAddModal() {
        eventFormModal.classList.add('active');
        modalFormTitle.textContent = 'Tambah Agenda Baru';
        eventIdInput.value = '';
        eventStartDateInput.value = '';
        eventEndDateInput.value = '';
        eventDescriptionInput.value = '';
        eventIsHolidayCheckbox.checked = false;
    }
    
    function openEditModal(event) {
        eventFormModal.classList.add('active');
        modalFormTitle.textContent = 'Edit Agenda';
        eventIdInput.value = event.id;
        eventStartDateInput.value = event.startDate;
        eventEndDateInput.value = event.endDate || '';
        eventDescriptionInput.value = event.description;
        eventIsHolidayCheckbox.checked = event.isHoliday;
    }

    async function handleSaveEvent() {
        const payload = {
            id: eventIdInput.value || null, startDate: eventStartDateInput.value,
            endDate: eventEndDateInput.value || null, description: eventDescriptionInput.value.trim(),
            isHoliday: eventIsHolidayCheckbox.checked
        };
        if (!payload.startDate || !payload.description) return alert('Tanggal Mulai dan Deskripsi wajib diisi.');
        saveEventBtn.disabled = true;
        try {
            const action = payload.id ? 'updateAgenda' : 'addAgenda';
            await apiCall(action, 'POST', payload);
            eventFormModal.classList.remove('active');
            await loadAndRenderEvents();
        } finally {
            saveEventBtn.disabled = false;
        }
    }
    
    async function handleDeleteEvent(eventId) {
        if (confirm('Anda yakin ingin menghapus agenda ini?')) {
            await apiCall('deleteAgenda', 'POST', { id: eventId });
            await loadAndRenderEvents();
        }
    }
    
    // --- PDF Generation ---
    async function generatePDF() {
        if (filteredEvents.length === 0) return alert("Tidak ada data untuk diekspor.");
        exportPdfBtn.disabled = true;
        exportPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 30;

            const globalSettings = await apiCall('getGlobalSettings', 'GET');
            let currentY = await drawPdfHeader(doc, globalSettings);
            currentY += 25;
            
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
            doc.text('KALENDER PENDIDIKAN DAN AGENDA MADRASAH', pageWidth / 2, currentY, { align: 'center' });
            currentY += 15;
            doc.setFontSize(11); doc.setFont('helvetica', 'normal');
            doc.text(academicYearTitle.textContent.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

            // --- TABLE ---
            const tableBody = filteredEvents.map((event, index) => {
                let descriptionText = event.description;
                if (allDocuments[event.startDate] && allDocuments[event.startDate].length > 0) {
                    descriptionText = `(Lampiran) ${descriptionText}`;
                }
                return [
                    index + 1,
                    formatDateRange(event.startDate, event.endDate),
                    descriptionText,
                ];
            });

            doc.autoTable({
                head: [['No.', 'Tanggal', 'Agenda Kegiatan']],
                body: tableBody,
                startY: currentY + 15, 
                theme: 'grid',
                headStyles: { 
                    fillColor: [46, 125, 50],
                    halign: 'center'
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 30 }
                },
                didParseCell: function (data) {
                    if (data.section === 'body') {
                        const event = filteredEvents[data.row.index];
                        if (event && event.isHoliday) {
                            data.cell.styles.textColor = '#dc3545';
                        }
                    }
                },
                didDrawCell: function (data) {
                    if (data.section === 'body' && data.column.index === 2) {
                        const event = filteredEvents[data.row.index];
                        if (allDocuments[event.startDate] && allDocuments[event.startDate].length > 0) {
                            doc.setFontSize(8);
                            doc.text("📎", data.cell.x + 2, data.cell.y + data.cell.height / 2 + 3);
                            data.cell.textPos.x += 10;
                        }
                    }
                }
            });
            
            // --- FOOTER ---
            let finalY = doc.lastAutoTable.finalY + 40;
            if (finalY > doc.internal.pageSize.getHeight() - 120) {
                doc.addPage();
                finalY = margin; // Reset Y on new page
            }
            
            doc.setPage(doc.internal.getNumberOfPages());
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            const today = new Date();
            const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const rightAlignX = pageWidth - margin;
            
            doc.text(`Singosari, ${dateStr}`, rightAlignX, finalY, { align: 'right' });
            doc.text('Mengetahui,', rightAlignX, finalY + 15, { align: 'right' });
            doc.text('Kepala Madrasah', rightAlignX, finalY + 30, { align: 'right' });
            finalY += 90;
            doc.setLineWidth(0.5);
            doc.line(rightAlignX, finalY, rightAlignX - 150, finalY);
            doc.setFont('helvetica', 'bold');
            doc.text('Muhammad Ishom, S.Pd.', rightAlignX, finalY + 12, { align: 'right' });
            
            doc.save(`Kaldik_${academicYearTitle.textContent.replace('/','-')}.pdf`);
        } catch (error) {
            alert(`Gagal membuat PDF: ${error.message}`);
        } finally {
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
        }
    }

    // --- Event Listeners ---
    adminLoginBtn.addEventListener('click', () => {
        const password = prompt('Masukkan password admin:');
        if (password === 'bismillah') {
            setupAdmin(true);
            alert('Login berhasil. Fitur admin diaktifkan.');
        } else if (password) {
            alert('Password salah.');
        }
    });

    [startDateFilter, endDateFilter].forEach(el => el.addEventListener('change', loadAndRenderEvents));
    searchFilter.addEventListener('input', () => {
        // Debounce search
        setTimeout(applyFiltersAndRender, 300);
    });
    
    rowsPerPageSelect.addEventListener('change', () => {
        rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
        currentPage = 1;
        renderTable();
    });
    prevPageBtn.addEventListener('click', () => { if(currentPage > 1) { currentPage--; renderTable(); } });
    nextPageBtn.addEventListener('click', () => {
        const totalPages = rowsPerPage > 0 ? Math.ceil(filteredEvents.length / rowsPerPage) : 1;
        if(currentPage < totalPages) { currentPage++; renderTable(); }
    });
    
    addEventBtn.addEventListener('click', openAddModal);
    cancelEventBtn.addEventListener('click', () => eventFormModal.classList.remove('active'));
    saveEventBtn.addEventListener('click', handleSaveEvent);
    closeDetailModalBtn.addEventListener('click', () => detailModal.classList.remove('active'));
    exportPdfBtn.addEventListener('click', generatePDF);

    // Initialize
    initializePage();
});
