const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const db = require('../db');

// GET /api/exports - Liste des exports
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, c.nom as campaign_nom
      FROM exports e
      LEFT JOIN campaigns c ON e.campaign_id = c.id
      ORDER BY e.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exports - Créer un export
router.post('/', async (req, res) => {
  try {
    const {
      format = 'xlsx', // xlsx or csv
      campaignId,
      filters = {},
      columns
    } = req.body;
    
    // Build query based on filters
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (campaignId) {
      whereClause += ` AND EXISTS (SELECT 1 FROM campaign_contacts cc WHERE cc.contact_id = c.id AND cc.campaign_id = $${paramIndex++})`;
      params.push(campaignId);
    }
    
    if (filters.departements?.length > 0) {
      whereClause += ` AND c.departement_code = ANY($${paramIndex++})`;
      params.push(filters.departements);
    }
    
    if (filters.activity_groups?.length > 0) {
      whereClause += ` AND ag.code = ANY($${paramIndex++})`;
      params.push(filters.activity_groups);
    }
    
    if (filters.codes_postaux?.length > 0) {
      whereClause += ` AND c.code_postal = ANY($${paramIndex++})`;
      params.push(filters.codes_postaux);
    }
    
    if (filters.only_small_business) {
      whereClause += ` AND c.is_small_business = true`;
    }
    
    if (filters.max_duree_minutes) {
      whereClause += ` AND c.duree_secondes <= $${paramIndex++}`;
      params.push(filters.max_duree_minutes * 60);
    }
    
    if (filters.only_new) {
      whereClause += ` AND c.last_exported_at IS NULL`;
    }
    
    if (filters.statuses?.length > 0) {
      whereClause += ` AND c.status = ANY($${paramIndex++})`;
      params.push(filters.statuses);
    } else {
      // Exclude RGPD, hors_cible by default
      whereClause += ` AND c.status NOT IN ('rgpd', 'hors_cible', 'invalide')`;
    }
    
    // Get contacts
    const result = await db.query(`
      SELECT 
        c.id,
        c.id_fiche,
        c.nom,
        c.adresse,
        c.code_postal,
        c.ville,
        c.telephone,
        c.mobile,
        c.telephone2,
        c.email,
        c.siret,
        c.siren,
        c.code_naf,
        c.categorie,
        c.effectif_code,
        c.effectif_label,
        c.dirigeant,
        c.date_creation_entreprise,
        c.latitude,
        c.longitude,
        c.distance_metres,
        c.duree_secondes,
        c.status,
        c.notes,
        c.created_at,
        ag.nom as groupe_activite,
        ag.code as groupe_code,
        d.nom as departement_nom
      FROM contacts c
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      LEFT JOIN departements d ON c.departement_code = d.code
      ${whereClause}
      ORDER BY c.duree_secondes ASC NULLS LAST, c.code_postal ASC
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No contacts match the criteria' });
    }
    
    const contacts = result.rows;
    const contactIds = contacts.map(c => c.id);
    
    // Update last_exported_at
    await db.query(`
      UPDATE contacts 
      SET last_exported_at = CURRENT_TIMESTAMP, export_count = export_count + 1
      WHERE id = ANY($1)
    `, [contactIds]);
    
    // Save export record
    const exportResult = await db.query(`
      INSERT INTO exports (campaign_id, format, nb_contacts, criteres_snapshot)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [campaignId, format, contacts.length, JSON.stringify(filters)]);
    
    const exportId = exportResult.rows[0].id;
    
    // Save export_contacts
    for (const contactId of contactIds) {
      await db.query(`
        INSERT INTO export_contacts (export_id, contact_id) VALUES ($1, $2)
      `, [exportId, contactId]);
    }
    
    // Prepare export data
    const exportData = contacts.map(c => ({
      'ID_FICHE': c.id_fiche,
      'NOM': c.nom,
      'ADRESSE': c.adresse,
      'CODE_POSTAL': c.code_postal,
      'VILLE': c.ville,
      'TELEPHONE': c.telephone ? formatPhone(c.telephone) : '',
      'MOBILE': c.mobile ? formatPhone(c.mobile) : '',
      'EMAIL': c.email || '',
      'SIRET': c.siret || '',
      'SIREN': c.siren || '',
      'CODE_NAF': c.code_naf || '',
      'ACTIVITE': c.categorie || '',
      'GROUPE_ACTIVITE': c.groupe_code || '',
      'EFFECTIF_CODE': c.effectif_code || '',
      'EFFECTIF': c.effectif_label || '',
      'DIRIGEANT': c.dirigeant || '',
      'DATE_CREATION': c.date_creation_entreprise || '',
      'ZONE': c.departement_nom || '',
      'DISTANCE_KM': c.distance_metres ? (c.distance_metres / 1000).toFixed(1) : '',
      'TEMPS_TRAJET_MIN': c.duree_secondes ? Math.round(c.duree_secondes / 60) : '',
      'LATITUDE': c.latitude || '',
      'LONGITUDE': c.longitude || '',
      'DATE_EXPORT': new Date().toISOString().slice(0, 10)
    }));
    
    if (format === 'csv') {
      // CSV with UTF-8 BOM and semicolon separator
      const headers = Object.keys(exportData[0]);
      const csvRows = [headers.join(';')];
      
      for (const row of exportData) {
        const values = headers.map(h => {
          const val = row[h] || '';
          // Escape quotes and wrap in quotes if contains separator or quotes
          if (String(val).includes(';') || String(val).includes('"') || String(val).includes('\n')) {
            return '"' + String(val).replace(/"/g, '""') + '"';
          }
          return val;
        });
        csvRows.push(values.join(';'));
      }
      
      const csvContent = csvRows.join('\r\n');
      
      // Add UTF-8 BOM
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const content = Buffer.concat([bom, Buffer.from(csvContent, 'utf8')]);
      
      const fileName = `export_${new Date().toISOString().slice(0,10)}_${contacts.length}contacts.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(content);
    } else {
      // XLSX
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Export');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `export_${new Date().toISOString().slice(0,10)}_${contacts.length}contacts.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error('Error creating export:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exports/campaign/:id - Exporter une campagne
router.post('/campaign/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'xlsx' } = req.body;
    
    // Get campaign contacts
    const result = await db.query(`
      SELECT 
        c.id,
        c.id_fiche,
        c.nom,
        c.adresse,
        c.code_postal,
        c.ville,
        c.telephone,
        c.mobile,
        c.email,
        c.siret,
        c.categorie,
        c.effectif_code,
        c.effectif_label,
        c.dirigeant,
        c.distance_metres,
        c.duree_secondes,
        ag.nom as groupe_activite,
        ag.code as groupe_code,
        cc.qualification,
        cc.sous_qualification
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_id = c.id
      LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
      WHERE cc.campaign_id = $1
      ORDER BY c.duree_secondes ASC NULLS LAST
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No contacts in campaign' });
    }
    
    const contacts = result.rows;
    const contactIds = contacts.map(c => c.id);
    
    // Update export tracking
    await db.query(`
      UPDATE contacts 
      SET last_exported_at = CURRENT_TIMESTAMP, export_count = export_count + 1
      WHERE id = ANY($1)
    `, [contactIds]);
    
    await db.query(`
      UPDATE campaign_contacts 
      SET exported_at = CURRENT_TIMESTAMP
      WHERE campaign_id = $1
    `, [id]);
    
    // Get campaign name
    const campResult = await db.query('SELECT nom FROM campaigns WHERE id = $1', [id]);
    const campName = campResult.rows[0]?.nom || 'campaign';
    
    const exportData = contacts.map(c => ({
      'ID_FICHE': c.id_fiche,
      'NOM': c.nom,
      'ADRESSE': c.adresse,
      'CODE_POSTAL': c.code_postal,
      'VILLE': c.ville,
      'TELEPHONE': c.telephone ? formatPhone(c.telephone) : '',
      'MOBILE': c.mobile ? formatPhone(c.mobile) : '',
      'EMAIL': c.email || '',
      'SIRET': c.siret || '',
      'ACTIVITE': c.categorie || '',
      'GROUPE_ACTIVITE': c.groupe_code || '',
      'EFFECTIF': c.effectif_label || '',
      'DIRIGEANT': c.dirigeant || '',
      'DISTANCE_KM': c.distance_metres ? (c.distance_metres / 1000).toFixed(1) : '',
      'TEMPS_TRAJET_MIN': c.duree_secondes ? Math.round(c.duree_secondes / 60) : '',
      'QUALIFICATION': c.qualification || '',
      'SOUS_QUALIFICATION': c.sous_qualification || ''
    }));
    
    if (format === 'csv') {
      const headers = Object.keys(exportData[0]);
      const csvRows = [headers.join(';')];
      
      for (const row of exportData) {
        const values = headers.map(h => {
          const val = row[h] || '';
          if (String(val).includes(';') || String(val).includes('"')) {
            return '"' + String(val).replace(/"/g, '""') + '"';
          }
          return val;
        });
        csvRows.push(values.join(';'));
      }
      
      const csvContent = csvRows.join('\r\n');
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const content = Buffer.concat([bom, Buffer.from(csvContent, 'utf8')]);
      
      const fileName = `${campName}_${contacts.length}contacts.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(content);
    } else {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Export');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `${campName}_${contacts.length}contacts.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error('Error exporting campaign:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function
function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  return phone;
}

module.exports = router;
