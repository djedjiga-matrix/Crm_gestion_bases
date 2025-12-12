const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stats/overview - Vue d'ensemble
router.get('/overview', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_small_business = true) as small_business,
        COUNT(*) FILTER (WHERE status = 'nouveau') as nouveaux,
        COUNT(*) FILTER (WHERE status = 'en_campagne') as en_campagne,
        COUNT(*) FILTER (WHERE status = 'rdv_pris') as rdv_pris,
        COUNT(*) FILTER (WHERE status = 'relance') as relance,
        COUNT(*) FILTER (WHERE status = 'a_rappeler') as a_rappeler,
        COUNT(*) FILTER (WHERE status = 'converti') as convertis,
        COUNT(*) FILTER (WHERE status IN ('refus', 'rgpd', 'hors_cible', 'invalide')) as exclus,
        COUNT(*) FILTER (WHERE last_exported_at IS NULL) as jamais_exportes,
        COUNT(*) FILTER (WHERE latitude IS NOT NULL) as geocodes,
        COUNT(*) FILTER (WHERE duree_secondes IS NOT NULL) as avec_trajet,
        COUNT(*) FILTER (WHERE duree_secondes <= 1800) as moins_30min
      FROM contacts
    `);
    
    const campaigns = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as actives,
        COUNT(*) FILTER (WHERE status = 'terminee') as terminees
      FROM campaigns
    `);
    
    const exports = await db.query(`
      SELECT COUNT(*) as total, SUM(nb_contacts) as total_contacts
      FROM exports
    `);
    
    res.json({
      contacts: result.rows[0],
      campaigns: campaigns.rows[0],
      exports: exports.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/by-departement - Stats par département
router.get('/by-departement', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.code,
        d.nom,
        d.actif,
        COUNT(c.id) as total,
        COUNT(c.id) FILTER (WHERE c.is_small_business = true) as small_business,
        COUNT(c.id) FILTER (WHERE c.status = 'nouveau') as nouveaux,
        COUNT(c.id) FILTER (WHERE c.status = 'rdv_pris') as rdv_pris,
        COUNT(c.id) FILTER (WHERE c.status IN ('refus', 'rgpd', 'hors_cible')) as exclus
      FROM departements d
      LEFT JOIN contacts c ON c.departement_code = d.code
      GROUP BY d.code, d.nom, d.actif
      HAVING COUNT(c.id) > 0 OR d.actif = true
      ORDER BY d.code
    `);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/by-activity-group - Stats par groupe d'activité
router.get('/by-activity-group', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        ag.id,
        ag.code,
        ag.nom,
        ag.couleur,
        ag.horaires_ok,
        COUNT(c.id) as total,
        COUNT(c.id) FILTER (WHERE c.is_small_business = true) as small_business,
        COUNT(c.id) FILTER (WHERE c.status = 'nouveau') as nouveaux,
        COUNT(c.id) FILTER (WHERE c.status = 'rdv_pris') as rdv_pris,
        COUNT(c.id) FILTER (WHERE c.last_exported_at IS NULL) as jamais_exportes
      FROM activity_groups ag
      LEFT JOIN contacts c ON c.activity_group_id = ag.id
      GROUP BY ag.id, ag.code, ag.nom, ag.couleur, ag.horaires_ok
      ORDER BY total DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/by-zone - Stats par zone personnalisée
router.get('/by-zone', async (req, res) => {
  try {
    const { departement } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (departement) {
      whereClause = 'WHERE z.departement_code = $1';
      params.push(departement);
    }
    
    const result = await db.query(`
      SELECT 
        z.id,
        z.nom,
        z.departement_code,
        z.couleur,
        (SELECT COUNT(*) FROM contacts c WHERE c.code_postal = ANY(z.codes_postaux)) as total,
        (SELECT COUNT(*) FROM contacts c WHERE c.code_postal = ANY(z.codes_postaux) AND c.is_small_business = true) as small_business,
        (SELECT COUNT(*) FROM contacts c WHERE c.code_postal = ANY(z.codes_postaux) AND c.status = 'nouveau') as nouveaux
      FROM custom_zones z
      ${whereClause}
      ORDER BY z.departement_code, z.nom
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/by-status - Stats par statut
router.get('/by-status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM contacts
      GROUP BY status
      ORDER BY count DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/by-postal-code - Stats par code postal
router.get('/by-postal-code', async (req, res) => {
  try {
    const { departement, limit = 50 } = req.query;
    
    let whereClause = 'WHERE c.code_postal IS NOT NULL';
    const params = [];
    
    if (departement) {
      whereClause += ' AND c.departement_code = $1';
      params.push(departement);
    }
    
    params.push(parseInt(limit));
    
    const result = await db.query(`
      SELECT 
        c.code_postal,
        c.ville,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE c.is_small_business = true) as small_business,
        COUNT(*) FILTER (WHERE c.status = 'nouveau') as nouveaux
      FROM contacts c
      ${whereClause}
      GROUP BY c.code_postal, c.ville
      ORDER BY total DESC
      LIMIT $${params.length}
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/campaign/:id - Stats d'une campagne
router.get('/campaign/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE cc.qualification IS NOT NULL) as qualifies,
        COUNT(*) FILTER (WHERE cc.qualification = 'RDV Pris') as rdv_pris,
        COUNT(*) FILTER (WHERE cc.qualification = 'Relance') as relance,
        COUNT(*) FILTER (WHERE cc.qualification = 'À Rappeler') as a_rappeler,
        COUNT(*) FILTER (WHERE cc.qualification IN ('NRP', 'Injoignable', 'Répondeur', 'Absent')) as a_recontacter,
        COUNT(*) FILTER (WHERE cc.qualification IN ('Refus argumenté', 'Pas intéressé')) as refuses,
        COUNT(*) FILTER (WHERE cc.qualification = 'Black listé') as rgpd,
        COUNT(*) FILTER (WHERE cc.qualification = 'Faux Numéro') as faux_numeros,
        COUNT(*) FILTER (WHERE cc.qualification = 'Hors cible') as hors_cible,
        COUNT(*) FILTER (WHERE cc.exported_at IS NOT NULL) as exportes
      FROM campaign_contacts cc
      WHERE cc.campaign_id = $1
    `, [id]);
    
    // Stats par qualification
    const byQualification = await db.query(`
      SELECT 
        cc.qualification,
        cc.sous_qualification,
        COUNT(*) as count
      FROM campaign_contacts cc
      WHERE cc.campaign_id = $1 AND cc.qualification IS NOT NULL
      GROUP BY cc.qualification, cc.sous_qualification
      ORDER BY count DESC
    `, [id]);
    
    res.json({
      summary: result.rows[0],
      byQualification: byQualification.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/timeline - Timeline des actions
router.get('/timeline', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Imports par jour
    const imports = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM contacts
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    // RDV par jour
    const rdv = await db.query(`
      SELECT 
        DATE(qualified_at) as date,
        COUNT(*) as count
      FROM campaign_contacts
      WHERE qualification = 'RDV Pris' 
        AND qualified_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(qualified_at)
      ORDER BY date
    `);
    
    // Exports par jour
    const exports = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(nb_contacts) as total_contacts
      FROM exports
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    res.json({
      imports: imports.rows,
      rdv: rdv.rows,
      exports: exports.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/duplicates - Analyse des doublons
router.get('/duplicates', async (req, res) => {
  try {
    // By phone
    const byPhone = await db.query(`
      SELECT telephone_normalise as phone, COUNT(*) as count
      FROM contacts
      WHERE telephone_normalise IS NOT NULL
      GROUP BY telephone_normalise
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);
    
    // By mobile
    const byMobile = await db.query(`
      SELECT mobile_normalise as phone, COUNT(*) as count
      FROM contacts
      WHERE mobile_normalise IS NOT NULL
      GROUP BY mobile_normalise
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);
    
    // By SIRET
    const bySiret = await db.query(`
      SELECT siret, COUNT(*) as count
      FROM contacts
      WHERE siret IS NOT NULL
      GROUP BY siret
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);
    
    const totalDuplicates = await db.query(`
      SELECT COUNT(*) as total FROM (
        SELECT id FROM contacts WHERE telephone_normalise IN (
          SELECT telephone_normalise FROM contacts 
          WHERE telephone_normalise IS NOT NULL 
          GROUP BY telephone_normalise HAVING COUNT(*) > 1
        )
        UNION
        SELECT id FROM contacts WHERE mobile_normalise IN (
          SELECT mobile_normalise FROM contacts 
          WHERE mobile_normalise IS NOT NULL 
          GROUP BY mobile_normalise HAVING COUNT(*) > 1
        )
      ) t
    `);
    
    res.json({
      totalDuplicates: parseInt(totalDuplicates.rows[0].total),
      byPhone: byPhone.rows,
      byMobile: byMobile.rows,
      bySiret: bySiret.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
