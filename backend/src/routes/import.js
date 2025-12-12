const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../db');

// Synonymes pour la détection automatique des colonnes
const FIELD_SYNONYMS = {
  id_fiche: ['id fiche', 'id', 'uniqueid', 'unique_id', 'identifiant', 'ref', 'reference'],
  nom: ['nom', 'name', 'raison sociale', 'raison_sociale', 'entreprise', 'société', 'societe', 'denomination', 'dénomination'],
  adresse: ['adresse', 'address', 'addresse', 'rue', 'voie', 'adresse postale'],
  code_postal: ['code postal', 'code_postal', 'codepostal', 'cp', 'postal', 'zip', 'zipcode'],
  ville: ['ville', 'city', 'commune', 'localité', 'localite'],
  telephone: ['téléphone', 'telephone', 'tel', 'tél', 'phone', 'tel1', 'téléphone 1', 'fixe'],
  mobile: ['mobile', 'portable', 'gsm', 'tel2', 'téléphone 2', 'cellulaire'],
  telephone2: ['fax', 'téléphone 3', 'tel3', 'autre tel'],
  email: ['email', 'mail', 'e-mail', 'courriel', 'adresse mail'],
  site_web: ['site', 'site web', 'website', 'web', 'url', 'site internet'],
  categorie: ['catégorie', 'categorie', 'category', 'rubrique', 'secteur', 'activité', 'activite', 'type'],
  siret: ['siret', 'n° siret', 'numero siret', 'numéro siret'],
  siren: ['siren', 'n° siren', 'numero siren', 'numéro siren'],
  code_naf: ['naf', 'code naf', 'ape', 'code ape'],
  effectif_code: ['effectif', 'effectif (code)', 'code effectif', 'tranche effectif', 'nb salariés'],
  effectif_label: ['effectif label', 'tranche', 'effectif entreprise'],
  dirigeant: ['dirigeants', 'dirigeant', 'gérant', 'gerant', 'responsable', 'contact'],
  date_creation_entreprise: ['date création', 'date de création', 'date_creation', 'création', 'date création ent.'],
  latitude: ['latitude', 'lat', 'y'],
  longitude: ['longitude', 'lon', 'lng', 'long', 'x'],
  description: ['description', 'commentaire', 'notes', 'observation'],
};

// Normaliser un numéro de téléphone
const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length < 9) return null;
  return cleaned.slice(-10);
};

// Normaliser un code postal
const normalizePostalCode = (cp) => {
  if (!cp) return null;
  let code = String(cp).trim();
  if (code.includes('.')) code = code.split('.')[0];
  code = code.replace(/\D/g, '');
  if (!code || code.length < 4) return null;
  if (code.length === 4) code = '0' + code;
  return code.slice(0, 5);
};

// Détecter automatiquement les colonnes
const detectColumns = (headers) => {
  const mapping = {};
  const headersLower = headers.map(h => h?.toString().toLowerCase().trim() || '');
  
  Object.entries(FIELD_SYNONYMS).forEach(([field, synonyms]) => {
    for (const synonym of synonyms) {
      const index = headersLower.findIndex(h => h === synonym || h.includes(synonym));
      if (index !== -1 && !Object.values(mapping).includes(headers[index])) {
        mapping[field] = headers[index];
        break;
      }
    }
  });
  
  return mapping;
};

