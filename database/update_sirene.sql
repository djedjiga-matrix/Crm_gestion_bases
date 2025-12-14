-- SIRENE COMPLETE
CREATE TABLE IF NOT EXISTS sirene_etablissements (
    id SERIAL PRIMARY KEY,
    siren VARCHAR(9),
    nic VARCHAR(5),
    siret VARCHAR(14) UNIQUE,
    statut_diffusion VARCHAR(1),
    date_creation DATE,
    tranche_effectifs VARCHAR(2),
    annee_effectifs INTEGER,
    activite_principale_registre_metiers VARCHAR(6),
    date_dernier_traitement TIMESTAMP,
    etablissement_siege BOOLEAN,
    nombre_periodes INTEGER,
    complement_adresse VARCHAR(255),
    numero_voie VARCHAR(10),
    indice_repetition VARCHAR(10),
    dernier_numero_voie VARCHAR(10),
    indice_repetition_dernier VARCHAR(10),
    type_voie VARCHAR(10),
    libelle_voie VARCHAR(255),
    code_postal VARCHAR(5),
    libelle_commune VARCHAR(255),
    libelle_commune_etranger VARCHAR(255),
    distribution_speciale VARCHAR(255),
    code_commune VARCHAR(5),
    code_cedex VARCHAR(10),
    libelle_cedex VARCHAR(255),
    code_pays_etranger VARCHAR(10),
    libelle_pays_etranger VARCHAR(255),
    identifiant_adresse VARCHAR(50),
    coordonnee_lambert_x DECIMAL(15,6),
    coordonnee_lambert_y DECIMAL(15,6),
    complement_adresse_2 VARCHAR(255),
    numero_voie_2 VARCHAR(10),
    indice_repetition_2 VARCHAR(10),
    type_voie_2 VARCHAR(10),
    libelle_voie_2 VARCHAR(255),
    code_postal_2 VARCHAR(5),
    libelle_commune_2 VARCHAR(255),
    libelle_commune_etranger_2 VARCHAR(255),
    distribution_speciale_2 VARCHAR(255),
    code_commune_2 VARCHAR(5),
    code_cedex_2 VARCHAR(10),
    libelle_cedex_2 VARCHAR(255),
    code_pays_etranger_2 VARCHAR(10),
    libelle_pays_etranger_2 VARCHAR(255),
    date_debut DATE,
    etat_administratif VARCHAR(1),
    enseigne_1 VARCHAR(255),
    enseigne_2 VARCHAR(255),
    enseigne_3 VARCHAR(255),
    denomination_usuelle VARCHAR(255),
    activite_principale VARCHAR(6),
    nomenclature_activite VARCHAR(10),
    caractere_employeur VARCHAR(1),
    
    -- Métadonnées
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index essentiels pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_sirene_siret ON sirene_etablissements(siret);
CREATE INDEX IF NOT EXISTS idx_sirene_siren ON sirene_etablissements(siren);
CREATE INDEX IF NOT EXISTS idx_sirene_cp ON sirene_etablissements(code_postal);
CREATE INDEX IF NOT EXISTS idx_sirene_commune ON sirene_etablissements(code_commune);
CREATE INDEX IF NOT EXISTS idx_sirene_naf ON sirene_etablissements(activite_principale);
CREATE INDEX IF NOT EXISTS idx_sirene_effectif ON sirene_etablissements(tranche_effectifs);
CREATE INDEX IF NOT EXISTS idx_sirene_etat ON sirene_etablissements(etat_administratif);
CREATE INDEX IF NOT EXISTS idx_sirene_siege ON sirene_etablissements(etablissement_siege);

-- Index composite pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_sirene_cp_naf_effectif ON sirene_etablissements(code_postal, activite_principale, tranche_effectifs);
CREATE INDEX IF NOT EXISTS idx_sirene_cp_etat ON sirene_etablissements(code_postal, etat_administratif);

-- Table pour suivre les imports SIRENE
CREATE TABLE IF NOT EXISTS sirene_imports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_date DATE,
    total_rows BIGINT,
    imported_rows BIGINT,
    updated_rows BIGINT,
    errors INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
