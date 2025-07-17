const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

function parseGermanDate(dateStr) {
    // Accepts DD.MM.YYYY or DD.MM.YY or ISO-like YYYY-MM-DD HH:mm:ss
    if (!dateStr) return null;
    // If format is ISO-like (YYYY-MM-DD HH:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        // Remove time if present
        const dateOnly = dateStr.split(' ')[0];
        return new Date(dateOnly);
    }
    // Otherwise, try German format
    const parts = dateStr.split('.');
    if (parts.length < 3) return null;
    let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    return new Date(`${year}-${parts[1]}-${parts[0]}`);
}


function getAllBillingData(searchCustomerNr = '5213') {
    const sellingsFile = fs.readFileSync(path.join(__dirname, 'data/sellings.csv'), 'latin1');
    const customersFile = fs.readFileSync(path.join(__dirname, 'data/customers.csv'), 'latin1');
    const sellingDetailsFile = fs.readFileSync(path.join(__dirname, 'data/selling-details.csv'), 'latin1');
    const sellings = Papa.parse(sellingsFile, { header: true, skipEmptyLines: true }).data;
    const customers = Papa.parse(customersFile, { header: true, skipEmptyLines: true }).data;
    const sellingDetails = Papa.parse(sellingDetailsFile, { header: true, skipEmptyLines: true }).data;

    // Ensure searchCustomerNr is a string and log it
    searchCustomerNr = (searchCustomerNr === undefined || searchCustomerNr === null) ? '' : String(searchCustomerNr).trim();
    console.log(`getAllBillingData called with searchCustomerNr='${searchCustomerNr}'`);
    const now = new Date();
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

    // Only process sellings for the requested customerNr, filter by date only
    const threeYearsAgoDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    const filteredSellings = sellings.filter(entry => {
        const custNr = String(entry.Rechnungsadresse);
        if (custNr !== String(searchCustomerNr)) return false;
        if (!custNr || isNaN(custNr) || Number(custNr) < 1) return false;
        const sellingDate = parseGermanDate(entry.Zeit);
        if (!sellingDate || sellingDate <= threeYearsAgoDate) return false;
        return true;
    });

    // Build a Set of VerkaufNr for this customer
    const sellingNrSet = new Set(filteredSellings.map(entry => (entry.VerkäufeNr || '').toString().trim()));
    // Only process details for those VerkaufNr
    const filteredDetails = sellingDetails.filter(d => sellingNrSet.has((d.VerkäufeNr || '').toString().trim()));

    // Find full customer info from customers.csv
    const customerInfo = customers.find(c => String(c.KundeNr) === String(searchCustomerNr)) || {};
    if (!customerInfo.KundeNr) {
        console.log(`Customer with KundeNr ${searchCustomerNr} not found in customers.csv`);
    } else {
        console.log(`Customer found: ${JSON.stringify(customerInfo)}`);
    }
    console.log(`Sellings found for customerNr ${searchCustomerNr}: ${filteredSellings.length}`);
    filteredSellings.forEach(entry => {
        console.log(`Selling: VerkaufNr=${entry.VerkäufeNr}, Zeit=${entry.Zeit}`);
    });
    const result = {
        customerNr: String(searchCustomerNr),
        ...customerInfo,
        sellings: filteredSellings.map(entry => {
            const sellingNr = (entry.VerkäufeNr || '').toString().trim();
            const details = filteredDetails
                .filter(d => (d.VerkäufeNr || '').toString().trim() === sellingNr)
                .map(d => ({
                    Artikel: d.Artikel,
                    Größe: d.Größe,
                    ModellCode: d.ModellCode,
                    Nettopreis: d.Nettopreis,
                    Bruttopreis: d.Bruttopreis,
                    Rabatt1: d.Rabatt1,
                    Rabatt2: d.Rabatt2,
                    Nettosumme: d.Nettosumme,
                    Bruttosumme: d.Bruttosumme,
                    EK: d.EK,
                    VKRabattMax: d.VKRabattMax
                }));
            return {
                Nettowert: entry.Nettowert,
                Bruttowert: entry.Bruttowert,
                Rabatt: entry.Rabatt,
                Zeit: entry.Zeit,
                details
            };
        })
    };
    return [result];
}

// Example Express endpoint
module.exports = getAllBillingData;
