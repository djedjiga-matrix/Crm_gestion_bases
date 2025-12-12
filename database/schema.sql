-- ============================================
-- GESTIONNAIRE CAMPAGNES SFR PRO
-- Schéma PostgreSQL
-- ============================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES DE RÉFÉRENCE
-- ============================================

-- Régions de France
CREATE TABLE regions (
    code VARCHAR(3) PRIMARY KEY,
    nom VARCHAR(100) NOT NULL
);

INSERT INTO regions (code, nom) VALUES
('ARA', 'Auvergne-Rhône-Alpes'),
('BFC', 'Bourgogne-Franche-Comté'),
('BRE', 'Bretagne'),
('CVL', 'Centre-Val de Loire'),
('COR', 'Corse'),
('GES', 'Grand Est'),
('HDF', 'Hauts-de-France'),
('IDF', 'Île-de-France'),
('NOR', 'Normandie'),
('NAQ', 'Nouvelle-Aquitaine'),
('OCC', 'Occitanie'),
('PDL', 'Pays de la Loire'),
('PAC', 'Provence-Alpes-Côte d''Azur'),
('GUA', 'Guadeloupe'),
('MTQ', 'Martinique'),
('GUF', 'Guyane'),
('REU', 'La Réunion'),
('MAY', 'Mayotte');

-- Départements
CREATE TABLE departements (
    code VARCHAR(3) PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    region_code VARCHAR(3) REFERENCES regions(code),
    chef_lieu_cp VARCHAR(5),
    actif BOOLEAN DEFAULT false
);

