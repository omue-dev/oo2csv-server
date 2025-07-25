// orders.js
const cache = require('./cache'); // Holt sich alle Daten aus dem RAM!

function createSupplierMap(suppliers) {
    const map = new Map();
    for (const entry of suppliers) {
        map.set(String(entry.LieferantNr), entry.Lieferant);
    }
    return map;
}

function createSpecialPriceMap(products) {
    const map = new Map();
    for (const product of products) {
        const articleNumber = String(product.ArtikelNr);
        map.set(articleNumber, product.Sonderpreis);
    }
    return map;
}

module.exports = async function getProducts({ search = "", order_nr = "" }) {
    // CSVs kommen jetzt aus dem Cache!
    let results = [];
    let comboMap = new Map();

    const { stock, products, suppliers, sizes, orders, orderDetails } = cache;

    // Maps
    const supplierMap = createSupplierMap(suppliers);
    const specialPriceMap = createSpecialPriceMap(products);

    const productInfoMap = {};
    for (const p of products) {
        const artikelNr = String(p.ArtikelNr);
        productInfoMap[artikelNr] = {
            vpe: p.VPE ? parseInt(p.VPE) : null,
            warengruppeNr: p.WarengruppeNr ? String(p.WarengruppeNr) : null,
            vkRabattMax: p.VKRabattMax ? parseFloat(p.VKRabattMax) : null,
            ek: p.EK ? parseFloat(p.EK).toFixed(2) : null,
            vk: p.VK ? parseFloat(p.VK).toFixed(2) : null,
        };
    }

    // STOCK filtern
    const filteredStock = [];
    for (const entry of stock) {
        const stockQuantity = parseFloat(entry.Bestand);
        const isService = typeof entry.Modell === 'string' && entry.Modell.toLowerCase().startsWith('service');
        if (stockQuantity >= 1 && !isService) {
            filteredStock.push(entry);
        }
    }

    let dummyId = 3000000;

    // STOCK-Produkte + Dummys
    for (const entry of filteredStock) {
        const artikelNr = String(entry.ArtikelNr).trim();
        const farbe = (entry.Farbe || '').trim();
        const color_code = (entry.FarbeCode || '').trim();
        const sizeLabel = (entry.groesse || '-').trim();
        const comboKey = `${artikelNr}|${color_code}|${sizeLabel}`;
        const productCSV = products.find(p => String(p.ArtikelNr) === artikelNr) || {};
        const productInfos = productInfoMap[artikelNr] || {};

        let sizeIndex = 0;
        const sizeEntry = sizes.find(
            s => String(s.ArtikelNr) === artikelNr && (s.Größe === sizeLabel)
        );
        if (sizeEntry) sizeIndex = parseInt(sizeEntry.Index);

        const vatRate = parseInt(entry.MWSt) === 1 ? 7 : 19;

        const obj = {
            unique_id: entry.IdentNr,
            product_id: artikelNr,
            name: entry.Modell,
            color_code: color_code,
            color: farbe,
            supplier_id: parseInt(entry.LieferantNr),
            supplier: supplierMap.get(String(entry.LieferantNr)) || 'Unknown',
            manufacturer: (productCSV.Hersteller || ''),
            size: sizeLabel,
            stock: parseFloat(entry.Bestand) || 0,
            index: sizeIndex,
            real_ek: parseFloat(entry.EK).toFixed(2) || null,
            list_ek: productInfos.ek,
            list_vk: productInfos.vk,
            special_price: specialPriceMap.get(artikelNr) || null,
            vat: vatRate,
            vpe: productInfos.vpe,
            warengruppeNr: productInfos.warengruppeNr,
            vkRabattMax: productInfos.vkRabattMax,
            kunde: entry.Kunde || null,
            order_nr: null,
            order_date: null,
            delivery_date: null,
            order_quantity: 0,
            order_discounts_first: null,
            order_discounts_second: null
        };
        results.push(obj);
        comboMap.set(comboKey, obj);
    }

    // Dummy-Größen
    for (const entry of filteredStock) {
        const artikelNr = String(entry.ArtikelNr).trim();
        const farbe = (entry.Farbe || '').trim();
        const color_code = (entry.FarbeCode || '').trim();
        const possibleSizes = sizes.filter(s => String(s.ArtikelNr) === artikelNr);
        const productCSV = products.find(p => String(p.ArtikelNr) === artikelNr) || {};
        const productInfos = productInfoMap[artikelNr] || {};

        for (const sizeEntry of possibleSizes) {
            const sizeLabel = (sizeEntry.Größe || '-').trim();
            const comboKey = `${artikelNr}|${color_code}|${sizeLabel}`;
            if (!comboMap.has(comboKey)) {
                const obj = {
                    unique_id: dummyId++,
                    product_id: artikelNr,
                    name: entry.Modell,
                    color_code: color_code,
                    color: farbe,
                    supplier_id: parseInt(entry.LieferantNr),
                    supplier: supplierMap.get(String(entry.LieferantNr)) || 'Unknown',
                    manufacturer: (productCSV.Hersteller || ''),
                    size: sizeLabel,
                    stock: 0,
                    index: parseInt(sizeEntry.Index),
                    real_ek: parseFloat(entry.EK).toFixed(2) || null,
                    list_ek: productInfos.ek,
                    list_vk: productInfos.vk,
                    special_price: specialPriceMap.get(artikelNr) || null,
                    vat: parseInt(entry.MWSt) === 1 ? 7 : 19,
                    vpe: productInfos.vpe,
                    warengruppeNr: productInfos.warengruppeNr,
                    vkRabattMax: productInfos.vkRabattMax,
                    kunde: entry.Kunde || null,
                    order_nr: null,
                    order_date: null,
                    delivery_date: null,
                    order_quantity: 0,
                    order_discounts_first: null,
                    order_discounts_second: null
                };
                results.push(obj);
                comboMap.set(comboKey, obj);
            }
        }
    }

    // Orders, die noch NICHT in results sind
    for (const order of orders) {
        if (!order.Bestellt || order.Bestellt.trim() === "") continue;
        const artikelNr = String(order.Artikel).trim();
        const farbe = (order.Farbe || '').trim().toLowerCase();
        const sizeLabel = (order.Größe || '-').trim();

        // Details zur Order raussuchen (brauchst du eh für alles)
        const details = orderDetails.find(
            d => d.BestellprotokollNr === order.BestellprotokollNr && (d.Größe === sizeLabel)
        );

        // 1. Farbcode direkt aus Order
        let color_code = (order.FarbeCode || '').trim();

        // 2. Wenn leer, aus Stock per Farbe ziehen
        if (!color_code && farbe) {
            const stockEntry = stock.find(
                s =>
                    String(s.ArtikelNr).trim() === artikelNr &&
                    (s.Farbe || '').trim().toLowerCase() === farbe
            );
            if (stockEntry) {
                color_code = (stockEntry.FarbeCode || '').trim();
            }
        }

        // 3. Wenn IMMER noch leer, aus LiefArtikelNr extrahieren!
        if (!color_code && details && details.LiefArtikelNr) {
            // Format: "ArtikelNr-Farbcode-Größe" => 123456-010-M
            const parts = details.LiefArtikelNr.split('-');
            if (parts.length >= 2) {
                color_code = parts[1].trim();
            }
        }

        const comboKey = `${artikelNr}|${color_code}|${sizeLabel}`;

        const productCSV = products.find(p => String(p.ArtikelNr) === artikelNr) || {};
        const productInfos = productInfoMap[artikelNr] || {};

        if (comboMap.has(comboKey)) {
            const obj = comboMap.get(comboKey);
            obj.order_nr = order.BestellprotokollNr || null;
            obj.order_date = order.Bestellt ? order.Bestellt.split(" ")[0] : null;
            obj.delivery_date = details && details.Liefertermin ? details.Liefertermin : null;
            obj.order_quantity = details && details.Bestellmenge ? parseFloat(details.Bestellmenge) : (order.Bestellmenge ? parseFloat(order.Bestellmenge) : 0);
            obj.order_discounts_first = order.Rabatt1 ? parseFloat(order.Rabatt1) * 100 : null;
            obj.order_discounts_second = order.Rabatt2 ? parseFloat(order.Rabatt2) * 100 : null;
            obj.kunde = order.Kunde || obj.kunde;
            continue;
        }

        const obj = {
            unique_id: dummyId++,
            product_id: artikelNr,
            name: order.Modell,
            color_code: color_code,
            color: order.Farbe || '',
            supplier_id: parseInt(order.Lieferant),
            supplier: supplierMap.get(String(order.Lieferant)) || '',
            manufacturer: (productCSV.Hersteller || ''),
            size: sizeLabel,
            stock: 0,
            index: sizes.find(s => String(s.ArtikelNr) === artikelNr && (s.Größe === sizeLabel))?.Index || 0,
            real_ek: 0,
            list_ek: productInfos.ek,
            list_vk: productInfos.vk,
            special_price: specialPriceMap.get(artikelNr) || null,
            vat: 19,
            vpe: productInfos.vpe,
            warengruppeNr: productInfos.warengruppeNr,
            vkRabattMax: productInfos.vkRabattMax,
            kunde: order.Kunde || null,
            order_nr: order.BestellprotokollNr || null,
            order_date: order.Bestellt ? order.Bestellt.split(" ")[0] : null,
            delivery_date: details && details.Liefertermin ? details.Liefertermin : null,
            order_quantity: details && details.Bestellmenge ? parseFloat(details.Bestellmenge) : (order.Bestellmenge ? parseFloat(order.Bestellmenge) : 0),
            order_discounts_first: order.Rabatt1 ? parseFloat(order.Rabatt1) * 100 : null,
            order_discounts_second: order.Rabatt2 ? parseFloat(order.Rabatt2) * 100 : null
        };
        results.push(obj);
        comboMap.set(comboKey, obj);
    }

    // Füge fehlende Größen dem Größenlauf hinzu
    // 1. Sammle alle Kombis (ArtikelNr + Farbcode) aus den Ergebnissen
    const combo2Set = new Set();
    for (const x of results) {
    combo2Set.add(`${x.product_id}|${x.color_code}`);
    }

    // 2. Alle schon vorhandenen (ArtikelNr|Farbcode|Größe) als Set
    const combo3Set = new Set();
    for (const x of results) {
    combo3Set.add(`${x.product_id}|${x.color_code}|${(x.size || '-').trim()}`);
    }

    // 3. Jetzt ALLE Größen für jede Kombi checken!
    for (const combo2 of combo2Set) {
        const [artikelNr, color_code] = combo2.split('|');
        // Alle Größen für diesen Artikel laut sizes.csv
        const alleGroessen = sizes
            .filter(s => String(s.ArtikelNr) === artikelNr)
            .map(s => (s.Größe || '-').trim());

        for (const sizeLabel of alleGroessen) {
            const combo3 = `${artikelNr}|${color_code}|${sizeLabel}`;
            if (!combo3Set.has(combo3)) {
            // Dummy erzeugen, Werte z.B. von existierender Zeile mit dieser Kombi klauen
            const referenz = results.find(x => x.product_id === artikelNr && x.color_code === color_code) || {};
            const sizeEntry = sizes.find(
                s => String(s.ArtikelNr) === artikelNr && (s.Größe || '-').trim() === sizeLabel
            );
            const productInfos = productInfoMap[artikelNr] || {};
            results.push({
                unique_id: dummyId++,
                product_id: artikelNr,
                name: referenz.name || '',
                color_code: color_code,
                color: referenz.color || '',
                supplier_id: referenz.supplier_id || null,
                supplier: referenz.supplier || '',
                manufacturer: referenz.manufacturer || '',
                size: sizeLabel,
                stock: 0,
                index: sizeEntry ? parseInt(sizeEntry.Index) : 0,
                real_ek: referenz.real_ek || 0,
                list_ek: productInfos.ek,
                list_vk: productInfos.vk,
                special_price: specialPriceMap.get(artikelNr) || null,
                vat: referenz.vat || 19,
                vpe: productInfos.vpe,
                warengruppeNr: productInfos.warengruppeNr,
                vkRabattMax: productInfos.vkRabattMax,
                kunde: null,
                order_nr: null,
                order_date: null,
                delivery_date: null,
                order_quantity: 0,
                order_discounts_first: null,
                order_discounts_second: null
            });
            combo3Set.add(combo3);
            }
        }
    }


    // --- Filter ---
    let finalResults = results;

    if (order_nr && typeof order_nr === 'string' && order_nr.trim().length > 0) {
        finalResults = finalResults.filter(r => String(r.order_nr) === String(order_nr));
    } else if (search && typeof search === 'string' && search.trim().length > 0) {
        const lowerSearch = search.toLowerCase();
        finalResults = finalResults.filter(r => r.name && r.name.toLowerCase().includes(lowerSearch));
    }

    // Sortierung: Hersteller ASC, Name ASC, Index ASC, Color Code ASC
    finalResults.sort((a, b) => {
        const manuA = (a.manufacturer || '').toLowerCase();
        const manuB = (b.manufacturer || '').toLowerCase();
        if (manuA < manuB) return -1;
        if (manuA > manuB) return 1;

        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;

        // Jetzt schon color_code vergleichen
        const colorA = a.color_code;
        const colorB = b.color_code;

        const numA = parseFloat(colorA);
        const numB = parseFloat(colorB);
        const isNumA = !isNaN(numA);
        const isNumB = !isNaN(numB);

        if (isNumA && isNumB) {
            if (numA !== numB) return numA - numB;
        } else {
            const strA = (colorA || '').toString().toLowerCase();
            const strB = (colorB || '').toString().toLowerCase();
            if (strA < strB) return -1;
            if (strA > strB) return 1;
        }

        // Erst danach Index berücksichtigen
        const indexA = a.index || 0;
        const indexB = b.index || 0;
        return indexA - indexB;
    });



    return {
        total: finalResults.length,
        items: finalResults
    };
};
