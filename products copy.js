const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// CSV-Leser wie gehabt
function readCSV(filePath) {
    const fileContent = fs.readFileSync(filePath, 'latin1');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    return parsed.data;
}

// Filtert alle Lagerdaten (stock >= 1, keine Serviceartikel)
function loadFilteredStock() {
    const rawStock = readCSV(path.join(__dirname, 'data/product-stocks.csv'));

    const filteredStock = [];

    for (let i = 0; i < rawStock.length; i++) {
        const entry = rawStock[i];

        const stockQuantity = parseFloat(entry.Bestand);

        const isService = typeof entry.Modell === 'string' &&
                          entry.Modell.toLowerCase().startsWith('service');

        if (stockQuantity >= 1 && !isService) {
            filteredStock.push(entry);
        }
    }

    return filteredStock;
}

// Hilfsmapping Lieferant
function createSupplierMap(suppliers) {
    const map = new Map();

    for (let i = 0; i < suppliers.length; i++) {
        const entry = suppliers[i];
        const key = String(entry.LieferantNr);
        const value = entry.Lieferant;
        map.set(key, value);
    }

    return map;
}

// Sonderpreise (kannst du so lassen)
function createSpecialPriceMap(products) {
    const map = new Map();

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const articleNumber = String(product.ArtikelNr);
        const specialPrice = product.Sonderpreis;
        map.set(articleNumber, specialPrice);
    }

    return map;
}

// Gruppierung nach ArtikelNr+Farbe wie gehabt
function groupByArticleAndColor(stock, validArticles) {
    const grouped = {};

    for (let i = 0; i < stock.length; i++) {
        const entry = stock[i];
        const articleNumber = String(entry.ArtikelNr);

        if (!validArticles.has(articleNumber)) {
            continue;
        }

        const groupKey = articleNumber + "|" + entry.Farbe;

        if (!grouped.hasOwnProperty(groupKey)) {
            grouped[groupKey] = {
                artikelNr: articleNumber,
                farbe: entry.Farbe,
                color_code: entry.FarbeCode,
                modell: entry.Modell,
                modell_code: entry.ModellCode,
                lieferant: entry.Hersteller,
                lieferantNr: entry.LieferantNr,
                preis: entry.Preis,
                rabatt1: entry.Rabatt1,
                rabatt2: entry.Rabatt2,
                vk: entry.VK,
                mwst: entry.MWSt,
                identNr: entry.IdentNr
            };
        }
    }

    return grouped;
}

// Gefilterte Artikelnummern nach Suchbegriff
function getFilteredArticleNumbers(stock, search) {
    const articleNumbers = new Set();

    if (typeof search === 'string' && search.trim().length > 0) {
        const lowerSearch = search.toLowerCase();

        for (let i = 0; i < stock.length; i++) {
            const entry = stock[i];

            if (entry.Modell && entry.Modell.toLowerCase().includes(lowerSearch)) {
                const artikelNr = String(entry.ArtikelNr);
                articleNumbers.add(artikelNr);
            }
        }
    } else {
        for (let i = 0; i < stock.length; i++) {
            const artikelNr = String(stock[i].ArtikelNr);
            articleNumbers.add(artikelNr);
        }
    }

    return articleNumbers;
}

