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

  const stocks = stocksRaw.filter(
    s => !String(s.Modell).toLowerCase().startsWith('service')
  );

  let artikelFilterSet = new Set();

  if (search) {
    const filteredStocks = stocks.filter(s =>
      s.Modell?.toLowerCase().includes(search.toLowerCase())
    );
    artikelFilterSet = new Set(filteredStocks.map(s => String(s.ArtikelNr)));
  } else {
    artikelFilterSet = new Set(['55407', '55408', '55409']);
  }

  const specialPriceMap = new Map();
  products.forEach(p => {
    specialPriceMap.set(String(p.ArtikelNr), p.Sonderpreis);
  });

  // Artikel + Farbe als Schlüssel
  const groupedByArticleAndColor = {};

  stocks.forEach(s => {
    const artikelNr = String(s.ArtikelNr);
    if (!artikelFilterSet.has(artikelNr)) return;

    const key = `${artikelNr}|${s.Farbe}`;
    if (!groupedByArticleAndColor[key]) {
      groupedByArticleAndColor[key] = {
        artikelNr,
        farbe: s.Farbe,
        color_code: s.FarbeCode,
        modell: s.Modell,
        modell_code: s.ModellCode,
        lieferant: s.Hersteller,
        lieferantNr: s.LieferantNr,
        preis: s.Preis,
        rabatt1: s.Rabatt1,
        rabatt2: s.Rabatt2,
        vk: s.VK,
        mwst: s.MWSt,
        identNr: s.IdentNr
      };
    }
  });

  const result = [];

  for (const key in groupedByArticleAndColor) {
    const {
      artikelNr,
      farbe,
      color_code,
      modell,
      modell_code,
      lieferant,
      lieferantNr,
      preis,
      rabatt1,
      rabatt2,
      vk,
      mwst,
      identNr
    } = groupedByArticleAndColor[key];

    const sizes = sizesData
      .filter(s => String(s.ArtikelNr) === artikelNr)
      .sort((a, b) => parseInt(a.Index) - parseInt(b.Index));

    sizes.forEach(sizeEntry => {
      const size = sizeEntry.groesse;
      const index = parseInt(sizeEntry.Index);
      const stock = parseFloat(sizeEntry.Bestand) || 0;

      // EK aus stocksRaw finden, wenn vorhanden und Bestand > 0
      const matchingStock = stocksRaw.find(
        s =>
          String(s.ArtikelNr) === artikelNr &&
          s.Farbe === farbe &&
          s.groesse === size &&
          parseFloat(s.Bestand) > 0
      );

      const realEk = matchingStock ? parseFloat(matchingStock.EK) : null;

      result.push({
        unique_id: identNr,
        product_id: modell_code,
        name: modell,
        color_code,
        color: farbe,
        supplier_id: parseInt(lieferantNr),
        supplier: lieferant,
        size,
        stock,
        index,
        real_ek: realEk,
        list_ek: parseFloat(preis),
        discount1: parseFloat(rabatt1),
        discount2: parseFloat(rabatt2),
        list_vk: parseFloat(vk),
        special_price: specialPriceMap.get(artikelNr) || null,
        vat: parseInt(mwst) === 1 ? 0.07 : 0.19
      });
    });
  }

  return result;
};