INSERT INTO departements (code, nom, region_code, chef_lieu_cp) VALUES
('01', 'Ain', 'ARA', '01000'),
('02', 'Aisne', 'HDF', '02000'),
('03', 'Allier', 'ARA', '03000'),
('04', 'Alpes-de-Haute-Provence', 'PAC', '04000'),
('05', 'Hautes-Alpes', 'PAC', '05000'),
('06', 'Alpes-Maritimes', 'PAC', '06000'),
('07', 'Ardèche', 'ARA', '07000'),
('08', 'Ardennes', 'GES', '08000'),
('09', 'Ariège', 'OCC', '09000'),
('10', 'Aube', 'GES', '10000'),
('11', 'Aude', 'OCC', '11000'),
('12', 'Aveyron', 'OCC', '12000'),
('13', 'Bouches-du-Rhône', 'PAC', '13000'),
('14', 'Calvados', 'NOR', '14000'),
('15', 'Cantal', 'ARA', '15000'),
('16', 'Charente', 'NAQ', '16000'),
('17', 'Charente-Maritime', 'NAQ', '17000'),
('18', 'Cher', 'CVL', '18000'),
('19', 'Corrèze', 'NAQ', '19000'),
('2A', 'Corse-du-Sud', 'COR', '20000'),
('2B', 'Haute-Corse', 'COR', '20200'),
('21', 'Côte-d''Or', 'BFC', '21000'),
('22', 'Côtes-d''Armor', 'BRE', '22000'),
('23', 'Creuse', 'NAQ', '23000'),
('24', 'Dordogne', 'NAQ', '24000'),
('25', 'Doubs', 'BFC', '25000'),
('26', 'Drôme', 'ARA', '26000'),
('27', 'Eure', 'NOR', '27000'),
('28', 'Eure-et-Loir', 'CVL', '28000'),
('29', 'Finistère', 'BRE', '29000'),
('30', 'Gard', 'OCC', '30000'),
('31', 'Haute-Garonne', 'OCC', '31000'),
('32', 'Gers', 'OCC', '32000'),
('33', 'Gironde', 'NAQ', '33000'),
('34', 'Hérault', 'OCC', '34000'),
('35', 'Ille-et-Vilaine', 'BRE', '35000'),
('36', 'Indre', 'CVL', '36000'),
('37', 'Indre-et-Loire', 'CVL', '37000'),
('38', 'Isère', 'ARA', '38000'),
('39', 'Jura', 'BFC', '39000'),
('40', 'Landes', 'NAQ', '40000'),
('41', 'Loir-et-Cher', 'CVL', '41000'),
('42', 'Loire', 'ARA', '42000'),
('43', 'Haute-Loire', 'ARA', '43000'),
('44', 'Loire-Atlantique', 'PDL', '44000'),
('45', 'Loiret', 'CVL', '45000'),
('46', 'Lot', 'OCC', '46000'),
('47', 'Lot-et-Garonne', 'NAQ', '47000'),
('48', 'Lozère', 'OCC', '48000'),
('49', 'Maine-et-Loire', 'PDL', '49000'),
('50', 'Manche', 'NOR', '50000'),
('51', 'Marne', 'GES', '51000'),
('52', 'Haute-Marne', 'GES', '52000'),
('53', 'Mayenne', 'PDL', '53000'),
('54', 'Meurthe-et-Moselle', 'GES', '54000'),
('55', 'Meuse', 'GES', '55000'),
('56', 'Morbihan', 'BRE', '56000'),
('57', 'Moselle', 'GES', '57000'),
('58', 'Nièvre', 'BFC', '58000'),
('59', 'Nord', 'HDF', '59000'),
('60', 'Oise', 'HDF', '60000'),
('61', 'Orne', 'NOR', '61000'),
('62', 'Pas-de-Calais', 'HDF', '62000'),
('63', 'Puy-de-Dôme', 'ARA', '63000'),
('64', 'Pyrénées-Atlantiques', 'NAQ', '64000'),
('65', 'Hautes-Pyrénées', 'OCC', '65000'),
('66', 'Pyrénées-Orientales', 'OCC', '66000'),
('67', 'Bas-Rhin', 'GES', '67000'),
('68', 'Haut-Rhin', 'GES', '68000'),
('69', 'Rhône', 'ARA', '69000'),
('70', 'Haute-Saône', 'BFC', '70000'),
('71', 'Saône-et-Loire', 'BFC', '71000'),
('72', 'Sarthe', 'PDL', '72000'),
('73', 'Savoie', 'ARA', '73000'),
('74', 'Haute-Savoie', 'ARA', '74000'),
('75', 'Paris', 'IDF', '75000'),
('76', 'Seine-Maritime', 'NOR', '76000'),
('77', 'Seine-et-Marne', 'IDF', '77000'),
('78', 'Yvelines', 'IDF', '78000'),
('79', 'Deux-Sèvres', 'NAQ', '79000'),
('80', 'Somme', 'HDF', '80000'),
('81', 'Tarn', 'OCC', '81000'),
('82', 'Tarn-et-Garonne', 'OCC', '82000'),
('83', 'Var', 'PAC', '83000'),
('84', 'Vaucluse', 'PAC', '84000'),
('85', 'Vendée', 'PDL', '85000'),
('86', 'Vienne', 'NAQ', '86000'),
('87', 'Haute-Vienne', 'NAQ', '87000'),
('88', 'Vosges', 'GES', '88000'),
('89', 'Yonne', 'BFC', '89000'),
('90', 'Territoire de Belfort', 'BFC', '90000'),
('91', 'Essonne', 'IDF', '91000'),
('92', 'Hauts-de-Seine', 'IDF', '92000'),
('93', 'Seine-Saint-Denis', 'IDF', '93000'),
('94', 'Val-de-Marne', 'IDF', '94000'),
('95', 'Val-d''Oise', 'IDF', '95000'),
('971', 'Guadeloupe', 'GUA', '97100'),
('972', 'Martinique', 'MTQ', '97200'),
('973', 'Guyane', 'GUF', '97300'),
('974', 'La Réunion', 'REU', '97400'),
('976', 'Mayotte', 'MAY', '97600');

-- Activer les départements 35 et 59
UPDATE departements SET actif = true WHERE code IN ('35', '59');

-- Groupes d'activité avec horaires
CREATE TABLE activity_groups (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    horaires_ok TEXT, -- JSON des créneaux OK
    horaires_ko TEXT, -- JSON des créneaux à éviter
    mots_cles TEXT[], -- Mots-clés pour détection auto
    codes_naf TEXT[], -- Codes NAF associés
    couleur VARCHAR(7) DEFAULT '#6366f1'
);

