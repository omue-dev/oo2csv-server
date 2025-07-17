const express = require('express');
const cors = require('cors');
const products = require('./products');
const customers = require('./customers');
const billing = require('./account_billing');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/produkte', async (req, res) => {
  const search = req.query.search || ''; 
  try {
    const result = await products(search); 
    res.json(result);
  } catch (err) {
    console.error('Fehler bei Products:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.get('/api/customers', async (req, res) => {
  const search = req.query.search || ''; // 
  try {
    const result = await customers(search); // 
    res.json(result);
  } catch (err) {
    console.error('Fehler bei Customers:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.get('/api/account-billing', async (req, res) => {
  const customerNr = req.query.customerNr || '';
  try {
    const result = await billing(customerNr);
    res.json(result);
  } catch (err) {
    console.error('Fehler bei Billing:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
