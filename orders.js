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
            manufacturer: entry.Hersteller,
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
                    manufacturer: entry.Hersteller,
                    size: sizeLabel,
                    stock: 0,
                    index: parseInt(sizeEntry.Index),
                    real_ek: parseFloat(entry.EK).toFixed(2) || null,
                    list_ek: productInfoMap[artikelNr]?.ek,
                    list_vk: productInfoMap[artikelNr]?.vk,
                    special_price: specialPriceMap.get(artikelNr) || null,
                    vat: parseInt(entry.MWSt) === 1 ? 7 : 19,
                    vpe: productInfoMap[artikelNr]?.vpe,
                    warengruppeNr: productInfoMap[artikelNr]?.warengruppeNr,
                    vkRabattMax: productInfoMap[artikelNr]?.vkRabattMax,
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
            supplier: supplierMap.get(String(order.Lieferant)) || 'Unknown',
            manufacturer: productCSV.Hersteller || '',
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


    // --- Filter ---
    let finalResults = results;

    if (order_nr && typeof order_nr === 'string' && order_nr.trim().length > 0) {
        finalResults = finalResults.filter(r => String(r.order_nr) === String(order_nr));
    } else if (search && typeof search === 'string' && search.trim().length > 0) {
        const lowerSearch = search.toLowerCase();
        finalResults = finalResults.filter(r => r.name && r.name.toLowerCase().includes(lowerSearch));
    }

    return {
        total: finalResults.length,
        items: finalResults
    };
};
