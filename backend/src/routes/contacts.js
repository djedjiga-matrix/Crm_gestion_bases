const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/contacts - Liste des contacts avec filtres
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      departement,
      codePostal,
      activityGroup,
      status,
      smallBusiness,
      maxDuree,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      zone,
      onlyNew,
      campaignId
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let paramIndex = 1;
    
    let whereClause = 'WHERE 1=1';
    
    if (departement) {
      whereClause += ` AND c.departement_code = $${paramIndex++}`;
      params.push(departement);
    }
    
    if (codePostal) {
      whereClause += ` AND c.code_postal LIKE $${paramIndex++}`;
      params.push(codePostal + '%');
    }
    
    if (activityGroup) {
      whereClause += ` AND ag.code = $${paramIndex++}`;
      params.push(activityGroup);
    }
    
    if (status) {
      whereClause += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (smallBusiness === 'true') {
      whereClause += ` AND c.is_small_business = true`;
    }
    
    if (maxDuree) {
      whereClause += ` AND c.duree_secondes <= $${paramIndex++}`;
      params.push(parseInt(maxDuree) * 60);
    }
    
    if (search) {
      whereClause += ` AND (c.nom ILIKE $${paramIndex} OR c.id_fiche ILIKE $${paramIndex} OR c.siret LIKE $${paramIndex++})`;
      params.push('%' + search + '%');
    }
    
    if (onlyNew === 'true') {
      whereClause += ` AND c.last_exported_at IS NULL`;
    }
    
    if (campaignId) {
      whereClause += ` AND EXISTS (SELECT 1 FROM campaign_contacts cc WHERE cc.contact_id = c.id AND cc.campaign_id = $${paramIndex++})`;
      params.push(campaignId);
    }

    // Allowed sort columns
    const allowedSorts = ['created_at', 'nom', 'code_postal', 'duree_secondes', 'id_fiche', 'status'];
    const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM contacts c
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get data
    const dataQuery = `
      SELECT 
        c.*,
        ag.nom as groupe_activite,
        ag.code as groupe_code,
        ag.couleur as groupe_couleur,
        ag.horaires_ok
      FROM contacts c
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      ${whereClause}
      ORDER BY c.${sortColumn} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(dataQuery, params);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id - Détail d'un contact
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT c.*, ag.nom as groupe_activite, ag.code as groupe_code
      FROM contacts c
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      WHERE c.id = $1 OR c.id_fiche = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts - Créer un contact
router.post('/', async (req, res) => {
  try {
    const {
      nom, adresse, code_postal, ville, telephone, mobile, telephone2,
      email, site_web, siret, siren, code_naf, categorie, activity_group_id,
      effectif_code, effectif_label, dirigeant, date_creation_entreprise,
      latitude, longitude, source_fichier, notes
    } = req.body;

    // Generate ID fiche
    const idResult = await db.query('SELECT generate_id_fiche() as id_fiche');
    const id_fiche = idResult.rows[0].id_fiche;

    const result = await db.query(`
      INSERT INTO contacts (
        id_fiche, nom, adresse, code_postal, ville, telephone, mobile, telephone2,
        email, site_web, siret, siren, code_naf, categorie, activity_group_id,
        effectif_code, effectif_label, dirigeant, date_creation_entreprise,
        latitude, longitude, source_fichier, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *
    `, [
      id_fiche, nom, adresse, code_postal, ville, telephone, mobile, telephone2,
      email, site_web, siret, siren, code_naf, categorie, activity_group_id,
      effectif_code, effectif_label, dirigeant, date_creation_entreprise,
      latitude, longitude, source_fichier, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating contact:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contacts/:id - Mettre à jour un contact
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    const allowedFields = [
      'nom', 'adresse', 'code_postal', 'ville', 'telephone', 'mobile', 'telephone2',
      'email', 'site_web', 'siret', 'siren', 'code_naf', 'categorie', 'activity_group_id',
      'effectif_code', 'effectif_label', 'dirigeant', 'date_creation_entreprise',
      'latitude', 'longitude', 'geo_status', 'distance_metres', 'duree_secondes',
      'route_status', 'status', 'sous_qualification', 'date_prochain_rappel',
      'compteur_nrp', 'notes'
    ];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(id);
    
    const result = await db.query(`
      UPDATE contacts SET ${fields.join(', ')}
      WHERE id = $${paramIndex} OR id_fiche = $${paramIndex}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id - Supprimer un contact
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM contacts WHERE id = $1 OR id_fiche = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({ success: true, deleted: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/bulk-update - Mise à jour en masse
router.post('/bulk-update', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    const allowedFields = ['status', 'activity_group_id', 'notes'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(ids);
    
    const result = await db.query(`
      UPDATE contacts SET ${fields.join(', ')}
      WHERE id = ANY($${paramIndex})
      RETURNING id
    `, values);
    
    res.json({ success: true, updated: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/remove-duplicates - Supprimer les doublons
router.post('/remove-duplicates', async (req, res) => {
  try {
    // Find duplicates by phone
    const result = await db.query(`
      DELETE FROM contacts
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY COALESCE(telephone_normalise, mobile_normalise, '')
            ORDER BY created_at ASC
          ) as rn
          FROM contacts
          WHERE telephone_normalise IS NOT NULL OR mobile_normalise IS NOT NULL
        ) t
        WHERE t.rn > 1
      )
      RETURNING id
    `);
    
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/detect-activity-group - Détecter le groupe d'activité
router.post('/detect-activity-group', async (req, res) => {
  try {
    // Update contacts without activity group based on category keywords
    const result = await db.query(`
      UPDATE contacts c
      SET activity_group_id = (
        SELECT ag.id FROM activity_groups ag
        WHERE EXISTS (
          SELECT 1 FROM unnest(ag.mots_cles) AS mot
          WHERE LOWER(c.categorie) LIKE '%' || LOWER(mot) || '%'
        )
        LIMIT 1
      )
      WHERE c.activity_group_id IS NULL AND c.categorie IS NOT NULL
      RETURNING id
    `);
    
    res.json({ success: true, updated: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
