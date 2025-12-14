const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// CONFIGURATION APIs
// ============================================
const API_ENTREPRISE = 'https://recherche-entreprises.api.gouv.fr/search';
const API_ADRESSE = 'https://api-adresse.data.gouv.fr/search';
const API_ITINERAIRE = 'https://wxs.ign.fr/calcul/geoportail/itineraire/rest/1.0.0/route';

// Rate limiting
const DELAY_BETWEEN_CALLS = 200; // ms entre chaque appel API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// FONCTIONS D'ENRICHISSEMENT
// ============================================

// Recherche entreprise par nom + CP
async function searchEntreprise(nom, codePostal) {
  try {
    const query = encodeURIComponent(`${nom} ${codePostal || ''}`);
    const url = `${API_ENTREPRISE}?q=${query}&per_page=1`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const entreprise = data.results[0];
    const siege = entreprise.siege || {};

    // Trouver le dirigeant
    let dirigeant = null;
    if (entreprise.dirigeants && entreprise.dirigeants.length > 0) {
      const dir = entreprise.dirigeants[0];
      if (dir.prenom && dir.nom) {
        dirigeant = `${dir.prenom} ${dir.nom}`;
      } else if (dir.denomination) {
        dirigeant = dir.denomination;
      }
    }

    // Mapper le code effectif vers label
    const effectifLabels = {
      'NN': 'Non renseigné',
      '00': '0 salarié',
      '01': '1-2 salariés',
      '02': '3-5 salariés',
      '03': '6-9 salariés',
      '11': '10-19 salariés',
      '12': '20-49 salariés',
      '21': '50-99 salariés',
      '22': '100-199 salariés',
      '31': '200-249 salariés',
      '32': '250-499 salariés',
      '41': '500-999 salariés',
      '42': '1000-1999 salariés',
      '51': '2000-4999 salariés',
      '52': '5000-9999 salariés',
      '53': '10000+ salariés',
    };

    const effectifCode = siege.tranche_effectif_salarie || entreprise.tranche_effectif_salarie || 'NN';

    return {
      siret: siege.siret || entreprise.siren,
      siren: entreprise.siren,
      code_naf: siege.activite_principale || entreprise.activite_principale,
      effectif_code: effectifCode,
      effectif_label: effectifLabels[effectifCode] || 'Non renseigné',
      dirigeant,
      date_creation_entreprise: entreprise.date_creation,
      adresse_enrichie: siege.adresse,
      code_postal_enrichi: siege.code_postal,
      ville_enrichie: siege.libelle_commune,
    };
  } catch (err) {
    console.error('Erreur API Entreprise:', err.message);
    return null;
  }
}

// Géocodage d'une adresse
async function geocodeAdresse(adresse, codePostal, ville) {
  try {
    const query = encodeURIComponent(`${adresse || ''} ${codePostal || ''} ${ville || ''}`);
    const url = `${API_ADRESSE}?q=${query}&limit=1`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const [lon, lat] = feature.geometry.coordinates;

    return {
      latitude: lat,
      longitude: lon,
      geo_status: 'success',
      adresse_normalisee: feature.properties.label,
      score_geocodage: feature.properties.score,
    };
  } catch (err) {
    console.error('Erreur API Adresse:', err.message);
    return { geo_status: 'error' };
  }
}

// Géocodage par code postal uniquement (centre commune)
async function geocodeCodePostal(codePostal) {
  try {
    const url = `${API_ADRESSE}?q=${codePostal}&type=municipality&limit=1`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const [lon, lat] = feature.geometry.coordinates;

    return {
      latitude: lat,
      longitude: lon,
      ville: feature.properties.city || feature.properties.name,
    };
  } catch (err) {
    console.error('Erreur geocodage CP:', err.message);
    return null;
  }
}

// Calcul itinéraire entre deux points
async function calculerItineraire(startLat, startLon, endLat, endLon) {
  try {
    const url = `${API_ITINERAIRE}?resource=bdtopo-osrm&profile=car&optimization=fastest&start=${startLon},${startLat}&end=${endLon},${endLat}&geometryFormat=geojson`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    return {
      distance_metres: Math.round(data.distance || 0),
      duree_secondes: Math.round(data.duration || 0),
      route_status: 'success',
    };
  } catch (err) {
    console.error('Erreur API Itinéraire:', err.message);
    return { route_status: 'error' };
  }
}

// ============================================
// ROUTES API
// ============================================

