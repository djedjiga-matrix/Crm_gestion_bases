const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Mapping colonnes CSV → colonnes SQL
const COLUMN_MAPPING = {
    'siren': 'siren',
    'nic': 'nic',
    'siret': 'siret',
    'statutDiffusionEtablissement': 'statut_diffusion',
    'dateCreationEtablissement': 'date_creation',
    'trancheEffectifsEtablissement': 'tranche_effectifs',
    'anneeEffectifsEtablissement': 'annee_effectifs',
    'activitePrincipaleRegistreMetiersEtablissement': 'activite_principale_registre_metiers',
    'dateDernierTraitementEtablissement': 'date_dernier_traitement',
    'etablissementSiege': 'etablissement_siege',
    'nombrePeriodesEtablissement': 'nombre_periodes',
    'complementAdresseEtablissement': 'complement_adresse',
    'numeroVoieEtablissement': 'numero_voie',
    'indiceRepetitionEtablissement': 'indice_repetition',
    'dernierNumeroVoieEtablissement': 'dernier_numero_voie',
    'indiceRepetitionDernierNumeroVoieEtablissement': 'indice_repetition_dernier',
    'typeVoieEtablissement': 'type_voie',
    'libelleVoieEtablissement': 'libelle_voie',
    'codePostalEtablissement': 'code_postal',
    'libelleCommuneEtablissement': 'libelle_commune',
    'libelleCommuneEtrangerEtablissement': 'libelle_commune_etranger',
    'distributionSpecialeEtablissement': 'distribution_speciale',
    'codeCommuneEtablissement': 'code_commune',
    'codeCedexEtablissement': 'code_cedex',
    'libelleCedexEtablissement': 'libelle_cedex',
    'codePaysEtrangerEtablissement': 'code_pays_etranger',
    'libellePaysEtrangerEtablissement': 'libelle_pays_etranger',
    'identifiantAdresseEtablissement': 'identifiant_adresse',
    'coordonneeLambertAbscisseEtablissement': 'coordonnee_lambert_x',
    'coordonneeLambertOrdonneeEtablissement': 'coordonnee_lambert_y',
    'complementAdresse2Etablissement': 'complement_adresse_2',
    'numeroVoie2Etablissement': 'numero_voie_2',
    'indiceRepetition2Etablissement': 'indice_repetition_2',
    'typeVoie2Etablissement': 'type_voie_2',
    'libelleVoie2Etablissement': 'libelle_voie_2',
    'codePostal2Etablissement': 'code_postal_2',
    'libelleCommune2Etablissement': 'libelle_commune_2',
    'libelleCommuneEtranger2Etablissement': 'libelle_commune_etranger_2',
    'distributionSpeciale2Etablissement': 'distribution_speciale_2',
    'codeCommune2Etablissement': 'code_commune_2',
    'codeCedex2Etablissement': 'code_cedex_2',
    'libelleCedex2Etablissement': 'libelle_cedex_2',
    'codePaysEtranger2Etablissement': 'code_pays_etranger_2',
    'libellePaysEtranger2Etablissement': 'libelle_pays_etranger_2',
    'dateDebut': 'date_debut',
    'etatAdministratifEtablissement': 'etat_administratif',
    'enseigne1Etablissement': 'enseigne_1',
    'enseigne2Etablissement': 'enseigne_2',
    'enseigne3Etablissement': 'enseigne_3',
    'denominationUsuelleEtablissement': 'denomination_usuelle',
    'activitePrincipaleEtablissement': 'activite_principale',
    'nomenclatureActivitePrincipaleEtablissement': 'nomenclature_activite',
    'caractereEmployeurEtablissement': 'caractere_employeur',
};

