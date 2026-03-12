const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

const app = express();
app.use(cors());


app.get('/api/parcels', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        idu,
        code_dep,
        code_com,
        nom_com,
        section,
        numero,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry
      FROM parcelles_02
      LIMIT 500;   -- small limit for first test
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});