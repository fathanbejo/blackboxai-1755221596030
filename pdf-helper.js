
/**
 * Memproses gambar untuk PDF, termasuk auto-cropping.
 * @param {string} url - URL gambar.
 * @returns {Promise<{dataURL: string, width: number, height: number}|null>}
 */
async function processImageForPdf(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Auto-cropping logic
            const pixels = ctx.getImageData(0, 0, img.width, img.height);
            const data = pixels.data;
            let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
            
            for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                    const i = (y * img.width + x) * 4;
                    // Check if pixel is not white and has some opacity
                    if (data[i] < 255 || data[i+1] < 255 || data[i+2] < 255 || data[i+3] > 0) {
                        if (x < minX) minX = x; if (x > maxX) maxX = x;
                        if (y < minY) minY = y; if (y > maxY) maxY = y;
                    }
                }
            }

            // If image is blank, resolve with null
            if (maxX === -1) {
                return resolve({ dataURL: null, width: 0, height: 0 });
            }

            const padding = 10;
            const cropX = Math.max(0, minX - padding);
            const cropY = Math.max(0, minY - padding);
            const cropWidth = Math.min(img.width, maxX + padding) - cropX;
            const cropHeight = Math.min(img.height, maxY + padding) - cropY;
            
            if (cropWidth <= 0 || cropHeight <= 0) {
                return resolve({ dataURL: null, width: 0, height: 0 });
            }

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = cropWidth;
            finalCanvas.height = cropHeight;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            
            const dataURL = finalCanvas.toDataURL('image/jpeg', 0.9);
            resolve({ dataURL, width: cropWidth, height: cropHeight });
        };
        img.onerror = (err) => reject(new Error(`Gagal memuat gambar: ${url}.`));
        
        // Simplified path handling for the new flat structure
        img.src = url;
    });
}

/**
 * Menggambar header PDF standar menggunakan pengaturan global.
 * @param {jsPDF} doc - Instansi jsPDF.
 * @param {object} settings - Objek pengaturan global.
 * @returns {Promise<number>} Posisi Y akhir setelah header digambar.
 */
export async function drawPdfHeader(doc, settings) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 30;
    
    // Default values
    const defaults = {
        logo_path: 'images/logo.png', // Fallback local path
        header_line_1: 'YAYASAN PENDIDIKAN ALMAARIF SINGOSARI',
        header_line_1_size: '14',
        header_line_1_color: '#2E7D32',
        header_line_2: 'SK Menkumham No. AHU-0003189.ah.01.04 Tahun 2015',
        header_line_2_size: '8',
        header_line_2_color: '#2E7D32',
        header_line_3: 'MADRASAH IBTIDAIYAH ALMAARIF 02',
        header_line_3_size: '20',
        header_line_3_color: '#2E7D32',
        header_line_4: 'TERAKREDITASI "A"',
        header_line_4_size: '16',
        header_line_4_color: '#2E7D32',
        header_line_5: 'Jl. Masjid 33, Telp. (0341) 451542 Singosari Malang 65153',
        header_line_5_size: '9',
        header_line_5_color: '#000000',
        header_line_6: 'email : mia02sgs@gmail.com - www.mia02sgs.sch.id',
        header_line_6_size: '9',
        header_line_6_color: '#000000',
    };
    
    const s = { ...defaults, ...settings };

    const logoData = await processImageForPdf(s.logo_path).catch(() => null);
    if (logoData && logoData.dataURL) {
         const imgHeight = 70;
         const imgWidth = (logoData.width * imgHeight) / logoData.height;
         doc.addImage(logoData.dataURL, 'JPEG', margin, 30, imgWidth, imgHeight);
    }
    
    const textX = margin + (logoData ? 80 : 0);
    const textBlockWidth = pageWidth - textX - margin;
    const textCenterX = textX + (textBlockWidth / 2);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(parseInt(s.header_line_1_size, 10)); doc.setTextColor(s.header_line_1_color);
    doc.text(s.header_line_1, textCenterX, 40, { align: 'center' });
    
    doc.setFont('helvetica', 'normal'); doc.setFontSize(parseInt(s.header_line_2_size, 10)); doc.setTextColor(s.header_line_2_color);
    doc.text(s.header_line_2, textCenterX, 52, { align: 'center' });
    
    doc.setFont('times', 'bold'); doc.setFontSize(parseInt(s.header_line_3_size, 10)); doc.setTextColor(s.header_line_3_color);
    doc.text(s.header_line_3, textCenterX, 68, { align: 'center' });
    
    doc.setFont('helvetica', 'bold'); doc.setFontSize(parseInt(s.header_line_4_size, 10)); doc.setTextColor(s.header_line_4_color);
    doc.text(s.header_line_4, textCenterX, 84, { align: 'center' });
    
    doc.setFont('helvetica', 'normal'); doc.setFontSize(parseInt(s.header_line_5_size, 10)); doc.setTextColor(s.header_line_5_color);
    doc.text(s.header_line_5, textCenterX, 98, { align: 'center' });
    
    doc.setFontSize(parseInt(s.header_line_6_size, 10)); doc.setTextColor(s.header_line_6_color);
    doc.text(s.header_line_6, textCenterX, 110, { align: 'center' });
    
    doc.setDrawColor(46, 125, 50);
    doc.setLineWidth(2.5); doc.line(margin, 125, pageWidth - margin, 125);
    doc.setLineWidth(1); doc.line(margin, 128, pageWidth - margin, 128);
    
    doc.setTextColor(0, 0, 0); // Reset to black for subsequent text

    return 130; // Return final Y position
}

// Ekspor processImageForPdf agar bisa digunakan di tempat lain jika perlu
export { processImageForPdf };
