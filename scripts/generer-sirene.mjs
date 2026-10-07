// Génère la sirène d'alerte SOS : public/sounds/sirene.wav
//
// Son synthétique (aucun téléchargement) : WAV PCM 16 bits mono, 22 050 Hz,
// 2 secondes, deux tons alternés type « pin-pon » (960 Hz puis 770 Hz, 0,5 s
// chacun). Amplitude modérée (0,6 de la pleine échelle), courts fondus à chaque
// transition pour éviter les clics. Le fichier commence et finit à zéro : la
// lecture en boucle (`loop = true`) est sans à-coup.
//
// Pour le regénérer : node scripts/generer-sirene.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FREQ_ECH = 22050;
const TONS = [960, 770, 960, 770];
const DUREE_TON = 0.5;
const AMPLITUDE = 0.6;
const FONDU = 0.01; // 10 ms

const echParTon = Math.round(FREQ_ECH * DUREE_TON);
const fonduEch = Math.round(FREQ_ECH * FONDU);
const total = echParTon * TONS.length;
const donnees = Buffer.alloc(total * 2);

let phase = 0;
for (let i = 0; i < total; i++) {
  const ton = Math.floor(i / echParTon);
  const pos = i % echParTon;
  const freq = TONS[ton];

  // Enveloppe : fondu entrant et sortant à chaque ton
  let env = 1;
  if (pos < fonduEch) env = pos / fonduEch;
  else if (pos >= echParTon - fonduEch) env = (echParTon - 1 - pos) / fonduEch;

  phase += (2 * Math.PI * freq) / FREQ_ECH;
  const valeur = Math.sin(phase) * env * AMPLITUDE;
  donnees.writeInt16LE(Math.round(valeur * 32767), i * 2);
}

// En-tête RIFF/WAVE, format PCM
const entete = Buffer.alloc(44);
entete.write("RIFF", 0);
entete.writeUInt32LE(36 + donnees.length, 4);
entete.write("WAVE", 8);
entete.write("fmt ", 12);
entete.writeUInt32LE(16, 16); // taille du bloc fmt
entete.writeUInt16LE(1, 20); // PCM
entete.writeUInt16LE(1, 22); // mono
entete.writeUInt32LE(FREQ_ECH, 24);
entete.writeUInt32LE(FREQ_ECH * 2, 28); // octets par seconde
entete.writeUInt16LE(2, 32); // octets par échantillon
entete.writeUInt16LE(16, 34); // bits par échantillon
entete.write("data", 36);
entete.writeUInt32LE(donnees.length, 40);

const dossier = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");
mkdirSync(dossier, { recursive: true });
const sortie = join(dossier, "sirene.wav");
writeFileSync(sortie, Buffer.concat([entete, donnees]));
console.log(`Sirène écrite : ${sortie}`);
