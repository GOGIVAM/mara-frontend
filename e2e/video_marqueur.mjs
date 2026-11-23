// Fabrique une vidéo Y4M (caméra factice de Chrome) montrant le marqueur QR d'un équipement.
// Usage : node e2e/video_marqueur.mjs <sortie.y4m> [texte]
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const [sortie, texte = 'VUF_POMP_001'] = process.argv.slice(2);
const L = 640;
const H = 480;
const IMAGES = 30;
const qr = QRCode.create(texte, { errorCorrectionLevel: 'M' });
const n = qr.modules.size;
const module = Math.floor(200 / (n + 8));
const cote = module * (n + 8);
const x0 = Math.floor((L - cote) / 2);
const y0 = Math.floor((H - cote) / 2);

const y = new Uint8Array(L * H).fill(150);              // fond gris
for (let j = 0; j < cote; j += 1) {
  for (let i = 0; i < cote; i += 1) {
    const mx = Math.floor(i / module) - 4;
    const my = Math.floor(j / module) - 4;
    const noir = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(mx, my);
    y[(y0 + j) * L + x0 + i] = noir ? 16 : 235;
  }
}
const uv = new Uint8Array((L / 2) * (H / 2)).fill(128);
const entete = Buffer.from(`YUV4MPEG2 W${L} H${H} F15:1 Ip A1:1 C420jpeg\n`);
const parts = [entete];
for (let k = 0; k < IMAGES; k += 1) parts.push(Buffer.from('FRAME\n'), Buffer.from(y), Buffer.from(uv), Buffer.from(uv));
writeFileSync(sortie, Buffer.concat(parts));
console.log(`${sortie} : marqueur « ${texte} » de ${cote} px au centre`);