INSERT INTO activity_groups (code, nom, horaires_ok, horaires_ko, mots_cles, codes_naf, couleur) VALUES
('RESTAURATION', 'Restauration', 
 '["09:00-11:00", "15:00-18:00"]', 
 '["11:30-14:30", "19:00-21:30"]',
 ARRAY['restaurant', 'brasserie', 'pizzeria', 'bar', 'café', 'snack', 'kebab', 'sushi', 'traiteur', 'boulangerie', 'pâtisserie', 'fast-food', 'crêperie', 'glacier'],
 ARRAY['56.10A', '56.10B', '56.10C', '56.21Z', '56.30Z', '10.71A', '10.71B'],
 '#ef4444'),

('BEAUTE', 'Beauté & Bien-être',
 '["09:00-10:30", "14:00-15:00"]',
 '["10:30-12:00", "samedi"]',
 ARRAY['coiffeur', 'coiffure', 'esthétique', 'institut', 'spa', 'massage', 'onglerie', 'barbier', 'salon', 'manucure', 'tatouage', 'piercing'],
 ARRAY['96.02A', '96.02B', '96.04Z', '96.09Z'],
 '#ec4899'),

('BTP', 'Artisans & BTP',
 '["07:30-08:30", "12:00-13:30", "18:00-19:00"]',
 '["08:30-12:00", "13:30-18:00"]',
 ARRAY['plombier', 'électricien', 'chauffagiste', 'maçon', 'peintre', 'carreleur', 'menuisier', 'couvreur', 'charpentier', 'serrurier', 'vitrier', 'plaquiste', 'façadier', 'terrassement', 'rénovation'],
 ARRAY['43.21A', '43.22A', '43.22B', '43.31Z', '43.32A', '43.32B', '43.33Z', '43.34Z', '43.39Z', '43.91A', '43.91B', '41.20A', '41.20B'],
 '#f97316'),

('SANTE', 'Santé & Médical',
 '["08:00-09:00", "12:00-14:00", "19:00-20:00"]',
 '["09:00-12:00", "14:00-19:00"]',
 ARRAY['médecin', 'dentiste', 'kiné', 'kinésithérapeute', 'infirmier', 'ostéopathe', 'podologue', 'orthophoniste', 'opticien', 'pharmacie', 'laboratoire', 'cabinet médical', 'psychologue'],
 ARRAY['86.21Z', '86.22A', '86.23Z', '86.90D', '86.90E', '86.90F', '47.74Z', '47.78A'],
 '#10b981'),

('COMMERCE', 'Commerce de détail',
 '["09:30-11:30", "14:30-17:00"]',
 '["12:00-14:00"]',
 ARRAY['boutique', 'magasin', 'commerce', 'épicerie', 'primeur', 'boucherie', 'poissonnerie', 'caviste', 'tabac', 'presse', 'librairie', 'fleuriste', 'bijouterie', 'chaussures', 'vêtements', 'sport', 'jouets'],
 ARRAY['47.11A', '47.21Z', '47.22Z', '47.23Z', '47.24Z', '47.25Z', '47.26Z', '47.41Z', '47.51Z', '47.61Z', '47.71Z', '47.72A', '47.77Z'],
 '#8b5cf6'),

('SERVICES', 'Services & Bureaux',
 '["09:00-12:00", "14:00-18:00"]',
 '[]',
 ARRAY['avocat', 'notaire', 'comptable', 'expert-comptable', 'architecte', 'agence', 'conseil', 'consultant', 'bureau', 'cabinet', 'publicité', 'communication', 'marketing', 'assurance', 'courtier', 'immobilier'],
 ARRAY['69.10Z', '69.20Z', '70.21Z', '70.22Z', '71.11Z', '71.12B', '73.11Z', '74.10Z', '82.11Z'],
 '#3b82f6'),

('AUTO', 'Automobile & Transport',
 '["08:00-12:00", "14:00-18:00"]',
 '[]',
 ARRAY['garage', 'garagiste', 'carrosserie', 'mécanique', 'auto', 'pneus', 'concessionnaire', 'contrôle technique', 'lavage', 'taxi', 'vtc', 'transport', 'déménagement', 'location', 'moto'],
 ARRAY['45.11Z', '45.20A', '45.20B', '45.31Z', '45.32Z', '45.40Z', '49.32Z', '49.41A', '49.41B'],
 '#64748b'),

