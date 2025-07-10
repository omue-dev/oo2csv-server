const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Liest und parsed die customer.csv mit Validierungen und Aufbereitung
function readCSV(filePath) {
  const file = fs.readFileSync(filePath, 'latin1'); // Kodierung latin1 für Umlaute
  return Papa.parse(file, { header: true, skipEmptyLines: true }).data;
}

// Hilfsfunktionen für Validierung und Formatierung
function cleanText(value) {
  return value ? value.trim() : '';
}

function cleanZip(zip) {
  return zip ? zip.replace(/\s+/g, '') : '';
}

// Extrahiert alle Telefonnummern aus einem String anhand von Leerzeichen
function splitPhoneNumbers(raw) {
  if (!raw) return [];
  // Entferne Buchstaben
  let noLetters = raw.replace(/[A-Za-zÄÖÜäöüß]/g, '');
  // Mehrfache Leerzeichen zu einem
  noLetters = noLetters.replace(/\s+/g, ' ').trim();
  // Aufteilen an Leerzeichen
  return noLetters.split(' ').filter(part => part && /[+\d]/.test(part));
}

// Formatiert eine einzelne Telefonnummer je nach Land und entfernt führendes '+'
function formatPhoneNumber(raw, country) {
  if (!raw) return '';
  // Behalte nur Ziffern und '+'
  let cleaned = raw.replace(/[^+\d]/g, '');
  // Entferne '+' am Anfang
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);

  const c = country.trim();
  // Deutschland: ensure '0' prefix, drop '49'
  if (/^(Germany|Deutschland|DE)$/i.test(c)) {
    if (cleaned.startsWith('49')) cleaned = '0' + cleaned.slice(2);
    if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
  // Österreich
  } else if (/^A$/i.test(c)) {
    if (!cleaned.startsWith('43')) {
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      cleaned = '43' + cleaned;
    }
  // Schweiz
  } else if (/^CH$/i.test(c)) {
    if (!cleaned.startsWith('41')) {
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      cleaned = '41' + cleaned;
    }
  // Andere Länder
  } else {
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  }
  return cleaned;
}

function validateEmail(raw) {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  if (/^(k\.a\.|n\/a|ka|none)$/i.test(v)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function formatGermanDate(rawDate) {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d)) return rawDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

module.exports = function customers() {
  const data = readCSV(path.join(__dirname, 'data/customers.csv')).filter(c => c.KundeNr);

  const items = data.map(c => {
    // Remark-Aufbereitung
    const origRemarks = cleanText(c.Bemerkung).split(/\r?\n/).filter(r => r);
    const newRemarks = [];

    // Kundengruppen zuerst
    ['Alpenverein','Pfadfinder','Kletterer','Bergsteiger','Radfahrer'].forEach(key => {
      const val = c[key];
      if (val != 0 || cleanText(val) != '0') {
        newRemarks.push(`KdGr.: ${key}`);
      }
    });

    // 2) dann AbgerechnetBis (falls vorhanden)
    const abgraw = cleanText(c.AbgerechnetBis);
    if (abgraw) {
      newRemarks.push(`Abgerechnet bis: ${formatGermanDate(abgraw)}`);
    }

    // 3) und ganz zum Schluss die Original-Bemerkungen
    newRemarks.push(...origRemarks);

    // Telefonnummern verarbeiten
    const nums1 = splitPhoneNumbers(c.Telefon1 || '');
    const nums2 = splitPhoneNumbers(c.Telefon2 || '');
    let phone3 = '';
    const phone1 = nums1[0] ? formatPhoneNumber(nums1[0], c.Land) : '';
    if (nums1.length > 1) phone3 = formatPhoneNumber(nums1[1], c.Land);
    const phone2 = nums2[0] ? formatPhoneNumber(nums2[0], c.Land) : '';
    if (!phone3 && nums2.length > 1) phone3 = formatPhoneNumber(nums2[1], c.Land);

    // E-Mail + Bestätigung
    const rawEmail = cleanText(c.email);
    const isValidEmail = validateEmail(rawEmail);
    const email = isValidEmail ? rawEmail : '';
    const mail_confirmation = isValidEmail;

    return {
      customer_id: c.KundeNr,
      lastname: cleanText(c.Nachname),
      firstname: cleanText(c.Vorname),
      street: cleanText(c.Straße),
      zip: cleanZip(c.PLZ),
      city: cleanText(c.Ort),
      country: cleanText(c.Land),
      phone1,
      phone2,
      phone3,
      email,
      mail_confirmation,
      birthdate: cleanText(c.Geburtsdatum),
      remark: newRemarks,
      discount: parseFloat(c.Rabatt) || 0,
      deleted: c.geloescht === '1'
    };
  });

  return { total: items.length, items };
};
