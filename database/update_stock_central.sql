-- STOCK CENTRALISE
CREATE TABLE IF NOT EXISTS stock_central (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identifiants
    siret VARCHAR(14) UNIQUE NOT NULL,
    siren VARCHAR(9),
    
    -- Entreprise
    nom VARCHAR(255),
    enseigne VARCHAR(255),
    
    -- Adresse
    adresse VARCHAR(500),
    code_postal VARCHAR(5),
    ville VARCHAR(255),
    departement_code VARCHAR(3),
    
    -- Coordonnées
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Contact
    telephone VARCHAR(20),
    email VARCHAR(255),
    
    -- Activité
    code_naf VARCHAR(6),
    libelle_naf VARCHAR(255),
    activity_group_id INTEGER REFERENCES activity_groups(id),
    
    -- Effectif
    tranche_effectifs VARCHAR(2),
    effectif_label VARCHAR(100),
    is_small_business BOOLEAN DEFAULT false,
    
    -- Statut
    statut VARCHAR(20) DEFAULT 'nouveau',
    date_dernier_contact TIMESTAMP,
    notes TEXT,
    
    -- Traçabilité
    source VARCHAR(50) DEFAULT 'SIRENE',
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Lien avec contacts
    contact_id UUID REFERENCES contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_siret ON stock_central(siret);
CREATE INDEX IF NOT EXISTS idx_stock_cp ON stock_central(code_postal);
CREATE INDEX IF NOT EXISTS idx_stock_dept ON stock_central(departement_code);
CREATE INDEX IF NOT EXISTS idx_stock_naf ON stock_central(code_naf);
CREATE INDEX IF NOT EXISTS idx_stock_statut ON stock_central(statut);
CREATE INDEX IF NOT EXISTS idx_stock_effectif ON stock_central(tranche_effectifs);
CREATE INDEX IF NOT EXISTS idx_stock_activity ON stock_central(activity_group_id);
CREATE INDEX IF NOT EXISTS idx_stock_cp_naf_tpe ON stock_central(code_postal, code_naf, is_small_business);
