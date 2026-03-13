const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

const app = express();
app.use(cors());

// Static frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Helpers
function rowsToFeatureCollection(rows) {
  const features = rows.map((row) => ({
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

  return {
    type: 'FeatureCollection',
    features,
  };
}

async function fetchSireneFromInsee(siren, apiKey) {
  const response = await fetch(
    `https://api.insee.fr/entreprises/sirene/V3.11/unitesLegales/${siren}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    }
  );

  return response;
}

// Parcels polygons
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
      LIMIT 500;
    `);

    res.json(rowsToFeatureCollection(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Sirene proxy endpoint (INSEE API)
app.get('/api/sirene/:siren', async (req, res) => {
  const siren = req.params.siren;
  const apiKey = process.env.SIRENE_API_TOKEN;

  if (!apiKey) {
    return res
      .status(500)
      .json({ error: 'Missing SIRENE_API_TOKEN in backend .env' });
  }

  if (!siren || siren.length !== 9 || !/^\d{9}$/.test(siren)) {
    return res.status(400).json({ error: 'Invalid SIREN format (9 digits)' });
  }

  try {
    const response = await fetchSireneFromInsee(siren, apiKey);

    if (response.status === 404) {
      return res
        .status(404)
        .json({ error: 'SIREN not found in Sirene database' });
    }

    if (response.status === 401) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: check Sirene API token' });
    }

    if (!response.ok) {
      throw new Error(`Sirene API returned ${response.status}`);
    }

    const data = await response.json();
    const ul = data.uniteLegale?.periodesUniteLegale?.[0] || {};

    res.json({
      siren,
      company: ul.denominationUniteLegale || 'N/A',
      legalForm: ul.categorieJuridiqueUniteLegale || 'N/A',
      address: ul.adresseEtablissement?.libelleVoieEtablissement || 'N/A',
      postalCode: ul.adresseEtablissement?.codePostalEtablissement || 'N/A',
      city: ul.adresseEtablissement?.libelleCommuneEtablissement || 'N/A',
      creationDate: ul.dateCreationUniteLegale || 'N/A',
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'Failed to fetch Sirene data: ' + err.message });
  }
});

// Parcels centroids (points)
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
      LIMIT 500;
    `);

    res.json(rowsToFeatureCollection(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server (frontend + API) running at http://localhost:${port}`);
});