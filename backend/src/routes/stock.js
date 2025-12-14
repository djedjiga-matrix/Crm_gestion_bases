const express = require('express');
const router = express.Router();
const db = require('../db');

// Mapping effectifs
const EFFECTIF_LABELS = {
    'NN': 'Non renseigné', '00': '0 salarié', '01': '1-2 salariés',
    '02': '3-5 salariés', '03': '6-9 salariés', '11': '10-19 salariés',
    '12': '20-49 salariés', '21': '50-99 salariés', '22': '100-199 salariés',
    '31': '200-249 salariés', '32': '250-499 salariés', '41': '500-999 salariés',
    '42': '1000-1999 salariés', '51': '2000-4999 salariés', '52': '5000-9999 salariés',
    '53': '10000+ salariés'
};

// GET /api/stock - Liste avec filtres
router.get('/', async (req, res) => {
    try {
        const {
            page = 1, limit = 50, search, departement, codePostal,
            activityGroup, statut, smallBusiness, authorizedOnly,
            sortBy = 'imported_at', sortOrder = 'DESC'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        let paramIndex = 1;
        let whereClause = 'WHERE 1=1';

        if (search) {
            whereClause += ` AND (s.nom ILIKE $${paramIndex} OR s.enseigne ILIKE $${paramIndex} OR s.siret LIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (departement) {
            whereClause += ` AND s.departement_code = $${paramIndex++}`;
            params.push(departement);
        }

        if (codePostal) {
            whereClause += ` AND s.code_postal = $${paramIndex++}`;
            params.push(codePostal);
        }

        if (activityGroup) {
            whereClause += ` AND ag.code = $${paramIndex++}`;
            params.push(activityGroup);
        }

        if (statut) {
            whereClause += ` AND s.statut = $${paramIndex++}`;
            params.push(statut);
        }

        if (smallBusiness === 'true') {
            whereClause += ` AND s.is_small_business = true`;
        }

        if (authorizedOnly === 'true') {
            whereClause += ` AND EXISTS (SELECT 1 FROM authorized_postal_codes acp WHERE acp.code_postal = s.code_postal)`;
        }

        // Exclure ceux déjà dans contacts
        whereClause += ` AND s.contact_id IS NULL`;

        const allowedSorts = ['imported_at', 'nom', 'code_postal', 'statut'];
        const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'imported_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const countResult = await db.query(`
      SELECT COUNT(*) FROM stock_central s
      LEFT JOIN activity_groups ag ON s.activity_group_id = ag.id
      ${whereClause}
    `, params);

        params.push(parseInt(limit), offset);
        const dataResult = await db.query(`
      SELECT s.*, ag.nom as groupe_activite, ag.code as groupe_code, ag.couleur as groupe_couleur
      FROM stock_central s
      LEFT JOIN activity_groups ag ON s.activity_group_id = ag.id
      ${whereClause}
      ORDER BY s.${sortColumn} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

        res.json({
            data: dataResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/stats - Statistiques
router.get('/stats', async (req, res) => {
    try {
        const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_small_business) as tpe,
        COUNT(*) FILTER (WHERE statut = 'nouveau') as nouveaux,
        COUNT(*) FILTER (WHERE statut = 'a_contacter') as a_contacter,
        COUNT(*) FILTER (WHERE statut = 'contacte') as contactes,
        COUNT(*) FILTER (WHERE statut = 'interesse') as interesses,
        COUNT(*) FILTER (WHERE telephone IS NOT NULL) as avec_telephone,
        COUNT(*) FILTER (WHERE contact_id IS NOT NULL) as transferes,
        COUNT(DISTINCT departement_code) as nb_departements,
        COUNT(DISTINCT code_postal) as nb_cp
      FROM stock_central
    `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stock/import-from-sirene - Importer depuis SIRENE
router.post('/import-from-sirene', async (req, res) => {
    try {
        const {
            codesPostaux,        // 'authorized' ou array de CP
            codesNaf,            // array de codes NAF
            tranchesEffectifs,   // array
            actifUniquement = true,
            limit = 5000
        } = req.body;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        // Filtre CP
        if (codesPostaux === 'authorized') {
            whereClause += ` AND code_postal IN (SELECT code_postal FROM authorized_postal_codes)`;
        } else if (codesPostaux && codesPostaux.length > 0) {
            whereClause += ` AND code_postal = ANY($${paramIndex++})`;
            params.push(codesPostaux);
        }

        // Filtre NAF
        if (codesNaf && codesNaf.length > 0) {
            const nafConditions = codesNaf.map((_, i) => `activite_principale LIKE $${paramIndex + i}`).join(' OR ');
            whereClause += ` AND (${nafConditions})`;
            codesNaf.forEach(naf => params.push(naf.replace('.', '') + '%'));
            paramIndex += codesNaf.length;
        }

        // Filtre effectif
        if (tranchesEffectifs && tranchesEffectifs.length > 0) {
            whereClause += ` AND tranche_effectifs = ANY($${paramIndex++})`;
            params.push(tranchesEffectifs);
        }

        if (actifUniquement) {
            whereClause += ` AND etat_administratif = 'A'`;
        }

        // Exclure ceux déjà dans le stock
        whereClause += ` AND siret NOT IN (SELECT siret FROM stock_central)`;

        params.push(parseInt(limit));

        const sireneData = await db.query(`
      SELECT * FROM sirene_etablissements 
      WHERE ${whereClause}
      ORDER BY code_postal, enseigne_1
      LIMIT $${paramIndex}
    `, params);

        let imported = 0;
        for (const row of sireneData.rows) {
            const adresse = [row.numero_voie, row.type_voie, row.libelle_voie].filter(Boolean).join(' ');
            const effectifLabel = EFFECTIF_LABELS[row.tranche_effectifs] || null;
            const isTPE = ['NN', '00', '01', '02', '03', '11'].includes(row.tranche_effectifs);

            // Détecter groupe activité
            let activityGroupId = null;
            if (row.activite_principale) {
                const agResult = await db.query(`
          SELECT id FROM activity_groups 
          WHERE $1 = ANY(codes_naf)
          LIMIT 1
        `, [row.activite_principale]);
                activityGroupId = agResult.rows[0]?.id || null;
            }

            try {
                await db.query(`
          INSERT INTO stock_central (
            siret, siren, nom, enseigne, adresse, code_postal, ville, departement_code,
            code_naf, tranche_effectifs, effectif_label, is_small_business, activity_group_id, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'SIRENE')
          ON CONFLICT (siret) DO NOTHING
        `, [
                    row.siret, row.siren,
                    row.enseigne_1 || row.denomination_usuelle || 'Sans nom',
                    row.enseigne_1,
                    adresse, row.code_postal, row.libelle_commune,
                    row.code_postal?.substring(0, 2),
                    row.activite_principale, row.tranche_effectifs, effectifLabel, isTPE, activityGroupId
                ]);
                imported++;
            } catch (err) {
                // Ignorer les erreurs
            }
        }

        res.json({ success: true, found: sireneData.rows.length, imported });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stock/transfer-to-contacts - Transférer vers contacts
router.post('/transfer-to-contacts', async (req, res) => {
    try {
        const { ids } = req.body; // Array d'IDs stock_central

        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'Aucun ID fourni' });
        }

        let transferred = 0;
        for (const stockId of ids) {
            const stockRow = await db.query('SELECT * FROM stock_central WHERE id = $1 AND contact_id IS NULL', [stockId]);
            if (stockRow.rows.length === 0) continue;

            const s = stockRow.rows[0];

            // Générer ID fiche
            const idResult = await db.query('SELECT generate_id_fiche() as id_fiche');

            // Créer le contact
            const contactResult = await db.query(`
        INSERT INTO contacts (
          id_fiche, nom, adresse, code_postal, ville, siret, siren,
          code_naf, effectif_code, effectif_label, is_small_business,
          activity_group_id, telephone, email, latitude, longitude, source_fichier
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'STOCK')
        ON CONFLICT (siret) DO NOTHING
        RETURNING id
      `, [
                idResult.rows[0].id_fiche, s.nom, s.adresse, s.code_postal, s.ville,
                s.siret, s.siren, s.code_naf, s.tranche_effectifs, s.effectif_label,
                s.is_small_business, s.activity_group_id, s.telephone, s.email,
                s.latitude, s.longitude
            ]);

            if (contactResult.rows.length > 0) {
                // Marquer comme transféré
                await db.query(
                    'UPDATE stock_central SET contact_id = $1, statut = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                    [contactResult.rows[0].id, 'transfere', stockId]
                );
                transferred++;
            }
        }

        res.json({ success: true, transferred });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/stock/:id - Mettre à jour un élément
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { statut, telephone, email, notes } = req.body;

        const result = await db.query(`
      UPDATE stock_central 
      SET statut = COALESCE($1, statut),
          telephone = COALESCE($2, telephone),
          email = COALESCE($3, email),
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [statut, telephone, email, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Non trouvé' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/stock/bulk-status - Mise à jour statut en masse
router.put('/bulk-status', async (req, res) => {
    try {
        const { ids, statut } = req.body;

        const result = await db.query(`
      UPDATE stock_central SET statut = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2)
    `, [statut, ids]);

        res.json({ success: true, updated: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/stock/:id - Supprimer
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM stock_central WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/stock/bulk - Suppression en masse
router.delete('/bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        const result = await db.query('DELETE FROM stock_central WHERE id = ANY($1)', [ids]);
        res.json({ success: true, deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
