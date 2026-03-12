const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

const app = express();
app.use(cors());

// Serve the frontend (static files) from the frontend folder
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

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

    // Convert rows into proper GeoJSON FeatureCollection
    const features = result.rows.map((row) => ({
      type: 'Feature',
      geometry: JSON.parse(row.geometry),
      properties: {
        idu: row.idu,
        code_dep: row.code_dep,
        code_com: row.code_com,
        nom_com: row.nom_com,
        section: row.section,
        numero: row.numero,
      },
    }));

    res.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Alternative view: parcel centroids as points (for pin markers)
app.get('/api/parcels-points', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        idu,
        code_dep,
        code_com,
        nom_com,
        section,
        numero,
        ST_AsGeoJSON(ST_Centroid(ST_Transform(geom, 4326))) AS geometry
      FROM parcelles_02
      LIMIT 500;   -- small limit for first test
    `);

    const features = result.rows.map((row) => ({
      type: 'Feature',
      geometry: JSON.parse(row.geometry),
      properties: {
        idu: row.idu,
        code_dep: row.code_dep,
        code_com: row.code_com,
        nom_com: row.nom_com,
        section: row.section,
        numero: row.numero,
      },
    }));

    res.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server (frontend + API) running at http://localhost:${port}`);
});