// GET /api/enrichment/status - Statut de l'enrichissement
router.get('/status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE siret IS NOT NULL) as avec_siret,
        COUNT(*) FILTER (WHERE effectif_code IS NOT NULL AND effectif_code != 'NN') as avec_effectif,
        COUNT(*) FILTER (WHERE latitude IS NOT NULL) as geocodes,
        COUNT(*) FILTER (WHERE duree_secondes IS NOT NULL) as avec_trajet,
        COUNT(*) FILTER (WHERE siret IS NULL AND latitude IS NULL) as a_enrichir
      FROM contacts
    `);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrichment/entreprise - Enrichir avec données entreprise
router.post('/entreprise', async (req, res) => {
  try {
    const { limit = 100, onlyMissing = true } = req.body;

    // Sélectionner les contacts à enrichir
    let whereClause = '1=1';
    if (onlyMissing) {
      whereClause = 'siret IS NULL OR effectif_code IS NULL OR effectif_code = \'NN\'';
    }

    const contactsResult = await db.query(`
      SELECT id, nom, adresse, code_postal, ville
      FROM contacts
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT $1
    `, [limit]);

    const contacts = contactsResult.rows;
    const results = {
      total: contacts.length,
      enriched: 0,
      not_found: 0,
      errors: 0,
    };

    for (const contact of contacts) {
      await sleep(DELAY_BETWEEN_CALLS);

      try {
        const data = await searchEntreprise(contact.nom, contact.code_postal);

        if (data) {
          await db.query(`
            UPDATE contacts SET
              siret = COALESCE($1, siret),
              siren = COALESCE($2, siren),
              code_naf = COALESCE($3, code_naf),
              effectif_code = COALESCE($4, effectif_code),
              effectif_label = COALESCE($5, effectif_label),
              dirigeant = COALESCE($6, dirigeant),
              date_creation_entreprise = COALESCE($7, date_creation_entreprise)
            WHERE id = $8
          `, [
            data.siret, data.siren, data.code_naf,
            data.effectif_code, data.effectif_label,
            data.dirigeant, data.date_creation_entreprise,
            contact.id
          ]);
          results.enriched++;
        } else {
          results.not_found++;
        }
      } catch (err) {
        console.error(`Erreur enrichissement ${contact.id}:`, err.message);
        results.errors++;
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrichment/geocode - Géocoder les contacts
router.post('/geocode', async (req, res) => {
  try {
    const { limit = 100, onlyMissing = true } = req.body;

    let whereClause = '1=1';
    if (onlyMissing) {
      whereClause = 'latitude IS NULL';
    }

    const contactsResult = await db.query(`
      SELECT id, adresse, code_postal, ville
      FROM contacts
      WHERE ${whereClause} AND code_postal IS NOT NULL
      ORDER BY id ASC
      LIMIT $1
    `, [limit]);

    const contacts = contactsResult.rows;
    const results = {
      total: contacts.length,
      geocoded: 0,
      not_found: 0,
      errors: 0,
    };

    for (const contact of contacts) {
      await sleep(DELAY_BETWEEN_CALLS);

      try {
        let data = await geocodeAdresse(contact.adresse, contact.code_postal, contact.ville);

        // Si pas trouvé avec adresse complète, essayer juste le CP
        if (!data || data.geo_status !== 'success') {
          data = await geocodeCodePostal(contact.code_postal);
          if (data) {
            data.geo_status = 'approximatif';
          }
        }

        if (data && data.latitude) {
          await db.query(`
            UPDATE contacts SET
              latitude = $1,
              longitude = $2,
              geo_status = $3
            WHERE id = $4
          `, [data.latitude, data.longitude, data.geo_status || 'success', contact.id]);
          results.geocoded++;
        } else {
          await db.query(`
            UPDATE contacts SET geo_status = 'not_found' WHERE id = $1
          `, [contact.id]);
          results.not_found++;
        }
      } catch (err) {
        console.error(`Erreur géocodage ${contact.id}:`, err.message);
        results.errors++;
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrichment/trajets - Calculer les temps de trajet
router.post('/trajets', async (req, res) => {
  try {
    const { limit = 100, startPostalCode, onlyMissing = true } = req.body;

    if (!startPostalCode) {
      return res.status(400).json({ error: 'startPostalCode requis' });
    }

    // Géocoder le point de départ
    const startGeo = await geocodeCodePostal(startPostalCode);
    if (!startGeo) {
      return res.status(400).json({ error: 'Impossible de géocoder le point de départ' });
    }

    // Sauvegarder le point de départ dans la config
    await db.query(`
      INSERT INTO config (key, value) VALUES ('start_point', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify({
      postalCode: startPostalCode,
      ville: startGeo.ville,
      lat: startGeo.latitude,
      lon: startGeo.longitude
    })]);

    let whereClause = 'latitude IS NOT NULL AND longitude IS NOT NULL';
    if (onlyMissing) {
      whereClause += ' AND duree_secondes IS NULL';
    }

    const contactsResult = await db.query(`
      SELECT id, latitude, longitude
      FROM contacts
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT $1
    `, [limit]);

    const contacts = contactsResult.rows;
    const results = {
      total: contacts.length,
      calculated: 0,
      errors: 0,
      startPoint: {
        postalCode: startPostalCode,
        ville: startGeo.ville,
      }
    };

    for (const contact of contacts) {
      await sleep(DELAY_BETWEEN_CALLS);

      try {
        const data = await calculerItineraire(
          startGeo.latitude, startGeo.longitude,
          contact.latitude, contact.longitude
        );

        if (data && data.route_status === 'success') {
          await db.query(`
            UPDATE contacts SET
              distance_metres = $1,
              duree_secondes = $2,
              route_status = 'success'
            WHERE id = $3
          `, [data.distance_metres, data.duree_secondes, contact.id]);
          results.calculated++;
        } else {
          await db.query(`
            UPDATE contacts SET route_status = 'error' WHERE id = $1
          `, [contact.id]);
          results.errors++;
        }
      } catch (err) {
        console.error(`Erreur trajet ${contact.id}:`, err.message);
        results.errors++;
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrichment/all - Enrichissement complet en une passe
router.post('/all', async (req, res) => {
  try {
    const { limit = 50, startPostalCode } = req.body;

    // Récupérer le point de départ
    let startGeo = null;
    if (startPostalCode) {
      startGeo = await geocodeCodePostal(startPostalCode);
    }

    // Sélectionner les contacts à enrichir
    const contactsResult = await db.query(`
      SELECT id, nom, adresse, code_postal, ville, siret, latitude
      FROM contacts
      WHERE siret IS NULL OR latitude IS NULL OR duree_secondes IS NULL
      ORDER BY id ASC
      LIMIT $1
    `, [limit]);

    const contacts = contactsResult.rows;
    const results = {
      total: contacts.length,
      entreprise: { enriched: 0, not_found: 0 },
      geocode: { geocoded: 0, not_found: 0 },
      trajets: { calculated: 0, errors: 0 },
    };

    for (const contact of contacts) {
      // 1. Enrichissement entreprise si manquant
      if (!contact.siret) {
        await sleep(DELAY_BETWEEN_CALLS);
        const entrepriseData = await searchEntreprise(contact.nom, contact.code_postal);

        if (entrepriseData) {
          await db.query(`
            UPDATE contacts SET
              siret = COALESCE($1, siret),
              siren = COALESCE($2, siren),
              code_naf = COALESCE($3, code_naf),
              effectif_code = COALESCE($4, effectif_code),
              effectif_label = COALESCE($5, effectif_label),
              dirigeant = COALESCE($6, dirigeant)
            WHERE id = $7
          `, [
            entrepriseData.siret, entrepriseData.siren, entrepriseData.code_naf,
            entrepriseData.effectif_code, entrepriseData.effectif_label,
            entrepriseData.dirigeant, contact.id
          ]);
          results.entreprise.enriched++;
        } else {
          results.entreprise.not_found++;
        }
      }

      // 2. Géocodage si manquant
      if (!contact.latitude && contact.code_postal) {
        await sleep(DELAY_BETWEEN_CALLS);
        let geoData = await geocodeAdresse(contact.adresse, contact.code_postal, contact.ville);

        if (!geoData || geoData.geo_status !== 'success') {
          geoData = await geocodeCodePostal(contact.code_postal);
          if (geoData) geoData.geo_status = 'approximatif';
        }

        if (geoData && geoData.latitude) {
          await db.query(`
            UPDATE contacts SET latitude = $1, longitude = $2, geo_status = $3 WHERE id = $4
          `, [geoData.latitude, geoData.longitude, geoData.geo_status || 'success', contact.id]);
          results.geocode.geocoded++;

          // Mettre à jour pour le calcul trajet
          contact.latitude = geoData.latitude;
          contact.longitude = geoData.longitude;
        } else {
          results.geocode.not_found++;
        }
      }

      // 3. Calcul trajet si point de départ fourni
      if (startGeo && contact.latitude && contact.longitude) {
        await sleep(DELAY_BETWEEN_CALLS);
        const trajetData = await calculerItineraire(
          startGeo.latitude, startGeo.longitude,
          contact.latitude, contact.longitude
        );

        if (trajetData && trajetData.route_status === 'success') {
          await db.query(`
            UPDATE contacts SET distance_metres = $1, duree_secondes = $2, route_status = 'success' WHERE id = $3
          `, [trajetData.distance_metres, trajetData.duree_secondes, contact.id]);
          results.trajets.calculated++;
        } else {
          results.trajets.errors++;
        }
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrichment/detect-activity - Détecter automatiquement le groupe d'activité
router.post('/detect-activity', async (req, res) => {
  try {
    // Par catégorie/nom
    const byCategory = await db.query(`
      UPDATE contacts c
      SET activity_group_id = (
        SELECT ag.id FROM activity_groups ag
        WHERE EXISTS (
          SELECT 1 FROM unnest(ag.mots_cles) AS mot
          WHERE LOWER(COALESCE(c.categorie, '') || ' ' || COALESCE(c.nom, '')) LIKE '%' || LOWER(mot) || '%'
        )
        ORDER BY ag.id
        LIMIT 1
      )
      WHERE c.activity_group_id IS NULL
      RETURNING id
    `);

    // Par code NAF
    const byNaf = await db.query(`
      UPDATE contacts c
      SET activity_group_id = (
        SELECT ag.id FROM activity_groups ag
        WHERE c.code_naf = ANY(ag.codes_naf)
        LIMIT 1
      )
      WHERE c.activity_group_id IS NULL AND c.code_naf IS NOT NULL
      RETURNING id
    `);

    res.json({
      success: true,
      results: {
        by_category: byCategory.rowCount,
        by_naf: byNaf.rowCount,
        total: byCategory.rowCount + byNaf.rowCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrichment/single/:id - Enrichir un contact spécifique
router.post('/single/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startPostalCode } = req.body;

    const contactResult = await db.query(
      'SELECT * FROM contacts WHERE id = $1 OR id_fiche = $1',
      [id]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact non trouvé' });
    }

    const contact = contactResult.rows[0];
    const updates = {};

    // 1. Enrichissement entreprise
    const entrepriseData = await searchEntreprise(contact.nom, contact.code_postal);
    if (entrepriseData) {
      Object.assign(updates, {
        siret: entrepriseData.siret,
        siren: entrepriseData.siren,
        code_naf: entrepriseData.code_naf,
        effectif_code: entrepriseData.effectif_code,
        effectif_label: entrepriseData.effectif_label,
        dirigeant: entrepriseData.dirigeant,
      });
    }

    await sleep(DELAY_BETWEEN_CALLS);

    // 2. Géocodage
    let geoData = await geocodeAdresse(contact.adresse, contact.code_postal, contact.ville);
    if (!geoData || geoData.geo_status !== 'success') {
      geoData = await geocodeCodePostal(contact.code_postal);
      if (geoData) geoData.geo_status = 'approximatif';
    }

    if (geoData && geoData.latitude) {
      updates.latitude = geoData.latitude;
      updates.longitude = geoData.longitude;
      updates.geo_status = geoData.geo_status;

      // 3. Calcul trajet
      if (startPostalCode) {
        await sleep(DELAY_BETWEEN_CALLS);
        const startGeo = await geocodeCodePostal(startPostalCode);

        if (startGeo) {
          await sleep(DELAY_BETWEEN_CALLS);
          const trajetData = await calculerItineraire(
            startGeo.latitude, startGeo.longitude,
            geoData.latitude, geoData.longitude
          );

          if (trajetData && trajetData.route_status === 'success') {
            updates.distance_metres = trajetData.distance_metres;
            updates.duree_secondes = trajetData.duree_secondes;
            updates.route_status = 'success';
          }
        }
      }
    }

    // Appliquer les updates
    if (Object.keys(updates).length > 0) {
      const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
      const values = Object.values(updates);
      values.push(contact.id);

      await db.query(
        `UPDATE contacts SET ${fields} WHERE id = $${values.length}`,
        values
      );
    }

    // Retourner le contact mis à jour
    const updatedResult = await db.query('SELECT * FROM contacts WHERE id = $1', [contact.id]);

    res.json({
      success: true,
      contact: updatedResult.rows[0],
      enriched: updates
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/enrichment/preview - Aperçu avant enrichissement
router.get('/preview', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await db.query(`
      SELECT id, id_fiche, nom, adresse, code_postal, ville, siret, latitude, duree_secondes
      FROM contacts
      WHERE siret IS NULL OR latitude IS NULL
      ORDER BY created_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