// *** HIER beginnt der spannende Teil: getProducts ***
module.exports = async function getProducts(search) {
    if (typeof search !== 'string') {
        search = '';
    }

    const stock = loadFilteredStock();
    const products = readCSV(path.join(__dirname, 'data/products.csv'));
    const suppliers = readCSV(path.join(__dirname, 'data/supplier.csv'));
    const sizes = readCSV(path.join(__dirname, 'data/product-sizes.csv'));

    const supplierMap = createSupplierMap(suppliers);
    const specialPriceMap = createSpecialPriceMap(products);

    const filteredArticleNumbers = getFilteredArticleNumbers(stock, search);
    const grouped = groupByArticleAndColor(stock, filteredArticleNumbers);

    const results = [];
    const existingSizes = {}; // Für Duplikat-Kontrolle

    let dummyId = 3000000; // Dummy-ID für fehlende Größen

    for (const groupKey in grouped) {
        if (!grouped.hasOwnProperty(groupKey)) {
            continue;
        }

        const group = grouped[groupKey];
        const artikelNr = group.artikelNr;
        const farbe = group.farbe;

        // 1. Alle stock-Einträge für diese Kombi abarbeiten (wie gehabt)
        for (let i = 0; i < stock.length; i++) {
            const entry = stock[i];

            if (String(entry.ArtikelNr) === artikelNr && entry.Farbe === farbe) {
                let sizeIndex = 0;

                // Index der Größe aus den Sizes raussuchen
                for (let j = 0; j < sizes.length; j++) {
                    const sizeEntry = sizes[j];
                    if (sizeEntry.ReferenzNr && sizeEntry.ReferenzNr.trim() === String(entry.ReferenzNr).trim()) {
                        sizeIndex = parseInt(sizeEntry.Index);
                        break;
                    }
                }

                const vatRate = parseInt(entry.MWSt) === 1 ? 0.07 : 0.19;
                const sizeLabel = entry.groesse;

                const productEntry = {
                    unique_id: entry.IdentNr,
                    product_id: group.modell_code,
                    name: group.modell,
                    color_code: group.color_code,
                    color: group.farbe,
                    supplier_id: parseInt(group.lieferantNr),
                    supplier: supplierMap.get(String(group.lieferantNr)) || 'Unknown',
                    manufacturer: group.lieferant,
                    size: sizeLabel,
                    size_range: "", // Baust du wie gehabt, wenn du willst
                    stock: parseFloat(entry.Bestand) || 0,
                    index: sizeIndex,
                    real_ek: parseFloat(entry.EK) || null,
                    list_ek: parseFloat(entry.Preis),
                    discount1: parseFloat(entry.Rabatt1),
                    discount2: parseFloat(entry.Rabatt2),
                    list_vk: parseFloat(entry.VK),
                    special_price: specialPriceMap.get(artikelNr) || null,
                    vat: vatRate
                };

                results.push(productEntry);
                existingSizes[artikelNr + '|' + farbe + '|' + sizeLabel] = true;
            }
        }

        // 2. Eine Stock-Vorlage für Dummy-Größen bereithalten (für Preise etc.)
        let templateStockEntry = null;
        for (let i = 0; i < stock.length; i++) {
            if (
                String(stock[i].ArtikelNr) === artikelNr &&
                stock[i].Farbe === farbe
            ) {
                templateStockEntry = stock[i];
                break;
            }
        }


        // 3. Jetzt alle Sizes prüfen, ob sie im Stock-Ergebnis fehlen!
        for (let j = 0; j < sizes.length; j++) {
            const sizeEntry = sizes[j];
            if (String(sizeEntry.ArtikelNr) === artikelNr) {
                const sizeLabel = sizeEntry.Größe;
                if (!existingSizes[artikelNr + '|' + farbe + '|' + sizeLabel]) {
                    results.push({
                        unique_id: dummyId,
                        product_id: group.modell_code,
                        name: group.modell,
                        color_code: group.color_code,
                        color: group.farbe,
                        supplier_id: parseInt(group.lieferantNr),
                        supplier: supplierMap.get(String(group.lieferantNr)) || 'Unknown',
                        manufacturer: group.lieferant,
                        size: sizeLabel,
                        size_range: "", // Optional
                        stock: 0,
                        index: parseInt(sizeEntry.Index),
                        real_ek: templateStockEntry ? parseFloat(templateStockEntry.EK) : null,
                        list_ek: templateStockEntry ? parseFloat(templateStockEntry.Preis) : null,
                        discount1: templateStockEntry ? parseFloat(templateStockEntry.Rabatt1) : null,
                        discount2: templateStockEntry ? parseFloat(templateStockEntry.Rabatt2) : null,
                        list_vk: templateStockEntry ? parseFloat(templateStockEntry.VK) : null,
                        special_price: specialPriceMap.get(artikelNr) || null,
                        vat: templateStockEntry ? (parseInt(templateStockEntry.MWSt) === 1 ? 0.07 : 0.19) : 0.19
                    });
                    existingSizes[artikelNr + '|' + farbe + '|' + sizeLabel] = true;
                    dummyId++; // Erhöhe für jeden Dummy!
                }
            }
        }
    }

    // Optional: Nach Suchbegriff filtern (wie gehabt)
    const finalResults = [];
    if (search.trim().length > 0) {
        const lowerSearch = search.toLowerCase();

        for (let i = 0; i < results.length; i++) {
            if (results[i].name && results[i].name.toLowerCase().includes(lowerSearch)) {
                finalResults.push(results[i]);
            }
        }
    } else {
        for (let i = 0; i < results.length; i++) {
            finalResults.push(results[i]);
        }
    }

    return {
        total: results.length,
        items: finalResults
    };
};
