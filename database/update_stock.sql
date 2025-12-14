
-- STOCK CENTRALISÉ
CREATE TABLE IF NOT EXISTS stock_prospects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telephone VARCHAR(20) UNIQUE,
    telephone_normalise VARCHAR(10) UNIQUE,
    nom VARCHAR(255),
    prenom VARCHAR(255),
    email VARCHAR(255),
    adresse TEXT,
    code_postal VARCHAR(5),
    ville VARCHAR(100),
    siret VARCHAR(14),
    entreprise VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    distance_metres INTEGER,
    statut_enrichissement VARCHAR(20) DEFAULT 'BRUT',
    source_fichier VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enriched_at TIMESTAMP,
    imported_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_tel_norm ON stock_prospects(telephone_normalise);
CREATE INDEX IF NOT EXISTS idx_stock_siret ON stock_prospects(siret);
CREATE INDEX IF NOT EXISTS idx_stock_statut ON stock_prospects(statut_enrichissement);

-- Trigger
CREATE OR REPLACE FUNCTION stock_before_save()
RETURNS TRIGGER AS $$
BEGIN
    NEW.telephone_normalise := normalize_phone(NEW.telephone);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_before_save ON stock_prospects;
CREATE TRIGGER trg_stock_before_save
BEFORE INSERT OR UPDATE ON stock_prospects
FOR EACH ROW EXECUTE FUNCTION stock_before_save();
