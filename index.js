const express = require('express');
const cors = require('cors');
const products = require('./products');
const customers = require('./customers');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/produkte', async (req, res) => {
  const search = req.query.search || ''; // ⬅️ NEU: Query auslesen
  try {
    const result = await products(search); // ⬅️ NEU: an analyse() übergeben
    res.json(result);
  } catch (err) {
    console.error('Fehler bei Products:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.get('/api/customers', async (req, res) => {
  const search = req.query.search || ''; // ⬅️ NEU: Query auslesen
  try {
    const result = await customers(search); // ⬅️ NEU: an analyse() übergeben
    res.json(result);
  } catch (err) {
    console.error('Fehler bei Customers:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
