// cache.js
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Hilfsfunktion zum Einlesen einer CSV
function readCSV(filePath) {
    const fileContent = fs.readFileSync(filePath, 'latin1');
    return Papa.parse(fileContent, { header: true, skipEmptyLines: true }).data;
}

// Hier werden die Daten geladen (einmal beim Serverstart!)
const cache = {
    stock: readCSV(path.join(__dirname, 'data/product-stocks.csv')),
    products: readCSV(path.join(__dirname, 'data/products.csv')),
    suppliers: readCSV(path.join(__dirname, 'data/supplier.csv')),
    sizes: readCSV(path.join(__dirname, 'data/product-sizes.csv')),
    orders: readCSV(path.join(__dirname, 'data/orders.csv')),
    orderDetails: readCSV(path.join(__dirname, 'data/orders_details.csv')),
};

module.exports = cache;
