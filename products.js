
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

/**
 * Reads a CSV file and returns its content as an array of objects.
 * Uses 'latin1' encoding to handle special characters correctly (like German umlauts).
 * 
 * @param {string} filePath - The absolute or relative path to the CSV file.
 * @returns {Array<Object>} - An array of parsed objects representing CSV rows.
 */
function readCSV(filePath) {
    const fileContent = fs.readFileSync(filePath, 'latin1');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    return parsed.data;
}

/**
 * Loads stock data from a CSV file and applies initial filters:
 * - Only include products with a stock (Bestand) of at least 1
 * - Exclude service items (model name starts with 'service')
 * 
 * @returns {Array<Object>} - Filtered stock entries
 */
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

/**
 * Creates a mapping of supplier number to supplier name.
 * 
 * @param {Array<Object>} suppliers - Supplier records from CSV
 * @returns {Map<string, string>} - Map with supplier number as key and supplier name as value
 */
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

/**
 * Creates a mapping of article number to special price.
 * 
 * @param {Array<Object>} products - Product records from CSV
 * @returns {Map<string, string>} - Map of article number to special price
 */
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

/**
 * Groups stock entries by article number and color.
 * Each combination of article number and color is treated as a unique product variant.
 * 
 * @param {Array<Object>} stock - Filtered stock entries
 * @param {Set<string>} validArticles - Set of article numbers that are allowed (after filtering by search term)
 * @returns {Object} - Grouped stock objects indexed by "articleNumber|color"
 */
function groupByArticleAndColor(stock, validArticles) {
    const grouped = {};

    for (let i = 0; i < stock.length; i++) {
        const entry = stock[i];
        const articleNumber = String(entry.ArtikelNr);

        // Skip if article number is not in the allowed set
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

/**
 * Filters the article numbers based on an optional search term.
 * If no search term is provided, all article numbers are returned.
 * 
 * @param {Array<Object>} stock - The stock data to search in
 * @param {string} search - The search string to filter model names
 * @returns {Set<string>} - A set of article numbers matching the search term or all if empty
 */
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

/**
 * Main function to collect and transform product data from multiple CSV files.
 * Performs filtering, grouping, and formatting for frontend or export usage.
 * 
 * @param {string} search - Optional search string to filter by model name
 * @returns {Promise<Object>} - Object containing `total` count and filtered `items` array
 */
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

    // Iterate through each article-color combination
    for (const groupKey in grouped) {
        if (!grouped.hasOwnProperty(groupKey)) {
            continue;
        }

        const group = grouped[groupKey];

        const artikelNr = group.artikelNr;
        const farbe = group.farbe;

        const relevantSizes = [];

        for (let i = 0; i < sizes.length; i++) {
            if (String(sizes[i].ArtikelNr) === artikelNr) {
                relevantSizes.push(sizes[i]);
            }
        }

        // Sort sizes by Index field (numeric)
        relevantSizes.sort(function(a, b) {
            return parseInt(a.Index) - parseInt(b.Index);
        });

        const allSizeLabels = [];

        for (let i = 0; i < relevantSizes.length; i++) {
            if (relevantSizes[i].groesse) {
                allSizeLabels.push(relevantSizes[i].groesse);
            }
        }

        let sizeRange = '';

        if (allSizeLabels.length > 1) {
            sizeRange = allSizeLabels[0] + ' - ' + allSizeLabels[allSizeLabels.length - 1];
        } else if (allSizeLabels.length === 1) {
            sizeRange = allSizeLabels[0];
        }

        const groupResults = [];
        const stockedSizes = new Set();

        // Now get all matching stock entries for this group (article + color)
        for (let i = 0; i < stock.length; i++) {
            const entry = stock[i];

            if (String(entry.ArtikelNr) === artikelNr && entry.Farbe === farbe) {
                const referenzNr = entry.ReferenzNr ? entry.ReferenzNr.trim() : '';
                let sizeIndex = 0;

                for (let j = 0; j < sizes.length; j++) {
                    const sizeEntry = sizes[j];
                    if (sizeEntry.ReferenzNr && sizeEntry.ReferenzNr.trim() === referenzNr) {
                        sizeIndex = parseInt(sizeEntry.Index);
                        break;
                    }
                }

                const vatRate = parseInt(entry.MWSt) === 1 ? 0.07 : 0.19;

                const productEntry = {
                    unique_id: entry.IdentNr,
                    product_id: group.modell_code,
                    name: group.modell,
                    color_code: group.color_code,
                    color: group.farbe,
                    supplier_id: parseInt(group.lieferantNr),
                    supplier: supplierMap.get(String(group.lieferantNr)) || 'Unknown',
                    manufacturer: group.lieferant,
                    size: entry.groesse,
                    size_range: sizeRange,
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

                groupResults.push(productEntry);
                stockedSizes.add(entry.groesse);
            }
        }

        // Attach missing sizes from product-sizes.csv with stock 0
        for (let i = 0; i < relevantSizes.length; i++) {
            const sizeEntry = relevantSizes[i];
            const sizeLabel = sizeEntry.groesse;

            if (sizeLabel && !stockedSizes.has(sizeLabel)) {
                const vatRate = parseInt(group.mwst) === 1 ? 0.07 : 0.19;

                const productEntry = {
                    unique_id: null,
                    product_id: group.modell_code,
                    name: group.modell,
                    color_code: group.color_code,
                    color: group.farbe,
                    supplier_id: parseInt(group.lieferantNr),
                    supplier: supplierMap.get(String(group.lieferantNr)) || 'Unknown',
                    manufacturer: group.lieferant,
                    size: sizeLabel,
                    size_range: sizeRange,
                    stock: 0,
                    index: parseInt(sizeEntry.Index),
                    real_ek: null,
                    list_ek: parseFloat(group.preis),
                    discount1: parseFloat(group.rabatt1),
                    discount2: parseFloat(group.rabatt2),
                    list_vk: parseFloat(group.vk),
                    special_price: specialPriceMap.get(artikelNr) || null,
                    vat: vatRate
                };

                groupResults.push(productEntry);
            }
        }

        // Sort results for this group by size index before pushing
        groupResults.sort(function(a, b) {
            return a.index - b.index;
        });

        for (let i = 0; i < groupResults.length; i++) {
            results.push(groupResults[i]);
        }
    }

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
