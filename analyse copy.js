const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

function readCSV(filePath) {
  const file = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(file, { header: true, skipEmptyLines: true });
  return parsed.data;
}

module.exports = async function analyse(search = '') {
  const stocksRaw = readCSV(path.join(__dirname, 'data/product-stocks.csv'));
  const products = readCSV(path.join(__dirname, 'data/products.csv'));
  const sizesData = readCSV(path.join(__dirname, 'data/product-sizes.csv'));

  // ❌ Artikel mit Modell 'Service' ausschließen
  const stocks = stocksRaw.filter(
    s => !String(s.Modell).toLowerCase().startsWith('service')
  );

  // Filterartikel bestimmen
  let artikelFilterSet = new Set();

  if (search) {
    const filteredStocks = stocks.filter(s =>
      s.Modell?.toLowerCase().includes(search.toLowerCase())
    );
    artikelFilterSet = new Set(filteredStocks.map(s => String(s.ArtikelNr)));
  } else {
    artikelFilterSet = new Set(['55407', '55408', '55409']); // Testartikel
  }


  // Größen vorbereiten
  const sizeGroups = new Map();
  sizesData.forEach(s => {
    const artikelNr = String(s.ArtikelNr);
    if (!artikelFilterSet.has(artikelNr)) return;

    const entry = {
      size: s.groesse,
      stock: Number(s.Bestand),
      index: Number(s.Index),
    };

    if (!sizeGroups.has(artikelNr)) sizeGroups.set(artikelNr, []);
    sizeGroups.get(artikelNr).push(entry);
  });

  // Sortieren nach Index
  sizeGroups.forEach(arr => arr.sort((a, b) => a.index - b.index));

  // Sonderpreise zuordnen
  const specialPriceMap = new Map();
  products.forEach(p => {
    specialPriceMap.set(String(p.ArtikelNr), p.Sonderpreis);
  });

  // Ausgabe vorbereiten
  const groupedMap = new Map();

  stocks.forEach(s => {
    const artikelNr = String(s.ArtikelNr);
    if (!artikelFilterSet.has(artikelNr)) return;
    if (s.Modell?.toLowerCase().startsWith('service')) return;

    const hasSizes = sizeGroups.has(artikelNr);
    const totalStock = hasSizes
      ? sizeGroups.get(artikelNr).reduce((sum, s) => sum + s.stock, 0)
      : parseFloat(s.Bestand);

    if (!totalStock || totalStock === 0) return;

    const key = artikelNr + '|' + s.Farbe;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        unique_id: s.IdentNr,
        product_id: s.ModellCode,
        name: s.Modell,
        color_code: s.FarbeCode,
        color: s.Farbe,
        supplier_id: parseInt(s.LieferantNr),
        supplier: s.Hersteller,
        sizes: sizeGroups.get(artikelNr) || [],
        real_ek: parseFloat(s.EK),
        list_ek: parseFloat(s.Preis),
        discount1: parseFloat(s.Rabatt1),
        discount2: parseFloat(s.Rabatt2),
        list_vk: parseFloat(s.VK),
        special_price: specialPriceMap.get(artikelNr) || null,
        vat: parseInt(s.MWSt) === 1 ? 0.07 : 0.19
      });
    }
  }); 



  return Array.from(groupedMap.values());
};
