
const express = require('express');
const cors = require('cors');
const products = require('./products');
const customers = require('./customers');
const billing = require('./account_billing');
const productGroups = require('./product-groups');
const orders = require('./orders');



const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/product-groups', (req, res) => {
  try {
    const result = productGroups();
    res.json(result);
  } catch (err) {
    console.error('Fehler bei ProductGroups:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});


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

// index.js:
app.get('/api/orders', async (req, res) => {
  const search = req.query.search || "";
  const order_nr = req.query.order_nr || "";
  try {
    const result = await orders({ search, order_nr }); // <-- Aufruf als Objekt!
    res.json(result);
  } catch (err) {
    console.error('Fehler bei OrderProducts:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});



app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