('HOTEL', 'Hôtellerie & Tourisme',
 '["10:00-12:00", "15:00-17:00"]',
 '["07:00-10:00", "17:00-20:00"]',
 ARRAY['hôtel', 'camping', 'gîte', 'chambre d''hôtes', 'agence de voyage', 'tourisme', 'hébergement', 'location vacances'],
 ARRAY['55.10Z', '55.20Z', '55.30Z', '79.11Z', '79.12Z'],
 '#0ea5e9'),

('FORMATION', 'Formation & Éducation',
 '["09:00-11:30", "14:00-17:00"]',
 '[]',
 ARRAY['auto-école', 'école', 'formation', 'centre de formation', 'cours', 'soutien scolaire', 'enseignement', 'coaching'],
 ARRAY['85.53Z', '85.59A', '85.59B', '85.60Z'],
 '#a855f7'),

('SERVICES_PERSONNE', 'Services à la personne',
 '["09:00-12:00", "14:00-17:00"]',
 '[]',
 ARRAY['ménage', 'nettoyage', 'entretien', 'jardinier', 'paysagiste', 'pressing', 'laverie', 'garde d''enfants', 'crèche', 'aide à domicile', 'funéraire', 'pompes funèbres'],
 ARRAY['81.21Z', '81.22Z', '81.29A', '81.30Z', '88.10A', '88.91A', '96.01B', '96.03Z'],
 '#14b8a6');

-- ============================================
-- TABLES PRINCIPALES
-- ============================================

-- Statuts des contacts
CREATE TYPE contact_status AS ENUM (
    'nouveau',           -- Jamais contacté
    'en_campagne',       -- Actuellement en campagne
    'rdv_pris',          -- RDV obtenu
    'relance',           -- À relancer
    'a_rappeler',        -- À rappeler (date prévue)
    'nrp',               -- Ne répond pas (en attente)
    'converti',          -- Client gagné
    'refus',             -- Refus définitif
    'rgpd',              -- Blacklisté RGPD
    'hors_cible',        -- Hors cible
    'invalide'           -- Faux numéro, etc.
);

-- Contacts / Prospects
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_fiche VARCHAR(20) UNIQUE NOT NULL, -- ID lisible (ex: VdS_00001)
    
    -- Infos entreprise
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    code_postal VARCHAR(5),
    ville VARCHAR(100),
    departement_code VARCHAR(3) REFERENCES departements(code),
    
    -- Contacts
    telephone VARCHAR(20),
    telephone_normalise VARCHAR(10), -- Pour détection doublons
    mobile VARCHAR(20),
    mobile_normalise VARCHAR(10),
    telephone2 VARCHAR(20),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Identification
    siret VARCHAR(14),
    siren VARCHAR(9),
    code_naf VARCHAR(10),
    
    -- Classification
    categorie VARCHAR(255), -- Catégorie source
    activity_group_id INTEGER REFERENCES activity_groups(id),
    
    -- Effectif
    effectif_code VARCHAR(5), -- Code INSEE
    effectif_label VARCHAR(50),
    is_small_business BOOLEAN DEFAULT false, -- < 20 salariés
    
    -- Dirigeant
    dirigeant VARCHAR(255),
    date_creation_entreprise DATE,
    
    -- Géolocalisation
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geo_status VARCHAR(20), -- success, not_found, error
    
    -- Trajet depuis point de départ
    distance_metres INTEGER,
    duree_secondes INTEGER,
    route_status VARCHAR(20),
    
    -- Statut et qualification
    status contact_status DEFAULT 'nouveau',
    sous_qualification VARCHAR(50), -- Détail du hors_cible, etc.
    date_dernier_contact TIMESTAMP,
    date_prochain_rappel TIMESTAMP,
    compteur_nrp INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Tracking
    source_fichier VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Export tracking
    last_exported_at TIMESTAMP,
    export_count INTEGER DEFAULT 0
);

-- Index pour performances
CREATE INDEX idx_contacts_code_postal ON contacts(code_postal);
CREATE INDEX idx_contacts_departement ON contacts(departement_code);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_activity_group ON contacts(activity_group_id);
CREATE INDEX idx_contacts_telephone ON contacts(telephone_normalise);
CREATE INDEX idx_contacts_mobile ON contacts(mobile_normalise);
CREATE INDEX idx_contacts_siret ON contacts(siret);
CREATE INDEX idx_contacts_small_business ON contacts(is_small_business);
CREATE INDEX idx_contacts_duree ON contacts(duree_secondes);

