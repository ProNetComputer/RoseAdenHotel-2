/**
 * ProNet QR Studio Pro - Core Engine & Scanner Module
 * Includes:
 * 1. QR Code Design Project Importer & Exporter (.pronetqr / .json / .svg / .png)
 * 2. Smart Live Camera QR Scanner & Snapshot Capture
 * 3. Barcode / QR Image File Decoder
 * 4. Automatic Action Execution (Wi-Fi Connect, URL Open, vCard Download, WhatsApp Chat, Phone Call)
 */

class ProNetQRStudioEngine {
    constructor(stateManager) {
        this.state = stateManager;
        this.camStream = null;
        this.isScanning = false;
        this.facingMode = 'environment';
    }

    // 1. Export Design Project
    exportProject(currentFormData) {
        const project = {
            pronet_signature: 'PRO_NET_QR_STUDIO_PROJECT',
            version: '2.5.0',
            timestamp: new Date().toISOString(),
            state: { ...this.state },
            formData: currentFormData
        };
        return JSON.stringify(project, null, 2);
    }

    // 2. Import & Restore Design Project
    importProjectFile(file, onLoadedCallback) {
        const reader = new FileReader();
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.json') || fileName.endsWith('.pronetqr')) {
            reader.onload = (e) => {
                try {
                    const project = JSON.parse(e.target.result);
                    onLoadedCallback(project);
                } catch (err) {
                    throw new Error("Invalid project file format");
                }
            };
            reader.readAsText(file);
        } else if (fileName.endsWith('.svg')) {
            reader.onload = (e) => {
                const text = e.target.result;
                const match = text.match(/<metadata id="pronet-design-state">([^<]+)<\/metadata>/);
                if (match && match[1]) {
                    const project = JSON.parse(decodeURIComponent(match[1]));
                    onLoadedCallback(project);
                } else {
                    throw new Error("SVG does not contain ProNet design metadata");
                }
            };
            reader.readAsText(file);
        } else {
            // Image file: scan and parse payload
            this.scanImageFile(file, (scanned) => {
                onLoadedCallback({ scannedPayload: scanned });
            });
        }
    }

    // 3. Live Camera Management
    async startCamera(videoElement, onFrameScanned) {
        if (this.camStream) this.stopCamera();
        const constraints = {
            video: {
                facingMode: this.facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        this.camStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = this.camStream;
        await videoElement.play();
        this.isScanning = true;

        const scanLoop = async () => {
            if (!this.isScanning) return;
            if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                if ('BarcodeDetector' in window) {
                    try {
                        const detector = new BarcodeDetector({ formats: ['qr_code'] });
                        const barcodes = await detector.detect(videoElement);
                        if (barcodes.length > 0) {
                            this.isScanning = false;
                            onFrameScanned(this.parsePayload(barcodes[0].rawValue));
                            return;
                        }
                    } catch (e) {}
                }
            }
            if (this.isScanning) requestAnimationFrame(scanLoop);
        };
        requestAnimationFrame(scanLoop);
    }

    stopCamera() {
        this.isScanning = false;
        if (this.camStream) {
            this.camStream.getTracks().forEach(t => t.stop());
            this.camStream = null;
        }
    }

    switchCamera(videoElement, onFrameScanned) {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        return this.startCamera(videoElement, onFrameScanned);
    }

    // 4. Capture Camera Snapshot
    captureSnapshot(videoElement) {
        if (!this.camStream || videoElement.videoWidth === 0) {
            throw new Error("Camera stream not active");
        }
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    // 5. Scan Image Source
    async scanImageSource(imageOrCanvas, onScanned) {
        if ('BarcodeDetector' in window) {
            try {
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                const barcodes = await detector.detect(imageOrCanvas);
                if (barcodes.length > 0) {
                    onScanned(this.parsePayload(barcodes[0].rawValue));
                    return;
                }
            } catch (e) {}
        }
        throw new Error("No QR code detected");
    }

    // 6. Parse QR Payload & Generate Smart Actions
    parsePayload(rawText) {
        const text = (rawText || '').trim();

        // Wi-Fi
        if (text.startsWith('WIFI:')) {
            const wifi = { ssid: '', pass: '', type: 'WPA', hidden: false };
            text.replace('WIFI:', '').replace(/;;$/, '').split(';').forEach(p => {
                if (p.startsWith('S:')) wifi.ssid = p.substring(2);
                else if (p.startsWith('P:')) wifi.pass = p.substring(2);
                else if (p.startsWith('T:')) wifi.type = p.substring(2);
                else if (p.startsWith('H:')) wifi.hidden = p.substring(2).toLowerCase() === 'true';
            });
            return {
                type: 'wifi',
                label: 'شبكة واي فاي (Wi-Fi)',
                data: wifi,
                raw: text,
                executePrimary: () => navigator.clipboard.writeText(wifi.pass)
            };
        }

        // vCard
        if (text.startsWith('BEGIN:VCARD') || text.startsWith('MECARD:')) {
            const vc = { fn: '', org: '', mobile: '', phone: '', email: '', addr: '' };
            text.split(/\r?\n/).forEach(line => {
                line = line.trim();
                if (line.startsWith('FN:')) vc.fn = line.substring(3);
                else if (line.startsWith('ORG:')) vc.org = line.substring(4);
                else if (line.startsWith('TEL') && !vc.mobile) {
                    const idx = line.indexOf(':');
                    if (idx !== -1) vc.mobile = line.substring(idx + 1);
                } else if (line.startsWith('EMAIL:')) vc.email = line.substring(6);
                else if (line.startsWith('ADR:')) vc.addr = line.substring(4).replace(/;/g, ' ').trim();
            });
            return {
                type: 'vcard',
                label: 'بطاقة أعمال رقمية (vCard)',
                data: vc,
                raw: text,
                executePrimary: () => {
                    const blob = new Blob([text], { type: 'text/vcard;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${vc.fn || 'contact'}.vcf`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            };
        }

        // WhatsApp
        if (text.includes('wa.me') || text.includes('api.whatsapp.com')) {
            return {
                type: 'whatsapp',
                label: 'محادثة واتساب (WhatsApp)',
                raw: text,
                executePrimary: () => window.open(text, '_blank')
            };
        }

        // URL
        if (text.startsWith('http://') || text.startsWith('https://')) {
            return {
                type: 'url',
                label: 'رابط ويب (Website URL)',
                raw: text,
                executePrimary: () => window.open(text, '_blank')
            };
        }

        // Phone
        if (text.startsWith('tel:')) {
            return {
                type: 'phone',
                label: 'اتصال هاتفي (Phone Call)',
                raw: text,
                executePrimary: () => window.location.href = text
            };
        }

        // Default Plain Text
        return {
            type: 'text',
            label: 'نص عام (Plain Text)',
            raw: text,
            executePrimary: () => navigator.clipboard.writeText(text)
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProNetQRStudioEngine;
}
