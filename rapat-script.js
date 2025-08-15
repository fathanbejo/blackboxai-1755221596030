
import { apiCall } from './api-helper.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const meetingSelect = document.getElementById('active-meeting-select');
    const createMeetingBtn = document.getElementById('create-meeting-btn');
    const attendanceForm = document.getElementById('attendance-form');
    const attendanceFormTitle = document.getElementById('attendance-form-title');
    const guruInput = document.getElementById('guru-input');
    const guruSuggestions = document.getElementById('guru-suggestions');
    const manualNameToggle = document.getElementById('manual-name-toggle');
    const manualNameGroup = document.getElementById('manual-name-group');
    const manualNameInput = document.getElementById('manual-name-input');
    const guruSelectGroup = document.getElementById('guru-select-group');
    const submitAttendanceBtn = document.getElementById('submit-attendance-btn');
    const attendeeListCard = document.getElementById('attendee-list-card');
    const attendeeListTitle = document.getElementById('attendee-list-title');
    const attendeeList = document.getElementById('attendee-list');
    const appHeaderTitle = document.getElementById('app-header-title');
    
    // Signature Modal Elements
    const openSignatureModalBtn = document.getElementById('open-signature-modal-btn');
    const signaturePreview = document.getElementById('signature-preview');
    const modalOverlay = document.getElementById('signature-modal-overlay');
    const modalCanvas = document.getElementById('signature-modal-canvas');
    const modalCtx = modalCanvas.getContext('2d');
    const clearModalSignatureBtn = document.getElementById('clear-modal-signature-btn');
    const saveSignatureBtn = document.getElementById('save-signature-btn');

    // State
    let allGurus = [];
    let currentMeetingId = null;
    let signatureDataUrl = null;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    // --- Toast Notification ---
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 100);
    }

    // --- Canvas Logic (Modal) ---
    function resizeModalCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const canvasContainer = modalCanvas.parentElement;
        modalCanvas.width = canvasContainer.offsetWidth * ratio;
        modalCanvas.height = canvasContainer.offsetHeight * ratio;
        modalCanvas.getContext('2d').scale(ratio, ratio);
        clearModalCanvas();
    }

    function clearModalCanvas() {
        modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
        modalCtx.fillStyle = "#fff";
        modalCtx.fillRect(0, 0, modalCanvas.width, modalCanvas.height);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        modalCtx.strokeStyle = '#000';
        modalCtx.lineWidth = 2;
        modalCtx.lineCap = 'round';
        modalCtx.lineJoin = 'round';

        const rect = modalCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        modalCtx.beginPath();
        modalCtx.moveTo(lastX, lastY);
        modalCtx.lineTo(x, y);
        modalCtx.stroke();
        [lastX, lastY] = [x, y];
    }
    
    function startDrawing(e) {
        isDrawing = true;
        e.preventDefault();
        const rect = modalCanvas.getBoundingClientRect();
        [lastX, lastY] = [(e.clientX || e.touches[0].clientX) - rect.left, (e.clientY || e.touches[0].clientY) - rect.top];
    }
    
    function stopDrawing() {
        isDrawing = false;
    }

    function isCanvasBlank() {
        const pixelBuffer = new Uint32Array(
            modalCtx.getImageData(0, 0, modalCanvas.width, modalCanvas.height).data.buffer
        );
        return !pixelBuffer.some(color => color !== 4294967295); // Check for non-white pixels
    }


    // --- Data Loading and UI Updates ---
    async function loadActiveMeetings() {
        try {
            const meetings = await apiCall('getMeetings', 'GET', { status: 'Draft' });
            meetingSelect.innerHTML = '<option value="">-- Pilih Rapat --</option>';
            meetings.forEach(meeting => {
                const option = new Option(`${meeting.topik_rapat} (${meeting.tanggal_rapat})`, meeting.id);
                meetingSelect.add(option);
            });
        } catch (error) {
            console.error('Error loading meetings:', error);
            meetingSelect.innerHTML = '<option value="">Error memuat rapat</option>';
        }
    }

    async function loadGuruList() {
        try {
            allGurus = await apiCall('getGuruList', 'GET');
        } catch (error) {
            console.error('Error loading teachers:', error);
        }
    }
    
    async function loadAttendees(meetingId) {
        if (!meetingId) {
            attendeeList.innerHTML = '<li>Pilih rapat untuk melihat peserta.</li>';
            return;
        }
        try {
            const attendees = await apiCall('getAttendees', 'GET', { id_rapat: meetingId });
            if (attendees.length > 0) {
                attendeeList.innerHTML = attendees.map(p => `<li>${p.nama_peserta}</li>`).join('');
            } else {
                attendeeList.innerHTML = '<li>Belum ada peserta yang hadir.</li>';
            }
        } catch (error) {
            console.error('Error loading attendees:', error);
            attendeeList.innerHTML = '<li>Gagal memuat peserta.</li>';
        }
    }
    
     async function loadGlobalHeaders() {
        try {
            const settings = await apiCall('getGlobalSettings', 'GET');
            if(settings.rapat_form_title && appHeaderTitle) {
                appHeaderTitle.innerHTML = `<i class="fas fa-clipboard-list"></i> ${settings.rapat_form_title}`;
            }
        } catch (error) {
            console.warn("Could not load global headers:", error.message);
        }
    }

    // --- Event Handlers ---
    async function handleCreateMeeting() {
        const topik = prompt("Masukkan topik rapat baru:");
        if (!topik) return;
        const tanggal = new Date().toISOString().slice(0, 10);

        try {
            const data = await apiCall('createRapat', 'POST', { topik, tanggal });
            showToast('Rapat baru berhasil dibuat.', 'success');
            await loadActiveMeetings();
            meetingSelect.value = data.id;
            meetingSelect.dispatchEvent(new Event('change'));
        } catch (error) {
            showToast('Terjadi kesalahan.', 'error');
        }
    }
    
    function handleMeetingSelect() {
        currentMeetingId = meetingSelect.value;
        if (currentMeetingId) {
            attendanceForm.classList.add('active');
            attendeeListCard.classList.add('active');
            const selectedText = meetingSelect.options[meetingSelect.selectedIndex].text;
            attendanceFormTitle.innerHTML = `<i class="fas fa-user-edit"></i> 2. Isi Kehadiran untuk: <b>${selectedText}</b>`;
            attendeeListTitle.innerHTML = `<i class="fas fa-users"></i> 3. Peserta yang Sudah Hadir`;
            loadAttendees(currentMeetingId);
        } else {
            attendanceForm.classList.remove('active');
            attendeeListCard.classList.remove('active');
        }
    }

    function handleToggleManualName() {
        const isChecked = manualNameToggle.checked;
        guruSelectGroup.style.display = isChecked ? 'none' : 'block';
        manualNameGroup.style.display = isChecked ? 'block' : 'none';
        if (isChecked) {
            manualNameInput.focus();
        } else {
            guruInput.value = '';
        }
    }

    async function handleSubmitAttendance() {
        if (!currentMeetingId) {
            showToast('Pilih rapat terlebih dahulu.', 'error');
            return;
        }
        
        const nama = manualNameToggle.checked ? manualNameInput.value.trim() : guruInput.value.trim();
        if (!nama) {
            showToast('Nama peserta tidak boleh kosong.', 'error');
            return;
        }
        
        if (!signatureDataUrl) {
            showToast('Tanda tangan tidak boleh kosong.', 'error');
            return;
        }

        submitAttendanceBtn.disabled = true;
        submitAttendanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        
        try {
            await apiCall('saveAttendance', 'POST', {
                id_rapat: currentMeetingId,
                nama: nama,
                tanda_tangan: signatureDataUrl
            });
            showToast('Kehadiran berhasil dicatat!', 'success');
            loadAttendees(currentMeetingId);
            // Reset form fields
            guruInput.value = '';
            manualNameInput.value = '';
            signatureDataUrl = null;
            signaturePreview.src = '';
            signaturePreview.style.display = 'none';
        } catch (error) {
            showToast('Terjadi kesalahan koneksi.', 'error');
        } finally {
            submitAttendanceBtn.disabled = false;
            submitAttendanceBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Kehadiran';
        }
    }

    // --- Autocomplete Handlers ---
    function handleGuruSearch() {
        const query = guruInput.value.toLowerCase();
        guruSuggestions.innerHTML = '';
        if (query.length < 2) {
            guruSuggestions.style.display = 'none';
            return;
        }

        const filteredGurus = allGurus.filter(guru => 
            guru.nama_guru.toLowerCase().includes(query)
        );

        if (filteredGurus.length > 0) {
            filteredGurus.forEach(guru => {
                const li = document.createElement('li');
                li.textContent = guru.nama_guru;
                li.addEventListener('click', () => {
                    guruInput.value = guru.nama_guru;
                    guruSuggestions.style.display = 'none';
                });
                guruSuggestions.appendChild(li);
            });
            guruSuggestions.style.display = 'block';
        } else {
            guruSuggestions.style.display = 'none';
        }
    }

    // --- Modal Handlers ---
    function openSignatureModal() {
        modalOverlay.classList.add('active');
        resizeModalCanvas();
    }

    function closeSignatureModal() {
        modalOverlay.classList.remove('active');
    }

    function handleSaveSignature() {
        if (isCanvasBlank()) {
            showToast('Tanda tangan masih kosong.', 'error');
            return;
        }
        signatureDataUrl = modalCanvas.toDataURL('image/webp', 0.8);
        signaturePreview.src = signatureDataUrl;
        signaturePreview.style.display = 'block';
        closeSignatureModal();
    }

    // --- Initialization ---
    function init() {
        loadActiveMeetings();
        loadGuruList();
        loadGlobalHeaders();
        
        // Event Listeners
        window.addEventListener('resize', resizeModalCanvas);
        createMeetingBtn.addEventListener('click', handleCreateMeeting);
        meetingSelect.addEventListener('change', handleMeetingSelect);
        manualNameToggle.addEventListener('change', handleToggleManualName);
        submitAttendanceBtn.addEventListener('click', handleSubmitAttendance);
        guruInput.addEventListener('input', handleGuruSearch);

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!guruSelectGroup.contains(e.target)) {
                guruSuggestions.style.display = 'none';
            }
        });

        // Modal Listeners
        openSignatureModalBtn.addEventListener('click', openSignatureModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeSignatureModal();
            }
        });
        saveSignatureBtn.addEventListener('click', handleSaveSignature);
        clearModalSignatureBtn.addEventListener('click', clearModalCanvas);

        // Canvas listeners
        modalCanvas.addEventListener('mousedown', startDrawing);
        modalCanvas.addEventListener('mouseup', stopDrawing);
        modalCanvas.addEventListener('mouseout', stopDrawing);
        modalCanvas.addEventListener('mousemove', draw);
        modalCanvas.addEventListener('touchstart', startDrawing, { passive: false });
        modalCanvas.addEventListener('touchend', stopDrawing);
        modalCanvas.addEventListener('touchmove', draw, { passive: false });
    }

    init();
});