// POST /api/import/analyze - Analyser un fichier sans l'importer
router.post('/analyze', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    if (!rawData.length) {
      return res.status(400).json({ error: 'Empty file' });
    }
    
    const headers = Object.keys(rawData[0]);
    const autoMapping = detectColumns(headers);
    
    // Sample data for preview
    const sampleData = rawData.slice(0, 5).map(row => {
      const sample = {};
      headers.forEach(h => {
        sample[h] = row[h] !== null ? String(row[h]).slice(0, 100) : null;
      });
      return sample;
    });
    
    res.json({
      fileName: req.file.originalname,
      totalRows: rawData.length,
      headers,
      autoMapping,
      sampleData
    });
  } catch (err) {
    console.error('Error analyzing file:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/process - Importer les données
router.post('/process', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { mapping, mode = 'new' } = req.body;
    const columnMapping = JSON.parse(mapping);
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const results = {
        total: rawData.length,
        imported: 0,
        duplicates: 0,
        updated: 0,
        errors: 0
      };
      
      // Get existing phones and sirets for duplicate detection
      const existingPhonesResult = await client.query(`
        SELECT telephone_normalise, mobile_normalise, siret, id 
        FROM contacts 
        WHERE telephone_normalise IS NOT NULL OR mobile_normalise IS NOT NULL OR siret IS NOT NULL
      `);
      
      const existingPhones = new Set();
      const existingSirets = new Map();
      
      existingPhonesResult.rows.forEach(r => {
        if (r.telephone_normalise) existingPhones.add(r.telephone_normalise);
        if (r.mobile_normalise) existingPhones.add(r.mobile_normalise);
        if (r.siret) existingSirets.set(r.siret, r.id);
      });
      
      // Get activity groups for auto-detection
      const groupsResult = await client.query('SELECT id, code, mots_cles FROM activity_groups');
      const activityGroups = groupsResult.rows;
      
      for (const row of rawData) {
        try {
          const getValue = (field) => {
            const col = columnMapping[field];
            if (!col) return null;
            const val = row[col];
            return val !== undefined && val !== null && val !== '' ? val : null;
          };
          
          const telephone = normalizePhone(getValue('telephone'));
          const mobile = normalizePhone(getValue('mobile'));
          const siret = getValue('siret') ? String(getValue('siret')).replace(/\D/g, '') : null;
          
          // Check for duplicates
          const isDuplicate = 
            (telephone && existingPhones.has(telephone)) ||
            (mobile && existingPhones.has(mobile)) ||
            (siret && existingSirets.has(siret));
          
          if (isDuplicate && mode === 'new') {
            results.duplicates++;
            continue;
          }
          
          // Detect activity group from category
          const categorie = getValue('categorie');
          let activityGroupId = null;
          
          if (categorie) {
            const catLower = categorie.toLowerCase();
            for (const group of activityGroups) {
              if (group.mots_cles?.some(mot => catLower.includes(mot.toLowerCase()))) {
                activityGroupId = group.id;
                break;
              }
            }
          }
          
          // Generate ID fiche
          const idResult = await client.query('SELECT generate_id_fiche() as id_fiche');
          const id_fiche = getValue('id_fiche') || idResult.rows[0].id_fiche;
          
          const contactData = {
            id_fiche,
            nom: getValue('nom'),
            adresse: getValue('adresse'),
            code_postal: normalizePostalCode(getValue('code_postal')),
            ville: getValue('ville'),
            telephone: getValue('telephone'),
            mobile: getValue('mobile'),
            telephone2: getValue('telephone2'),
            email: getValue('email'),
            site_web: getValue('site_web'),
            siret,
            siren: getValue('siren') ? String(getValue('siren')).replace(/\D/g, '') : null,
            code_naf: getValue('code_naf'),
            categorie,
            activity_group_id: activityGroupId,
            effectif_code: getValue('effectif_code'),
            effectif_label: getValue('effectif_label'),
            dirigeant: getValue('dirigeant'),
            date_creation_entreprise: getValue('date_creation_entreprise'),
            latitude: getValue('latitude') ? parseFloat(getValue('latitude')) : null,
            longitude: getValue('longitude') ? parseFloat(getValue('longitude')) : null,
            source_fichier: req.file.originalname
          };
          
          if (isDuplicate && mode === 'update' && siret && existingSirets.has(siret)) {
            // Update existing contact
            const existingId = existingSirets.get(siret);
            await client.query(`
              UPDATE contacts SET
                nom = COALESCE($1, nom),
                adresse = COALESCE($2, adresse),
                code_postal = COALESCE($3, code_postal),
                ville = COALESCE($4, ville),
                telephone = COALESCE($5, telephone),
                mobile = COALESCE($6, mobile),
                email = COALESCE($7, email),
                effectif_code = COALESCE($8, effectif_code),
                effectif_label = COALESCE($9, effectif_label),
                dirigeant = COALESCE($10, dirigeant),
                latitude = COALESCE($11, latitude),
                longitude = COALESCE($12, longitude),
                activity_group_id = COALESCE($13, activity_group_id)
              WHERE id = $14
            `, [
              contactData.nom, contactData.adresse, contactData.code_postal, contactData.ville,
              contactData.telephone, contactData.mobile, contactData.email,
              contactData.effectif_code, contactData.effectif_label, contactData.dirigeant,
              contactData.latitude, contactData.longitude, contactData.activity_group_id,
              existingId
            ]);
            results.updated++;
          } else if (!isDuplicate || mode === 'all') {
            // Insert new contact
            await client.query(`
              INSERT INTO contacts (
                id_fiche, nom, adresse, code_postal, ville, telephone, mobile, telephone2,
                email, site_web, siret, siren, code_naf, categorie, activity_group_id,
                effectif_code, effectif_label, dirigeant, date_creation_entreprise,
                latitude, longitude, source_fichier
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            `, [
              contactData.id_fiche, contactData.nom, contactData.adresse, contactData.code_postal,
              contactData.ville, contactData.telephone, contactData.mobile, contactData.telephone2,
              contactData.email, contactData.site_web, contactData.siret, contactData.siren,
              contactData.code_naf, contactData.categorie, contactData.activity_group_id,
              contactData.effectif_code, contactData.effectif_label, contactData.dirigeant,
              contactData.date_creation_entreprise, contactData.latitude, contactData.longitude,
              contactData.source_fichier
            ]);
            results.imported++;
            
            // Add to existing sets to detect duplicates within same file
            if (telephone) existingPhones.add(telephone);
            if (mobile) existingPhones.add(mobile);
            if (siret) existingSirets.set(siret, null);
          }
        } catch (rowErr) {
          console.error('Error processing row:', rowErr);
          results.errors++;
        }
      }
      
      await client.query('COMMIT');
      res.json({ success: true, results });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error importing file:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/qualifications - Importer les retours CRM
router.post('/qualifications', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { campaignId, mapping } = req.body;
    const columnMapping = JSON.parse(mapping);
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const results = {
        total: rawData.length,
        processed: 0,
        errors: 0
      };
      
      for (const row of rawData) {
        try {
          const getValue = (field) => {
            const col = columnMapping[field];
            if (!col) return null;
            return row[col] || null;
          };
          
          const idFiche = getValue('id_fiche');
          const qualification = getValue('qualification');
          const sousQualification = getValue('sous_qualification');
          
          if (!idFiche || !qualification) {
            results.errors++;
            continue;
          }
          
          // Find contact
          const contactResult = await client.query(
            'SELECT id FROM contacts WHERE id_fiche = $1',
            [idFiche]
          );
          
          if (contactResult.rows.length === 0) {
            results.errors++;
            continue;
          }
          
          const contactId = contactResult.rows[0].id;
          
          // Update campaign_contacts if campaign specified
          if (campaignId) {
            await client.query(`
              UPDATE campaign_contacts 
              SET qualification = $1, sous_qualification = $2, qualified_at = CURRENT_TIMESTAMP
              WHERE campaign_id = $3 AND contact_id = $4
            `, [qualification, sousQualification, campaignId, contactId]);
          }
          
          // Apply qualification rules
          const ruleResult = await client.query(`
            SELECT * FROM qualification_rules 
            WHERE qualification = $1 AND (sous_qualification = $2 OR sous_qualification IS NULL)
            ORDER BY sous_qualification DESC NULLS LAST
            LIMIT 1
          `, [qualification, sousQualification]);
          
          if (ruleResult.rows.length > 0) {
            const rule = ruleResult.rows[0];
            
            if (rule.action === 'update_status' && rule.new_status) {
              await client.query(`
                UPDATE contacts SET status = $1, sous_qualification = $2, date_dernier_contact = CURRENT_TIMESTAMP
                WHERE id = $3
              `, [rule.new_status, sousQualification, contactId]);
            } else if (rule.action === 'schedule_recall' && rule.recall_days) {
              // Check max attempts
              const contactCheck = await client.query('SELECT compteur_nrp FROM contacts WHERE id = $1', [contactId]);
              const currentCount = contactCheck.rows[0]?.compteur_nrp || 0;
              
              if (rule.max_attempts && currentCount >= rule.max_attempts) {
                await client.query(`
                  UPDATE contacts SET status = 'refus', date_dernier_contact = CURRENT_TIMESTAMP WHERE id = $1
                `, [contactId]);
              } else {
                await client.query(`
                  UPDATE contacts 
                  SET status = COALESCE($1, status),
                      date_prochain_rappel = CURRENT_TIMESTAMP + INTERVAL '${rule.recall_days} days',
                      compteur_nrp = compteur_nrp + 1,
                      date_dernier_contact = CURRENT_TIMESTAMP
                  WHERE id = $2
                `, [rule.new_status, contactId]);
              }
            } else if (rule.action === 'exclude') {
              await client.query(`
                UPDATE contacts 
                SET status = COALESCE($1, 'refus'),
                    date_prochain_rappel = CURRENT_TIMESTAMP + INTERVAL '${rule.exclude_days || 180} days',
                    date_dernier_contact = CURRENT_TIMESTAMP
                WHERE id = $2
              `, [rule.new_status, contactId]);
            } else if (rule.action === 'delete') {
              await client.query('DELETE FROM contacts WHERE id = $1', [contactId]);
            }
          }
          
          results.processed++;
        } catch (rowErr) {
          console.error('Error processing qualification row:', rowErr);
          results.errors++;
        }
      }
      
      await client.query('COMMIT');
      res.json({ success: true, results });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error importing qualifications:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