-- ============================================
-- CAMPAGNES
-- ============================================

CREATE TYPE campaign_status AS ENUM ('brouillon', 'active', 'terminee', 'archivee');

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Critères de sélection (JSON)
    criteres JSONB NOT NULL DEFAULT '{}',
    /*
    {
        "activity_groups": ["RESTAURATION", "COMMERCE"],
        "departements": ["35", "59"],
        "zones": ["35-A", "59-A"],
        "max_duree_minutes": 30,
        "only_small_business": true,
        "exclude_exported": true,
        "exclude_statuses": ["rgpd", "refus", "hors_cible"]
    }
    */
    
    -- Point de départ pour cette campagne
    depart_code_postal VARCHAR(5),
    depart_ville VARCHAR(100),
    depart_lat DECIMAL(10, 8),
    depart_lon DECIMAL(11, 8),
    
    status campaign_status DEFAULT 'brouillon',
    
    -- Stats
    total_contacts INTEGER DEFAULT 0,
    contacts_traites INTEGER DEFAULT 0,
    rdv_obtenus INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- Relation contacts <-> campagnes
CREATE TABLE campaign_contacts (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exported_at TIMESTAMP,
    
    -- Qualification dans cette campagne
    qualification VARCHAR(50),
    sous_qualification VARCHAR(50),
    qualified_at TIMESTAMP,
    
    PRIMARY KEY (campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_contact ON campaign_contacts(contact_id);

-- ============================================
-- EXPORTS
-- ============================================

CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id),
    
    nom_fichier VARCHAR(255),
    format VARCHAR(10), -- xlsx, csv
    nb_contacts INTEGER,
    
    -- Critères utilisés (snapshot)
    criteres_snapshot JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE export_contacts (
    export_id UUID REFERENCES exports(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    PRIMARY KEY (export_id, contact_id)
);

-- ============================================
-- QUALIFICATIONS (Import retours CRM)
-- ============================================

CREATE TABLE qualification_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id),
    
    nom_fichier VARCHAR(255),
    nb_lignes INTEGER,
    nb_traites INTEGER DEFAULT 0,
    nb_erreurs INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE TABLE qualification_rules (
    id SERIAL PRIMARY KEY,
    qualification VARCHAR(50) NOT NULL,
    sous_qualification VARCHAR(50),
    
    -- Action à effectuer
    action VARCHAR(50) NOT NULL, -- update_status, exclude, delete, schedule_recall
    new_status contact_status,
    exclude_days INTEGER, -- Nombre de jours d'exclusion
    
    -- Pour les rappels
    recall_days INTEGER, -- Rappeler dans X jours
    max_attempts INTEGER -- Max tentatives avant exclusion
);

INSERT INTO qualification_rules (qualification, sous_qualification, action, new_status, exclude_days, recall_days, max_attempts) VALUES
-- Positifs
('RDV Pris', NULL, 'update_status', 'rdv_pris', NULL, NULL, NULL),
('Relance', NULL, 'update_status', 'relance', NULL, NULL, NULL),
('À Rappeler', NULL, 'schedule_recall', 'a_rappeler', NULL, 3, NULL),

-- Neutres (recontacter)
('NRP', NULL, 'schedule_recall', 'nrp', NULL, 7, 3),
('Injoignable', NULL, 'schedule_recall', 'nrp', NULL, 7, 3),
('Répondeur', NULL, 'schedule_recall', 'nrp', NULL, 3, 5),
('Absent', NULL, 'schedule_recall', 'nrp', NULL, 3, 5),

-- Exclusions définitives
('Black listé', NULL, 'update_status', 'rgpd', NULL, NULL, NULL),
('Refus argumenté', NULL, 'update_status', 'refus', NULL, NULL, NULL),
('Pas intéressé', NULL, 'exclude', 'refus', 180, NULL, NULL),
('Faux Numéro', NULL, 'update_status', 'invalide', NULL, NULL, NULL),

-- Hors cible
('Hors cible', 'Particulier', 'delete', NULL, NULL, NULL, NULL),
('Hors cible', 'À la retraite', 'update_status', 'hors_cible', NULL, NULL, NULL),
('Hors cible', 'En liquidation', 'delete', NULL, NULL, NULL, NULL),
('Hors cible', 'Arrêt de l''activité', 'delete', NULL, NULL, NULL, NULL),
('Hors cible', 'Géré par un siège', 'update_status', 'hors_cible', NULL, NULL, NULL),
('Hors cible', 'Déjà démarché récemment', 'exclude', NULL, 90, NULL, NULL),
('Hors cible', 'Autre', 'update_status', 'hors_cible', NULL, NULL, NULL);

-- ============================================
-- ZONES PERSONNALISÉES
-- ============================================

CREATE TABLE custom_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    departement_code VARCHAR(3) REFERENCES departements(code),
    codes_postaux TEXT[], -- Liste des CP
    description TEXT,
    couleur VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones prédéfinies pour 35 et 59
INSERT INTO custom_zones (nom, departement_code, codes_postaux, description) VALUES
('Rennes Métropole', '35', ARRAY['35000', '35200', '35700', '35510', '35740', '35830'], 'Centre Rennes'),
('Couronne Rennes', '35', ARRAY['35131', '35132', '35133', '35135', '35136', '35170', '35230', '35235', '35310', '35340', '35410', '35516', '35517', '35520', '35650', '35690', '35760', '35770', '35890'], 'Périphérie Rennes'),
('Saint-Malo', '35', ARRAY['35400', '35430', '35540', '35350', '35800'], 'Secteur Saint-Malo'),
('Vitré-Fougères', '35', ARRAY['35500', '35133', '35300', '35460', '35220'], 'Est Ille-et-Vilaine'),

('Lille Métropole', '59', ARRAY['59000', '59800', '59700', '59100', '59160', '59130', '59110', '59120', '59170', '59200', '59260', '59290', '59320', '59370', '59420', '59510', '59520', '59560', '59650', '59780', '59790', '59830', '59910'], 'Centre Lille'),
('Couronne Lille', '59', ARRAY['59113', '59114', '59115', '59116', '59117', '59118', '59126', '59136', '59139', '59152', '59155', '59175', '59193', '59211', '59230', '59236', '59237', '59240', '59242', '59250', '59251', '59252', '59270', '59273', '59274', '59275', '59280', '59281', '59283'], 'Périphérie Lille'),
('Valenciennes', '59', ARRAY['59300', '59220', '59221', '59222', '59224', '59225', '59226', '59227', '59264', '59269', '59282', '59294', '59296', '59410', '59450', '59530', '59590', '59600', '59620', '59680', '59720', '59730', '59750', '59760', '59880', '59890', '59920', '59930', '59940', '59950', '59970', '59980', '59990'], 'Secteur Valenciennes'),
('Dunkerque', '59', ARRAY['59140', '59210', '59229', '59240', '59254', '59279', '59380', '59430', '59470', '59480', '59495', '59550', '59630', '59640', '59670', '59820', '59850', '59960'], 'Secteur Dunkerque'),
('Maubeuge-Avesnes', '59', ARRAY['59132', '59138', '59157', '59177', '59212', '59213', '59214', '59215', '59216', '59218', '59219', '59330', '59332', '59360', '59440', '59460', '59570', '59580', '59610', '59660', '59740', '59810', '59860', '59870'], 'Sud-Est Nord');

-- ============================================
-- CODES POSTAUX AUTORISÉS
-- ============================================

CREATE TABLE authorized_postal_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    departement_code VARCHAR(3) NOT NULL,
    code_postal VARCHAR(5) NOT NULL,
    ville VARCHAR(255),
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code_postal)
);

