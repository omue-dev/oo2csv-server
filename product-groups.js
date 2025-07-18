const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

function getProductGroups() {
    const file = fs.readFileSync(path.join(__dirname, 'data/product_groups.csv'), 'latin1');
    const groups = Papa.parse(file, { header: true, skipEmptyLines: true }).data;
    // Only return the required fields
    return groups.map(g => ({
        WarengruppeNr: g.WarengruppeNr,
        Warengruppe: g.Warengruppe,
        Sortierung: parseInt(g.Sortierung) || 0, // Ensure Sortierung is a number, default to 0 if not present
    }));
}

module.exports = getProductGroups;
