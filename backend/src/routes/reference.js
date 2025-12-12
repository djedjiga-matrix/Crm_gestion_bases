const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reference/regions - Liste des régions
router.get('/regions', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM regions ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/departements - Liste des départements
router.get('/departements', async (req, res) => {
  try {
    const { region, actifOnly } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (region) {
      whereClause += ' AND region_code = $1';
      params.push(region);
    }
    
    if (actifOnly === 'true') {
      whereClause += ' AND actif = true';
    }
    
    const result = await db.query(`
      SELECT d.*, r.nom as region_nom,
        (SELECT COUNT(*) FROM contacts c WHERE c.departement_code = d.code) as nb_contacts
      FROM departements d
      JOIN regions r ON d.region_code = r.code
      ${whereClause}
      ORDER BY d.code
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reference/departements/:code/toggle - Activer/désactiver un département
router.put('/departements/:code/toggle', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.query(`
      UPDATE departements SET actif = NOT actif WHERE code = $1 RETURNING *
    `, [code]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departement not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/activity-groups - Liste des groupes d'activité
router.get('/activity-groups', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ag.*,
        (SELECT COUNT(*) FROM contacts c WHERE c.activity_group_id = ag.id) as nb_contacts,
        (SELECT COUNT(*) FROM contacts c WHERE c.activity_group_id = ag.id AND c.is_small_business = true) as nb_small_business
      FROM activity_groups ag
      ORDER BY ag.nom
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/activity-groups/:id - Détail d'un groupe d'activité
router.get('/activity-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM activity_groups WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity group not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reference/activity-groups/:id - Modifier un groupe d'activité
router.put('/activity-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, horaires_ok, horaires_ko, mots_cles, codes_naf, couleur } = req.body;
    
    const result = await db.query(`
      UPDATE activity_groups SET
        nom = COALESCE($1, nom),
        horaires_ok = COALESCE($2, horaires_ok),
        horaires_ko = COALESCE($3, horaires_ko),
        mots_cles = COALESCE($4, mots_cles),
        codes_naf = COALESCE($5, codes_naf),
        couleur = COALESCE($6, couleur)
      WHERE id = $7
      RETURNING *
    `, [nom, horaires_ok, horaires_ko, mots_cles, codes_naf, couleur, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity group not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/zones - Liste des zones personnalisées
router.get('/zones', async (req, res) => {
  try {
    const { departement } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (departement) {
      whereClause = 'WHERE departement_code = $1';
      params.push(departement);
    }
    
    const result = await db.query(`
      SELECT z.*, d.nom as departement_nom,
        (SELECT COUNT(*) FROM contacts c WHERE c.code_postal = ANY(z.codes_postaux)) as nb_contacts
      FROM custom_zones z
      JOIN departements d ON z.departement_code = d.code
      ${whereClause}
      ORDER BY z.departement_code, z.nom
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reference/zones - Créer une zone personnalisée
router.post('/zones', async (req, res) => {
  try {
    const { nom, departement_code, codes_postaux, description, couleur } = req.body;
    
    const result = await db.query(`
      INSERT INTO custom_zones (nom, departement_code, codes_postaux, description, couleur)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [nom, departement_code, codes_postaux, description, couleur]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reference/zones/:id - Modifier une zone
router.put('/zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, codes_postaux, description, couleur } = req.body;
    
    const result = await db.query(`
      UPDATE custom_zones SET
        nom = COALESCE($1, nom),
        codes_postaux = COALESCE($2, codes_postaux),
        description = COALESCE($3, description),
        couleur = COALESCE($4, couleur)
      WHERE id = $5
      RETURNING *
    `, [nom, codes_postaux, description, couleur, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reference/zones/:id - Supprimer une zone
router.delete('/zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM custom_zones WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/qualification-rules - Règles de qualification
router.get('/qualification-rules', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM qualification_rules ORDER BY qualification, sous_qualification');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/qualifications - Liste des qualifications possibles
router.get('/qualifications', async (req, res) => {
  try {
    const qualifications = [
      { value: 'RDV Pris', label: 'RDV Pris', category: 'positif' },
      { value: 'Relance', label: 'Relance', category: 'positif' },
      { value: 'À Rappeler', label: 'À Rappeler', category: 'positif' },
      { value: 'NRP', label: 'NRP (Ne répond pas)', category: 'neutre' },
      { value: 'Injoignable', label: 'Injoignable', category: 'neutre' },
      { value: 'Répondeur', label: 'Répondeur', category: 'neutre' },
      { value: 'Absent', label: 'Absent', category: 'neutre' },
      { value: 'Black listé', label: 'Black listé (RGPD)', category: 'negatif' },
      { value: 'Refus argumenté', label: 'Refus argumenté', category: 'negatif' },
      { value: 'Pas intéressé', label: 'Pas intéressé', category: 'negatif' },
      { value: 'Faux Numéro', label: 'Faux Numéro', category: 'negatif' },
      { value: 'Hors cible', label: 'Hors cible', category: 'hors_cible', 
        sous_qualifications: [
          'Particulier',
          'À la retraite',
          'En liquidation',
          'Arrêt de l\'activité',
          'Géré par un siège',
          'Déjà démarché récemment',
          'Autre'
        ]
      }
    ];
    res.json(qualifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reference/config - Configuration générale
router.get('/config', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM config');
    const config = {};
    result.rows.forEach(row => {
      config[row.key] = row.value;
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reference/config/:key - Modifier une config
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const result = await db.query(`
      INSERT INTO config (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [key, JSON.stringify(value)]);
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reference/geocode - Géocoder un code postal
router.post('/geocode', async (req, res) => {
  try {
    const { postalCode } = req.body;
    
    if (!postalCode || postalCode.length < 4) {
      return res.status(400).json({ error: 'Invalid postal code' });
    }
    
    // Use French address API
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${postalCode}&type=municipality&limit=1`
    );
    const data = await response.json();
    
    if (data.features?.length > 0) {
      const feature = data.features[0];
      const [lon, lat] = feature.geometry.coordinates;
      const city = feature.properties.city || feature.properties.name;
      
      res.json({
        postalCode,
        city,
        lat,
        lon,
        status: 'success'
      });
    } else {
      res.json({
        postalCode,
        status: 'not_found'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
