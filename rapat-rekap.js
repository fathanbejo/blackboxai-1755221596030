import { apiCall } from './api-helper.js';
import { protectPage } from './auth-helper.js';
import { drawPdfHeader, processImageForPdf } from './pdf-helper.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Lindungi halaman, semua peran yang login bisa masuk
    const user = await protectPage();
    if (!user) return;

    // DOM Elements
    const meetingsTbody = document.getElementById('meetings-tbody');
    const loaderContainer = document.getElementById('loader-container');
    const searchInput = document.getElementById('search-input');
    const importGuruBtn = document.getElementById('import-guru-btn');
    const guruImportInput = document.getElementById('guru-import-input');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');

    // Notulen Modal Elements
    const notulenModalOverlay = document.getElementById('notulen-modal-overlay');
    const closeNotulenModalBtn = document.getElementById('close-notulen-modal-btn');
    const notulenMeetingId = document.getElementById('notulen-meeting-id');
    const notulenTextarea = document.getElementById('notulen-textarea');
    const dokumentasiInput = document.getElementById('dokumentasi-input');
    const dokumentasiPreviewContainer = document.getElementById('dokumentasi-preview-container');
    const saveNotulenBtn = document.getElementById('save-notulen-btn');

    // State
    let allMeetings = [];
    let newDocFiles = [];
    const MAX_DOC_FILES = 3;
    
    // Sembunyikan tombol login lama
    if(adminLoginBtn) adminLoginBtn.style.display = 'none';
    
    // Tampilkan fitur admin jika peran adalah 'admin'
    if (user.role === 'admin') {
        if(importGuruBtn) importGuruBtn.style.display = 'inline-flex';
        if(downloadTemplateBtn) downloadTemplateBtn.style.display = 'inline-flex';
    } else {
        if(importGuruBtn) importGuruBtn.style.display = 'none';
        if(downloadTemplateBtn) downloadTemplateBtn.style.display = 'none';
    }


    // --- Image Compression ---
    function compressImage(file, maxWidth = 1280, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => {
                        if (blob) {
                            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                        } else {
                            reject(new Error('Canvas to Blob conversion failed'));
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = reject;
            };
            reader.onerror = error => reject(error);
        });
    }

    // --- PDF Generation ---
    async function generatePdfForMeeting(meetingId, button) {
        const meeting = allMeetings.find(m => m.id == meetingId);
        if (!meeting) return alert('Detail rapat tidak ditemukan.');

        const originalButtonHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 30;

            // --- HEADER ---
            const globalSettings = await apiCall('getGlobalSettings', 'GET');
            let currentY = await drawPdfHeader(doc, globalSettings);
            currentY += 25; // Add space after header
            
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
            doc.text('DAFTAR HADIR RAPAT', pageWidth / 2, currentY, { align: 'center' });
            currentY += 20;
            doc.setFont('helvetica', 'bold', 12);
            doc.text(meeting.topik_rapat.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
            currentY += 15;
            const meetingDate = new Date(meeting.tanggal_rapat + 'T00:00:00');
            const formattedDate = meetingDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(formattedDate, pageWidth / 2, currentY, { align: 'center' });
            currentY += 20;

            // --- DATA PREPARATION ---
            const attendees = await apiCall('getAttendees', 'GET', { id_rapat: meetingId });
            const imagePromises = attendees.map(p => processImageForPdf(p.path_tanda_tangan).catch(e => { console.warn(e); return null; }));
            const processedImages = await Promise.all(imagePromises);

            const tableBody = attendees.map((p, index) => {
                return [
                    index + 1,
                    p.nama_peserta,
                    p.jabatan || '',
                    new Date(p.waktu_hadir).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':'),
                    '' // Placeholder for signature
                ];
            });

            // --- DRAW TABLE ---
            doc.autoTable({
                head: [['No.', 'Nama Peserta', 'Jabatan', 'Waktu', 'Tanda Tangan']],
                body: tableBody,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [46, 125, 50], halign: 'center' },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 30 },
                    1: { cellWidth: 150 },
                    2: { cellWidth: 195 },
                    3: { halign: 'center', cellWidth: 60 },
                    4: { cellWidth: 100 }
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 4) { // TTD column
                        const imgData = processedImages[data.row.index];
                        if (imgData && imgData.dataURL) {
                            const cellPadding = 4;
                            const cellWidth = data.cell.width - (cellPadding * 2);
                            const cellHeight = data.cell.height - (cellPadding * 2);

                            const widthRatio = cellWidth / imgData.width;
                            const heightRatio = cellHeight / imgData.height;
                            const scale = Math.min(widthRatio, heightRatio);

                            const renderWidth = imgData.width * scale;
                            const renderHeight = imgData.height * scale;

                            const x = data.cell.x + (data.cell.width - renderWidth) / 2;
                            const y = data.cell.y + (data.cell.height - renderHeight) / 2;
                            
                            doc.addImage(imgData.dataURL, 'JPEG', x, y, renderWidth, renderHeight);
                        }
                    }
                },
                rowPageBreak: 'auto',
                bodyStyles: { valign: 'middle', minCellHeight: 45 },
            });
            
            let finalY = doc.lastAutoTable.finalY;

            // --- FOOTER SIGNATURE ---
            const signatureBlockHeight = 150;
            if ((pageHeight - finalY) < signatureBlockHeight) {
                doc.addPage();
                finalY = margin;
            } else {
                finalY += 40;
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
            
            // --- ATTACHMENTS (NOTULEN & DOKUMENTASI) ---
            const docPaths = meeting.path_dokumentasi ? JSON.parse(meeting.path_dokumentasi) : [];
            if (meeting.notulen || (Array.isArray(docPaths) && docPaths.length > 0)) {
                doc.addPage();
                let attachY = margin;
                doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
                doc.text('LAMPIRAN', pageWidth / 2, attachY, { align: 'center' });
                
                doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
                doc.text(`Rapat: ${meeting.topik_rapat}`, pageWidth / 2, attachY + 20, { align: 'center' });
                doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
                doc.text(formattedDate, pageWidth / 2, attachY + 32, { align: 'center' });
                doc.setTextColor(0);
                attachY += 50;

                if(meeting.notulen) {
                    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
                    doc.text('Catatan Notulen', margin, attachY);
                    attachY += 20;
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
                    const notulenLines = doc.splitTextToSize(meeting.notulen, pageWidth - (margin * 2));
                    doc.text(notulenLines, margin, attachY);
                    attachY += (notulenLines.length * 12) + 30;
                }

                if(Array.isArray(docPaths) && docPaths.length > 0) {
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
                    doc.text('Dokumentasi Foto', margin, attachY);
                    attachY += 20;

                    const docImagePromises = docPaths.map(path => processImageForPdf(path).catch(() => null));
                    const processedDocImages = await Promise.all(docImagePromises);
                    const validImages = processedDocImages.filter(Boolean);

                    if (validImages.length > 0) {
                        const containerWidth = pageWidth - (margin * 2);
                        const gap = 10;
                        
                        const firstRowImages = validImages.slice(0, 2);
                        if (firstRowImages.length > 0) {
                            const imageWidth = (containerWidth - (gap * (firstRowImages.length - 1))) / firstRowImages.length;
                            let maxRowHeight = 0;
                            const scaledDims = firstRowImages.map(imgData => {
                                const scaledHeight = (imgData.height * imageWidth) / imgData.width;
                                if(scaledHeight > maxRowHeight) maxRowHeight = scaledHeight;
                                return { dataURL: imgData.dataURL, width: imageWidth, height: scaledHeight };
                            });
                            
                            let xOffset = margin;
                            scaledDims.forEach(dim => {
                                doc.addImage(dim.dataURL, 'JPEG', xOffset, attachY, dim.width, dim.height);
                                xOffset += dim.width + gap;
                            });
                            attachY += maxRowHeight + gap;
                        }

                        const thirdImage = validImages[2];
                        if (thirdImage) {
                            const imageWidth = containerWidth * 0.75;
                            const scaledHeight = (thirdImage.height * imageWidth) / thirdImage.width;
                            const xOffset = margin + (containerWidth - imageWidth) / 2;
                             if (attachY + scaledHeight > pageHeight - margin) {
                                doc.addPage();
                                attachY = margin;
                            }
                            doc.addImage(thirdImage.dataURL, 'JPEG', xOffset, attachY, imageWidth, scaledHeight);
                        }
                    }
                }
            }
            
            doc.save(`Laporan Rapat - ${meeting.topik_rapat}.pdf`);
        } catch (error) {
            console.error("PDF Generation failed:", error);
            alert("Gagal membuat PDF: " + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = originalButtonHtml;
        }
    }
    
    // --- UI Rendering ---
    function renderTable(meetings) {
        meetingsTbody.innerHTML = '';
        if (meetings.length === 0) {
            meetingsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Tidak ada rapat ditemukan.</td></tr>';
            return;
        }

        meetings.forEach(meeting => {
            const tr = document.createElement('tr');
            tr.dataset.meetingId = meeting.id;
            const statusBadge = meeting.status_rapat === 'Selesai' 
                ? `<span class="status-badge status-selesai">Selesai</span>`
                : `<span class="status-badge status-draft">Draft</span>`;
            const toggleStatusText = meeting.status_rapat === 'Selesai' ? 'Jadikan Draft' : 'Selesaikan';
            const toggleStatusIcon = meeting.status_rapat === 'Selesai' ? 'fa-edit' : 'fa-check';

            tr.innerHTML = `
                <td>${meeting.tanggal_rapat}</td>
                <td>${meeting.topik_rapat}</td>
                <td>${statusBadge}</td>
                <td class="action-buttons">
                    <button class="action-btn btn-pdf" data-action="pdf" title="Cetak Laporan PDF"><i class="fas fa-file-pdf"></i></button>
                    <button class="action-btn btn-notulen" data-action="notulen" title="Notulen & Dokumentasi"><i class="fas fa-file-alt"></i></button>
                    <button class="action-btn btn-status" data-action="status" title="${toggleStatusText}"><i class="fas ${toggleStatusIcon}"></i></button>
                    <button class="action-btn btn-delete admin-only" data-action="delete" title="Hapus Rapat" style="display: ${user.role === 'admin' ? 'inline-flex' : 'none'};"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            meetingsTbody.appendChild(tr);
        });
    }

    // ... sisa fungsi dari file asli ...

    // --- Data Loading ---
    async function loadMeetings() {
        loaderContainer.style.display = 'block';
        meetingsTbody.innerHTML = '';
        try {
            allMeetings = await apiCall('getMeetings', 'GET');
            renderTable(allMeetings);
        } catch (error) {
            console.error('Error loading meetings:', error);
            meetingsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Terjadi kesalahan koneksi.</td></tr>';
        } finally {
            loaderContainer.style.display = 'none';
        }
    }

    // --- Initialization ---
    function init() {
        loadMeetings();
        // ... sisa event listener dari file asli ...
        searchInput.addEventListener('input', () => {/* ... */});
        meetingsTbody.addEventListener('click', () => {/* ... */});
        importGuruBtn.addEventListener('click', () => { guruImportInput.click() });
        guruImportInput.addEventListener('change', () => {/* ... */});
        downloadTemplateBtn.addEventListener('click', () => {/* ... */});
        
        closeNotulenModalBtn.addEventListener('click', () => notulenModalOverlay.classList.remove('active'));
        saveNotulenBtn.addEventListener('click', () => {/* ... */});
        dokumentasiInput.addEventListener('change', () => {/* ... */});
    }
    
    // Panggil fungsi init setelah semua fungsi lain didefinisikan
    init();

});