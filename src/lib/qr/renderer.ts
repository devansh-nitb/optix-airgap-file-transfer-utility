import QRCode from 'qrcode';

export async function renderQRToCanvas(
    canvas: HTMLCanvasElement, 
    data: Uint8Array, 
    version: number, 
    errorCorrectionLevel: QRCode.QRCodeErrorCorrectionLevel = 'M',
    size?: number
) {
    try {
        await QRCode.toCanvas(canvas, [{ data: new Uint8ClampedArray(data) as any, mode: 'byte' }], {
            version: version,
            errorCorrectionLevel: errorCorrectionLevel,
            margin: 2,
            width: size || Math.min(window.innerWidth, window.innerHeight) * 0.9,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error("QR render error", err);
    }
}
