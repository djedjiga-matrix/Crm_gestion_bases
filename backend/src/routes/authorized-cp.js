const express = require('express');
const router = express.Router();
const db = require('../db');
const xlsx = require('xlsx');

// GET /api/authorized-cp - Liste tous les CP autorisés
router.get('/', async (req, res) => {
    try {
        const { departement } = req.query;
        let query = `
      SELECT acp.*, 
        (SELECT COUNT(*) FROM contacts c WHERE c.code_postal = acp.code_postal) as nb_contacts
      FROM authorized_postal_codes acp
    `;
        const params = [];
        if (departement) {
            query += ' WHERE acp.departement_code = $1';
            params.push(departement);
        }
        query += ' ORDER BY acp.departement_code, acp.code_postal';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/authorized-cp/stats - Stats par département
router.get('/stats', async (req, res) => {
    try {
        const result = await db.query(`
      SELECT 
        acp.departement_code,
        d.nom as departement_nom,
        COUNT(DISTINCT acp.code_postal) as nb_cp_autorises,
        COUNT(DISTINCT c.id) as nb_contacts_autorises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.is_small_business) as nb_tpe
      FROM authorized_postal_codes acp
      LEFT JOIN departements d ON d.code = acp.departement_code
      LEFT JOIN contacts c ON c.code_postal = acp.code_postal
      GROUP BY acp.departement_code, d.nom
      ORDER BY acp.departement_code
    `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/authorized-cp/import - Importer depuis fichier
router.post('/import', async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (data.length === 0) return res.status(400).json({ error: 'Fichier vide' });

        const headers = Object.keys(data[0]);
        const cpColumn = headers.find(h => /code.?postal|cp|postal/i.test(h)) || headers[0];
        const villeColumn = headers.find(h => /ville|commune|city|localite/i.test(h));

        const results = { total: data.length, imported: 0, duplicates: 0, errors: 0 };

        for (const row of data) {
            let cp = String(row[cpColumn] || '').trim().replace(/[^0-9]/g, '');
            if (cp.length === 4) cp = '0' + cp;
            if (cp.length !== 5) { results.errors++; continue; }

            const departement = cp.substring(0, 2);
            const ville = villeColumn ? String(row[villeColumn] || '').trim() : null;

            try {
                await db.query(`
          INSERT INTO authorized_postal_codes (departement_code, code_postal, ville)
          VALUES ($1, $2, $3)
          ON CONFLICT (code_postal) DO UPDATE SET ville = COALESCE(EXCLUDED.ville, authorized_postal_codes.ville)
        `, [departement, cp, ville]);
                results.imported++;
            } catch (err) {
                if (err.code === '23505') results.duplicates++;
                else results.errors++;
            }
        }
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/authorized-cp/bulk - Ajouter plusieurs CP manuellement
router.post('/bulk', async (req, res) => {
    try {
        const { codes_postaux } = req.body;
        let cpList = typeof codes_postaux === 'string'
            ? codes_postaux.split(/[,;\s\n]+/).map(cp => cp.trim()).filter(cp => cp)
            : codes_postaux.map(cp => String(cp).trim());

        const results = { total: cpList.length, imported: 0, errors: 0 };

        for (let cp of cpList) {
            cp = cp.replace(/[^0-9]/g, '');
            if (cp.length === 4) cp = '0' + cp;
            if (cp.length !== 5) { results.errors++; continue; }

            const departement = cp.substring(0, 2);
            try {
                await db.query(`
          INSERT INTO authorized_postal_codes (departement_code, code_postal)
          VALUES ($1, $2) ON CONFLICT (code_postal) DO NOTHING
        `, [departement, cp]);
                results.imported++;
            } catch (err) { results.errors++; }
        }
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/authorized-cp/:cp - Supprimer un CP
router.delete('/:cp', async (req, res) => {
    try {
        await db.query('DELETE FROM authorized_postal_codes WHERE code_postal = $1', [req.params.cp]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/authorized-cp/departement/:dept - Supprimer tous les CP d'un département
router.delete('/departement/:dept', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM authorized_postal_codes WHERE departement_code = $1 RETURNING *',
            [req.params.dept]
        );
        res.json({ success: true, deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
