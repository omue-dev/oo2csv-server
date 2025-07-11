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

function validateDiscount(discount) 
{
  if (discount > 1) return discount / 100;
  else if (discount > 9) return discount / 1000;
  else return discount
}

function toEUCountryCode(country) {
  if (!country) return '';
  const map = {
    'A': 'AT', 'AT': 'AT', 'Austria': 'AT', 'Österreich': 'AT',
    'D': 'DE', 'DE': 'DE', 'Germany': 'DE', 'Deutschland': 'DE',
    'CH': 'CH', 'Switzerland': 'CH', 'Schweiz': 'CH',
    'FR': 'FR', 'France': 'FR', 'Frankreich': 'FR',
    'IT': 'IT', 'Italy': 'IT', 'Italien': 'IT',
    'ES': 'ES', 'Spain': 'ES', 'Spanien': 'ES',
    'NL': 'NL', 'Netherlands': 'NL', 'Niederlande': 'NL',
    'BE': 'BE', 'Belgium': 'BE', 'Belgien': 'BE',
    'LU': 'LU', 'Luxembourg': 'LU', 'Luxemburg': 'LU',
    'DK': 'DK', 'Denmark': 'DK', 'Dänemark': 'DK',
    'SE': 'SE', 'Sweden': 'SE', 'Schweden': 'SE',
    'FI': 'FI', 'Finland': 'FI', 'Finnland': 'FI',
    'IE': 'IE', 'Ireland': 'IE', 'Irland': 'IE',
    'PT': 'PT', 'Portugal': 'PT',
    'GR': 'GR', 'Greece': 'GR', 'Griechenland': 'GR',
    'PL': 'PL', 'Poland': 'PL', 'Polen': 'PL',
    'CZ': 'CZ', 'Czech Republic': 'CZ', 'Tschechien': 'CZ',
    'SK': 'SK', 'Slovakia': 'SK', 'Slowakei': 'SK',
    'HU': 'HU', 'Hungary': 'HU', 'Ungarn': 'HU',
    'SI': 'SI', 'Slovenia': 'SI', 'Slowenien': 'SI',
    'HR': 'HR', 'Croatia': 'HR', 'Kroatien': 'HR',
    'EE': 'EE', 'Estonia': 'EE', 'Estland': 'EE',
    'LV': 'LV', 'Latvia': 'LV', 'Lettland': 'LV',
    'LT': 'LT', 'Lithuania': 'LT', 'Litauen': 'LT',
    'BG': 'BG', 'Bulgaria': 'BG', 'Bulgarien': 'BG',
    'RO': 'RO', 'Romania': 'RO', 'Rumänien': 'RO',
    'CY': 'CY', 'Cyprus': 'CY', 'Zypern': 'CY',
    'MT': 'MT', 'Malta': 'MT',
  };
  const key = country.trim();
  return map[key] || key;
}

function getSalutation(anredeNr) {
  const map = {
    1: 'Herrn',
    2: 'Frau',
    3: 'Frau/Herrn',
    4: 'Herrn Dr.',
    5: 'Frau Dr.',
    6: 'Frau/Herrn Dr.',
    7: 'Herrn Prof. Dr.',
    8: 'Frau Prof. Dr.',
    9: 'Firma',
    10: 'An das',
    11: 'An den',
    12: 'An die',
    13: 'Familie'
  };
  const n = parseInt(anredeNr, 10);
  return map[n] || '';
}

module.exports = function customers() {
  const data = readCSV(path.join(__dirname, 'data/customers.csv')).filter(c => c.KundeNr);

  const items = data.map(c => {
    // Remark-Aufbereitung
    const origRemarks = cleanText(c.Bemerkung).split(/\r?\n/).filter(r => r);
    const newRemarks = [];

    // Kundengruppen zuerst
    // ['Alpenverein','Pfadfinder','Kletterer','Bergsteiger','Radfahrer'].forEach(key => {
    //   const val = c[key];
    //   if (val != 0 || cleanText(val) != '0') {
    //     newRemarks.push(`KdGr.: ${key}`);
    //   }
    // });

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

    // Straße und Hausnummer splitten
    const rawStreet = cleanText(c.Straße);
    let streetName = rawStreet;
    let streetNumber = '';
    const addrMatch = rawStreet.match(/^(.*\D)\s*(\d.*)$/);
    if (addrMatch) {
      streetName   = addrMatch[1].trim();  // everything up to the last non-digit
      streetNumber = addrMatch[2].trim();  // the digit+ suffix
    }

    // Set Country Code
    c.Land = toEUCountryCode(c.Land);

    // validate Discounts
    const discount = validateDiscount(parseFloat(c.Rabatt) || 0);
   // 521 discount 3 
    return {
      customer_id: c.KundeNr,
      salutation: getSalutation(c.AnredeNr),
      lastname: cleanText(c.Nachname),
      firstname: cleanText(c.Vorname),
      street: streetName,
      street_number: streetNumber,
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
      discount: discount,
      deleted: c.geloescht === '1'
    };
  });

  return { total: items.length, items };
};