// GET /api/sirene/status - État de la base SIRENE
router.get('/status', async (req, res) => {
    try {
        const countResult = await db.query('SELECT COUNT(*) as total FROM sirene_etablissements');
        const statsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE etat_administratif = 'A') as actifs,
        COUNT(*) FILTER (WHERE etat_administratif = 'F') as fermes,
        COUNT(*) FILTER (WHERE etablissement_siege = true) as sieges,
        COUNT(DISTINCT code_postal) as nb_cp,
        COUNT(DISTINCT LEFT(code_postal, 2)) as nb_dept
      FROM sirene_etablissements
    `);
        const lastImport = await db.query(
            'SELECT * FROM sirene_imports ORDER BY created_at DESC LIMIT 1'
        );

        res.json({
            total: parseInt(countResult.rows[0].total),
            ...statsResult.rows[0],
            lastImport: lastImport.rows[0] || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sirene/imports - Historique des imports
router.get('/imports', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM sirene_imports ORDER BY created_at DESC LIMIT 20'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sirene/import - Lancer l'import d'un fichier CSV
router.post('/import', async (req, res) => {
    try {
        const { filepath, mode = 'full' } = req.body; // mode: full, update, departements
        const { departements } = req.body; // Pour mode 'departements': ['59', '35']

        if (!filepath) {
            return res.status(400).json({ error: 'filepath requis' });
        }

        if (!fs.existsSync(filepath)) {
            return res.status(400).json({ error: 'Fichier non trouvé: ' + filepath });
        }

        // Créer l'enregistrement d'import
        const importRecord = await db.query(`
      INSERT INTO sirene_imports (filename, status, started_at)
      VALUES ($1, 'running', CURRENT_TIMESTAMP)
      RETURNING id
    `, [path.basename(filepath)]);

        const importId = importRecord.rows[0].id;

        // Lancer l'import en background
        processImport(filepath, importId, mode, departements);

        res.json({
            success: true,
            importId,
            message: 'Import lancé en arrière-plan. Suivez la progression avec GET /api/sirene/import/:id'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fonction d'import en streaming
async function processImport(filepath, importId, mode, filterDepartements) {
    const fileStream = fs.createReadStream(filepath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let headers = null;
    let lineNumber = 0;
    let imported = 0;
    let updated = 0;
    let errors = 0;
    let batch = [];
    const BATCH_SIZE = 1000;

    // Si mode full, vider la table d'abord
    if (mode === 'full') {
        await db.query('TRUNCATE TABLE sirene_etablissements RESTART IDENTITY');
    }

    for await (const line of rl) {
        lineNumber++;

        // Première ligne = headers
        if (lineNumber === 1) {
            headers = line.split(';').map(h => h.replace(/"/g, '').trim());
            continue;
        }

        try {
            const values = parseCSVLine(line);
            const row = {};

            headers.forEach((header, index) => {
                const sqlColumn = COLUMN_MAPPING[header];
                if (sqlColumn) {
                    row[sqlColumn] = cleanValue(values[index], header);
                }
            });

            // Filtrer par département si demandé
            if (filterDepartements && filterDepartements.length > 0) {
                const cp = row.code_postal || '';
                const dept = cp.substring(0, 2);
                if (!filterDepartements.includes(dept)) {
                    continue;
                }
            }

            // Ajouter au batch
            if (row.siret) {
                batch.push(row);
            }

            // Insérer par batch
            if (batch.length >= BATCH_SIZE) {
                const result = await insertBatch(batch, mode);
                imported += result.inserted;
                updated += result.updated;
                batch = [];

                // Mettre à jour la progression
                if (lineNumber % 100000 === 0) {
                    await db.query(`
            UPDATE sirene_imports 
            SET imported_rows = $1, updated_rows = $2
            WHERE id = $3
          `, [imported, updated, importId]);
                    console.log(`Progression: ${lineNumber} lignes traitées, ${imported} importées`);
                }
            }
        } catch (err) {
            errors++;
            if (errors < 10) console.error(`Erreur ligne ${lineNumber}:`, err.message);
        }
    }

    // Insérer le reste
    if (batch.length > 0) {
        const result = await insertBatch(batch, mode);
        imported += result.inserted;
        updated += result.updated;
    }

    // Finaliser
    await db.query(`
    UPDATE sirene_imports 
    SET status = 'completed', 
        total_rows = $1,
        imported_rows = $2, 
        updated_rows = $3,
        errors = $4,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = $5
  `, [lineNumber - 1, imported, updated, errors, importId]);

    console.log(`Import terminé: ${imported} importés, ${updated} mis à jour, ${errors} erreurs`);
}

// Parser une ligne CSV avec point-virgule
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// Nettoyer les valeurs
function cleanValue(value, header) {
    if (!value || value === '' || value === 'NaN') return null;

    // Boolean
    if (header === 'etablissementSiege') {
        return value.toLowerCase() === 'true';
    }

    // Dates
    if (header.includes('date') || header === 'dateDebut') {
        if (value.includes('T')) {
            return value; // Timestamp
        }
        return value || null;
    }

    // Nombres
    if (header.includes('annee') || header.includes('nombre') || header.includes('coordonnee')) {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    return value.replace(/"/g, '').trim() || null;
}

// Insérer un batch
async function insertBatch(batch, mode) {
    let inserted = 0;
    let updated = 0;

    const columns = Object.keys(COLUMN_MAPPING).map(k => COLUMN_MAPPING[k]);
    const columnsList = columns.join(', ');

    for (const row of batch) {
        const values = columns.map(col => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        try {
            if (mode === 'update') {
                // Upsert
                const updateCols = columns.filter(c => c !== 'siret')
                    .map(c => `${c} = EXCLUDED.${c}`).join(', ');

                await db.query(`
          INSERT INTO sirene_etablissements (${columnsList})
          VALUES (${placeholders})
          ON CONFLICT (siret) DO UPDATE SET ${updateCols}, updated_at = CURRENT_TIMESTAMP
        `, values);
                updated++;
            } else {
                // Insert simple
                await db.query(`
          INSERT INTO sirene_etablissements (${columnsList})
          VALUES (${placeholders})
          ON CONFLICT (siret) DO NOTHING
        `, values);
                inserted++;
            }
        } catch (err) {
            // Ignorer les erreurs d'insertion
        }
    }

    return { inserted, updated };
}

// GET /api/sirene/import/:id - Statut d'un import
router.get('/import/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM sirene_imports WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Import non trouvé' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sirene/search - Rechercher dans SIRENE
router.get('/search', async (req, res) => {
    try {
        const {
            q, siret, siren, cp, departement, naf,
            effectif, actif = 'true', siege,
            limit = 50, offset = 0
        } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (q) {
            whereClause += ` AND (enseigne_1 ILIKE $${paramIndex} OR denomination_usuelle ILIKE $${paramIndex} OR libelle_commune ILIKE $${paramIndex})`;
            params.push(`%${q}%`);
            paramIndex++;
        }

        if (siret) {
            whereClause += ` AND siret = $${paramIndex++}`;
            params.push(siret);
        }

        if (siren) {
            whereClause += ` AND siren = $${paramIndex++}`;
            params.push(siren);
        }

        if (cp) {
            whereClause += ` AND code_postal = $${paramIndex++}`;
            params.push(cp);
        }

        if (departement) {
            whereClause += ` AND LEFT(code_postal, 2) = $${paramIndex++}`;
            params.push(departement);
        }

        if (naf) {
            whereClause += ` AND activite_principale LIKE $${paramIndex++}`;
            params.push(naf + '%');
        }

        if (effectif) {
            const effectifs = effectif.split(',');
            whereClause += ` AND tranche_effectifs = ANY($${paramIndex++})`;
            params.push(effectifs);
        }

        if (actif === 'true') {
            whereClause += ` AND etat_administratif = 'A'`;
        }

        if (siege === 'true') {
            whereClause += ` AND etablissement_siege = true`;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) FROM sirene_etablissements WHERE ${whereClause}`,
            params
        );

        params.push(parseInt(limit), parseInt(offset));
        const dataResult = await db.query(`
      SELECT * FROM sirene_etablissements 
      WHERE ${whereClause}
      ORDER BY enseigne_1, siret
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

        res.json({
            total: parseInt(countResult.rows[0].count),
            data: dataResult.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sirene/generate - Générer une base de prospection
router.post('/generate', async (req, res) => {
    try {
        const {
            codesPostaux,        // Array de CP ou 'authorized' pour CP autorisés
            codesNaf,            // Array de codes NAF (ex: ['56.10', '43.21'])
            tranchesEffectifs,   // Array (ex: ['00', '01', '02', '03', '11'])
            actifUniquement = true,
            siegeUniquement = false,
            limit = 1000,
            injectInContacts = false  // Si true, ajoute directement dans la table contacts
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

        if (siegeUniquement) {
            whereClause += ` AND etablissement_siege = true`;
        }

        // Exclure ceux déjà dans contacts
        whereClause += ` AND siret NOT IN (SELECT siret FROM contacts WHERE siret IS NOT NULL)`;

        params.push(parseInt(limit));

        const result = await db.query(`
      SELECT * FROM sirene_etablissements 
      WHERE ${whereClause}
      ORDER BY code_postal, enseigne_1
      LIMIT $${paramIndex}
    `, params);

        // Si injection dans contacts
        if (injectInContacts && result.rows.length > 0) {
            let injected = 0;

            for (const row of result.rows) {
                // Générer l'adresse complète
                const adresse = [
                    row.numero_voie,
                    row.type_voie,
                    row.libelle_voie
                ].filter(Boolean).join(' ');

                // Déterminer le groupe d'activité
                const activityGroup = await detectActivityGroup(row.activite_principale);

                try {
                    // Générer ID fiche
                    const idResult = await db.query('SELECT generate_id_fiche() as id_fiche');

                    await db.query(`
            INSERT INTO contacts (
              id_fiche, nom, adresse, code_postal, ville, siret, siren,
              code_naf, effectif_code, activity_group_id,
              coordonnee_lambert_x, coordonnee_lambert_y, source_fichier
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SIRENE')
            ON CONFLICT (siret) DO NOTHING
          `, [
                        idResult.rows[0].id_fiche,
                        row.enseigne_1 || row.denomination_usuelle || 'Sans nom',
                        adresse,
                        row.code_postal,
                        row.libelle_commune,
                        row.siret,
                        row.siren,
                        row.activite_principale,
                        row.tranche_effectifs,
                        activityGroup,
                        row.coordonnee_lambert_x,
                        row.coordonnee_lambert_y
                    ]);
                    injected++;
                } catch (err) {
                    // Ignorer les erreurs d'insertion
                }
            }

            return res.json({
                success: true,
                found: result.rows.length,
                injected,
                message: `${injected} contacts injectés dans la base`
            });
        }

        res.json({
            total: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Détecter le groupe d'activité par code NAF
async function detectActivityGroup(codeNaf) {
    if (!codeNaf) return null;

    const result = await db.query(`
    SELECT id FROM activity_groups 
    WHERE $1 = ANY(codes_naf) OR $1 LIKE ANY(
      SELECT unnest(codes_naf) || '%'
    )
    LIMIT 1
  `, [codeNaf]);

    return result.rows[0]?.id || null;
}

// GET /api/sirene/stats/by-cp - Stats par code postal
router.get('/stats/by-cp', async (req, res) => {
    try {
        const { departement, authorizedOnly } = req.query;

        let whereClause = "etat_administratif = 'A'";
        const params = [];
        let paramIndex = 1;

        if (departement) {
            whereClause += ` AND LEFT(code_postal, 2) = $${paramIndex++}`;
            params.push(departement);
        }

        if (authorizedOnly === 'true') {
            whereClause += ` AND code_postal IN (SELECT code_postal FROM authorized_postal_codes)`;
        }

        const result = await db.query(`
      SELECT 
        code_postal,
        libelle_commune,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tranche_effectifs IN ('00', '01', '02', '03', '11')) as tpe,
        COUNT(DISTINCT activite_principale) as nb_secteurs
      FROM sirene_etablissements
      WHERE ${whereClause}
      GROUP BY code_postal, libelle_commune
      ORDER BY total DESC
      LIMIT 100
    `, params);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sirene/stats/by-naf - Stats par secteur d'activité
router.get('/stats/by-naf', async (req, res) => {
    try {
        const { departement, authorizedOnly } = req.query;

        let whereClause = "etat_administratif = 'A'";
        const params = [];
        let paramIndex = 1;

        if (departement) {
            whereClause += ` AND LEFT(code_postal, 2) = $${paramIndex++}`;
            params.push(departement);
        }

        if (authorizedOnly === 'true') {
            whereClause += ` AND code_postal IN (SELECT code_postal FROM authorized_postal_codes)`;
        }

        const result = await db.query(`
      SELECT 
        LEFT(activite_principale, 2) as secteur_naf,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tranche_effectifs IN ('00', '01', '02', '03', '11')) as tpe
      FROM sirene_etablissements
      WHERE ${whereClause} AND activite_principale IS NOT NULL
      GROUP BY LEFT(activite_principale, 2)
      ORDER BY total DESC
    `, params);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
