const express = require('express');
const cors = require('cors');
const analyse = require('./analyse');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/produkte', async (req, res) => {
  const search = req.query.search || ''; // ⬅️ NEU: Query auslesen
  try {
    const result = await analyse(search); // ⬅️ NEU: an analyse() übergeben
    res.json(result);
  } catch (err) {
    console.error('Fehler bei Analyse:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
