const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/campaigns - Liste des campagnes
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }
    
    const result = await db.query(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id) as total_contacts,
        (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.qualification IS NOT NULL) as contacts_qualifies
      FROM campaigns c
      ${whereClause}
      ORDER BY c.created_at DESC
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id - Détail d'une campagne
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT * FROM campaigns WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get stats
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE cc.qualification IS NOT NULL) as qualifies,
        COUNT(*) FILTER (WHERE cc.qualification = 'RDV Pris') as rdv_pris,
        COUNT(*) FILTER (WHERE cc.qualification IN ('NRP', 'Injoignable', 'Répondeur', 'Absent')) as a_recontacter,
        COUNT(*) FILTER (WHERE cc.qualification IN ('Refus argumenté', 'Pas intéressé', 'Black listé')) as refuses
      FROM campaign_contacts cc
      WHERE cc.campaign_id = $1
    `, [id]);
    
    res.json({
      ...result.rows[0],
      stats: stats.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns - Créer une campagne
router.post('/', async (req, res) => {
  try {
    const {
      nom,
      description,
      criteres,
      depart_code_postal,
      depart_ville,
      depart_lat,
      depart_lon
    } = req.body;
    
    const result = await db.query(`
      INSERT INTO campaigns (nom, description, criteres, depart_code_postal, depart_ville, depart_lat, depart_lon)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [nom, description, JSON.stringify(criteres), depart_code_postal, depart_ville, depart_lat, depart_lon]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/campaigns/:id - Mettre à jour une campagne
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, criteres, status } = req.body;
    
    const result = await db.query(`
      UPDATE campaigns 
      SET nom = COALESCE($1, nom),
          description = COALESCE($2, description),
          criteres = COALESCE($3, criteres),
          status = COALESCE($4, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [nom, description, criteres ? JSON.stringify(criteres) : null, status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/populate - Peupler une campagne avec des contacts
router.post('/:id/populate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get campaign criteria
    const campResult = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    if (campResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campResult.rows[0];
    const criteres = campaign.criteres;
    
    // Build query based on criteria
    let whereClause = `WHERE c.status NOT IN ('rgpd', 'converti', 'hors_cible', 'invalide')`;
    const params = [];
    let paramIndex = 1;
    
    if (criteres.activity_groups?.length > 0) {
      whereClause += ` AND ag.code = ANY($${paramIndex++})`;
      params.push(criteres.activity_groups);
    }
    
    if (criteres.departements?.length > 0) {
      whereClause += ` AND c.departement_code = ANY($${paramIndex++})`;
      params.push(criteres.departements);
    }
    
    if (criteres.codes_postaux?.length > 0) {
      whereClause += ` AND c.code_postal = ANY($${paramIndex++})`;
      params.push(criteres.codes_postaux);
    }
    
    if (criteres.only_small_business) {
      whereClause += ` AND c.is_small_business = true`;
    }
    
    if (criteres.max_duree_minutes) {
      whereClause += ` AND c.duree_secondes <= $${paramIndex++}`;
      params.push(criteres.max_duree_minutes * 60);
    }
    
    if (criteres.exclude_exported) {
      whereClause += ` AND c.last_exported_at IS NULL`;
    }
    
    if (criteres.exclude_in_campaign) {
      whereClause += ` AND NOT EXISTS (
        SELECT 1 FROM campaign_contacts cc2 
        JOIN campaigns camp ON cc2.campaign_id = camp.id
        WHERE cc2.contact_id = c.id AND camp.status = 'active'
      )`;
    }
    
    // Insert contacts into campaign
    params.push(id);
    const insertResult = await db.query(`
      INSERT INTO campaign_contacts (campaign_id, contact_id)
      SELECT $${paramIndex}, c.id
      FROM contacts c
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      ${whereClause}
      AND NOT EXISTS (SELECT 1 FROM campaign_contacts cc WHERE cc.campaign_id = $${paramIndex} AND cc.contact_id = c.id)
      RETURNING contact_id
    `, params);
    
    // Update campaign total
    await db.query(`
      UPDATE campaigns SET total_contacts = (
        SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1
      ) WHERE id = $1
    `, [id]);
    
    res.json({ success: true, added: insertResult.rowCount });
  } catch (err) {
    console.error('Error populating campaign:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/contacts - Contacts d'une campagne
router.get('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100, qualification } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = 'WHERE cc.campaign_id = $1';
    const params = [id];
    
    if (qualification) {
      whereClause += ' AND cc.qualification = $2';
      params.push(qualification);
    }
    
    const result = await db.query(`
      SELECT 
        c.*,
        cc.qualification,
        cc.sous_qualification,
        cc.qualified_at,
        cc.exported_at,
        ag.nom as groupe_activite,
        ag.code as groupe_code
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_id = c.id
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      ${whereClause}
      ORDER BY c.duree_secondes ASC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), offset]);
    
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM campaign_contacts cc ${whereClause}
    `, params);
    
    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/qualify - Qualifier des contacts
router.post('/:id/qualify', async (req, res) => {
  try {
    const { id } = req.params;
    const { qualifications } = req.body; // [{contact_id, qualification, sous_qualification}]
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const q of qualifications) {
        // Update campaign_contacts
        await client.query(`
          UPDATE campaign_contacts 
          SET qualification = $1, sous_qualification = $2, qualified_at = CURRENT_TIMESTAMP
          WHERE campaign_id = $3 AND contact_id = $4
        `, [q.qualification, q.sous_qualification, id, q.contact_id]);
        
        // Get rule for this qualification
        const ruleResult = await client.query(`
          SELECT * FROM qualification_rules 
          WHERE qualification = $1 AND (sous_qualification = $2 OR sous_qualification IS NULL)
          ORDER BY sous_qualification DESC NULLS LAST
          LIMIT 1
        `, [q.qualification, q.sous_qualification]);
        
        if (ruleResult.rows.length > 0) {
          const rule = ruleResult.rows[0];
          
          if (rule.action === 'update_status' && rule.new_status) {
            await client.query(`
              UPDATE contacts SET status = $1, sous_qualification = $2, date_dernier_contact = CURRENT_TIMESTAMP
              WHERE id = $3
            `, [rule.new_status, q.sous_qualification, q.contact_id]);
          }
          
          if (rule.action === 'schedule_recall' && rule.recall_days) {
            await client.query(`
              UPDATE contacts 
              SET status = COALESCE($1, status),
                  date_prochain_rappel = CURRENT_TIMESTAMP + INTERVAL '${rule.recall_days} days',
                  compteur_nrp = compteur_nrp + 1,
                  date_dernier_contact = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [rule.new_status, q.contact_id]);
          }
          
          if (rule.action === 'exclude' && rule.exclude_days) {
            await client.query(`
              UPDATE contacts 
              SET status = COALESCE($1, 'refus'),
                  date_prochain_rappel = CURRENT_TIMESTAMP + INTERVAL '${rule.exclude_days} days',
                  date_dernier_contact = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [rule.new_status, q.contact_id]);
          }
          
          if (rule.action === 'delete') {
            await client.query('DELETE FROM contacts WHERE id = $1', [q.contact_id]);
          }
        }
      }
      
      await client.query('COMMIT');
      res.json({ success: true, processed: qualifications.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error qualifying contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id - Supprimer une campagne
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM campaigns WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