CREATE INDEX idx_auth_cp_dept ON authorized_postal_codes(departement_code);
CREATE INDEX idx_auth_cp_code ON authorized_postal_codes(code_postal);

-- ============================================
-- CONFIGURATION
-- ============================================

CREATE TABLE config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO config (key, value) VALUES
('id_counter', '1'),
('id_prefix', '"VdS"'),
('default_start_point', '{"postalCode": "59000", "ville": "Lille", "lat": 50.6292, "lon": 3.0573}');

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Normaliser un numéro de téléphone
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS VARCHAR(10) AS $$
DECLARE
    cleaned TEXT;
BEGIN
    IF phone IS NULL OR phone = '' THEN
        RETURN NULL;
    END IF;
    cleaned := regexp_replace(phone, '[^0-9]', '', 'g');
    IF length(cleaned) < 9 THEN
        RETURN NULL;
    END IF;
    RETURN right(cleaned, 10);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normaliser un code postal
CREATE OR REPLACE FUNCTION normalize_postal_code(cp TEXT)
RETURNS VARCHAR(5) AS $$
DECLARE
    cleaned TEXT;
BEGIN
    IF cp IS NULL OR cp = '' THEN
        RETURN NULL;
    END IF;
    cleaned := regexp_replace(cp, '[^0-9]', '', 'g');
    IF length(cleaned) < 4 THEN
        RETURN NULL;
    END IF;
    IF length(cleaned) = 4 THEN
        cleaned := '0' || cleaned;
    END IF;
    RETURN left(cleaned, 5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger pour normaliser les téléphones et CP avant insert/update
CREATE OR REPLACE FUNCTION contacts_before_save()
RETURNS TRIGGER AS $$
BEGIN
    NEW.telephone_normalise := normalize_phone(NEW.telephone);
    NEW.mobile_normalise := normalize_phone(NEW.mobile);
    NEW.code_postal := normalize_postal_code(NEW.code_postal);
    NEW.departement_code := left(NEW.code_postal, 2);
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    -- Déterminer si < 20 salariés
    NEW.is_small_business := NEW.effectif_code IN ('NN', '00', '01', '02', '03', '11');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_before_save
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION contacts_before_save();

-- Générer un nouvel ID fiche
CREATE OR REPLACE FUNCTION generate_id_fiche()
RETURNS VARCHAR(20) AS $$
DECLARE
    counter INTEGER;
    prefix TEXT;
BEGIN
    SELECT (value::text)::integer INTO counter FROM config WHERE key = 'id_counter';
    SELECT value::text INTO prefix FROM config WHERE key = 'id_prefix';
    prefix := trim(both '"' from prefix);
    
    UPDATE config SET value = to_jsonb(counter + 1), updated_at = CURRENT_TIMESTAMP WHERE key = 'id_counter';
    
    RETURN prefix || '_' || lpad(counter::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue des contacts disponibles pour campagne
CREATE VIEW v_contacts_disponibles AS
SELECT c.*, ag.nom as groupe_activite, ag.code as groupe_code
FROM contacts c
LEFT JOIN activity_groups ag ON c.activity_group_id = ag.id
WHERE c.status NOT IN ('rgpd', 'converti', 'hors_cible', 'invalide')
AND (c.date_prochain_rappel IS NULL OR c.date_prochain_rappel <= CURRENT_TIMESTAMP);

-- Vue stats par département
CREATE VIEW v_stats_departement AS
SELECT 
    d.code,
    d.nom,
    COUNT(c.id) as total_contacts,
    COUNT(c.id) FILTER (WHERE c.is_small_business) as small_business,
    COUNT(c.id) FILTER (WHERE c.status = 'nouveau') as nouveaux,
    COUNT(c.id) FILTER (WHERE c.status = 'rdv_pris') as rdv_pris,
    COUNT(c.id) FILTER (WHERE c.status IN ('rgpd', 'refus', 'hors_cible')) as exclus
FROM departements d
LEFT JOIN contacts c ON c.departement_code = d.code
WHERE d.actif = true
GROUP BY d.code, d.nom;

-- Vue stats par groupe d'activité
CREATE VIEW v_stats_activity_group AS
SELECT 
    ag.id,
    ag.code,
    ag.nom,
    ag.horaires_ok,
    ag.couleur,
    COUNT(c.id) as total_contacts,
    COUNT(c.id) FILTER (WHERE c.is_small_business) as small_business,
    COUNT(c.id) FILTER (WHERE c.status = 'nouveau') as nouveaux
FROM activity_groups ag
LEFT JOIN contacts c ON c.activity_group_id = ag.id
GROUP BY ag.id, ag.code, ag.nom, ag.horaires_ok, ag.couleur;
