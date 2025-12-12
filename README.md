# 🎯 Base Manager - Préparation de Bases B2B

**Outil de préparation et d'enrichissement de bases de données commerciales** avant injection dans le CRM de prospection SFR Pro.

## 🎯 Objectif

Ce n'est PAS un CRM de prospection, mais un **outil de préparation de données** qui permet de :
- Importer des fichiers bruts (Excel/CSV) de contacts
- Enrichir automatiquement avec les APIs officielles françaises
- Filtrer et organiser les contacts par critères métier
- Exporter des bases propres et enrichies pour le CRM SFR Pro

## ✨ Fonctionnalités

- **Import intelligent** : Mapping automatique des colonnes, détection doublons
- **Enrichissement API** : SIRET, effectif, dirigeant, géocodage, temps de trajet
- **Classification automatique** : 10 groupes d'activité avec horaires d'appel
- **Filtres avancés** : Effectif, distance, département, activité
- **Export multi-format** : XLSX et CSV optimisés pour SFR Pro

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NGINX (Port 80/443)                  │
│                    Reverse Proxy + Static               │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   Frontend    │           │   Backend     │
│   React/Vite  │           │   Node.js     │
│   Port 80     │           │   Port 3001   │
└───────────────┘           └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  PostgreSQL   │
                            │   Port 5432   │
                            └───────────────┘
```

## 🚀 Déploiement rapide (Docker)

### Prérequis
- Docker & Docker Compose
- 2GB RAM minimum
- 20GB espace disque

### Installation

```bash
# 1. Cloner le projet
git clone <repo-url> crm-prospection
cd crm-prospection

# 2. Configurer l'environnement
cp backend/.env.example backend/.env
nano backend/.env  # Modifier DB_PASSWORD

# 3. Créer le fichier .env à la racine
cat > .env << EOF
DB_PASSWORD=VotreMotDePasseSecurisé
CORS_ORIGIN=http://votre-domaine.com
API_URL=http://votre-domaine.com/api
EOF

# 4. Lancer les services
docker-compose up -d

# 5. Vérifier
docker-compose ps
docker-compose logs -f
```

### Accès
- Frontend : http://localhost
- API : http://localhost:3001/api
- Health check : http://localhost:3001/api/health

## 🛠️ Déploiement manuel (VPS)

### 1. Installer PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Créer la base de données
sudo -u postgres psql
CREATE DATABASE crm_prospection;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE crm_prospection TO crm_user;
\q

# Initialiser le schéma
psql -U crm_user -d crm_prospection -f database/schema.sql
```

### 2. Installer Node.js

```bash
# Via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs

# Vérifier
node -v  # v18.x
npm -v
```

### 3. Configurer le backend

```bash
cd backend

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
nano .env
# Modifier :
# DB_HOST=localhost
# DB_USER=crm_user
# DB_PASSWORD=votre_mot_de_passe
# DB_NAME=crm_prospection

# Tester
npm run dev

# Production avec PM2
npm install -g pm2
pm2 start src/server.js --name crm-backend
pm2 save
pm2 startup
```

### 4. Configurer le frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Build production
npm run build

# Les fichiers sont dans dist/
```

### 5. Configurer Nginx

```bash
sudo apt install nginx

# Copier la config
sudo cp nginx.conf /etc/nginx/sites-available/crm
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Copier le frontend buildé
sudo mkdir -p /var/www/crm
sudo cp -r frontend/dist/* /var/www/crm/

# Modifier nginx.conf
sudo nano /etc/nginx/sites-available/crm
# Changer : root /var/www/crm;

# Redémarrer
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL avec Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

## 📊 API Endpoints

### Contacts
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/contacts | Liste avec filtres |
| GET | /api/contacts/:id | Détail d'un contact |
| POST | /api/contacts | Créer un contact |
| PUT | /api/contacts/:id | Modifier |
| DELETE | /api/contacts/:id | Supprimer |
| POST | /api/contacts/bulk-update | Mise à jour en masse |
| POST | /api/contacts/remove-duplicates | Supprimer doublons |

### Campagnes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/campaigns | Liste des campagnes |
| POST | /api/campaigns | Créer une campagne |
| POST | /api/campaigns/:id/populate | Peupler avec contacts |
| POST | /api/campaigns/:id/qualify | Qualifier des contacts |
| GET | /api/campaigns/:id/contacts | Contacts de la campagne |

### Import/Export
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/import/analyze | Analyser fichier |
| POST | /api/import/process | Importer données |
| POST | /api/import/qualifications | Importer retours CRM |
| POST | /api/exports | Exporter (XLSX/CSV) |
| POST | /api/exports/campaign/:id | Exporter campagne |

### Enrichissement (APIs Officielles)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/enrichment/status | État de l'enrichissement |
| POST | /api/enrichment/entreprise | SIRET, NAF, effectif, dirigeant (API Sirene) |
| POST | /api/enrichment/geocode | Latitude, longitude (API Adresse) |
| POST | /api/enrichment/trajets | Distance, durée (API IGN) |
| POST | /api/enrichment/all | Enrichissement complet |
| POST | /api/enrichment/detect-activity | Détection groupe activité |
| POST | /api/enrichment/single/:id | Enrichir un contact |

### Référence
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/reference/departements | Départements |
| GET | /api/reference/activity-groups | Groupes d'activité |
| GET | /api/reference/zones | Zones personnalisées |
| GET | /api/reference/qualifications | Qualifications CRM |
| POST | /api/reference/geocode | Géocoder code postal |

### Statistiques
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/stats/overview | Vue d'ensemble |
| GET | /api/stats/by-departement | Par département |
| GET | /api/stats/by-activity-group | Par activité |
| GET | /api/stats/campaign/:id | Stats campagne |

## 📁 Structure des fichiers

```
crm-prospection/
├── database/
│   └── schema.sql          # Schéma PostgreSQL complet
├── backend/
│   ├── src/
│   │   ├── server.js       # Serveur Express
│   │   ├── db.js           # Connexion PostgreSQL
│   │   └── routes/
│   │       ├── contacts.js
│   │       ├── campaigns.js
│   │       ├── import.js
│   │       ├── exports.js
│   │       ├── reference.js
│   │       └── stats.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   └── App.jsx         # Application React
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## 🔧 Configuration des groupes d'activité

Les groupes sont préconfigurés dans `schema.sql` :

| Code | Nom | Horaires OK |
|------|-----|-------------|
| RESTAURATION | Restauration | 9h-11h, 15h-18h |
| BEAUTE | Beauté & Bien-être | 9h-10h30, 14h-15h |
| BTP | Artisans & BTP | 7h30-8h30, 12h-13h30, 18h-19h |
| SANTE | Santé & Médical | 8h-9h, 12h-14h, 19h-20h |
| COMMERCE | Commerce de détail | 9h30-11h30, 14h30-17h |
| SERVICES | Services & Bureaux | 9h-12h, 14h-18h |
| AUTO | Automobile | 8h-12h, 14h-18h |
| HOTEL | Hôtellerie & Tourisme | 10h-12h, 15h-17h |
| FORMATION | Formation | 9h-11h30, 14h-17h |
| SERVICES_PERSONNE | Services à la personne | 9h-12h, 14h-17h |

## 📋 Qualifications CRM

### Positif
- RDV Pris → Status "rdv_pris"
- Relance → Status "relance"
- À Rappeler → Rappel programmé

### Neutre (recontacter)
- NRP → Rappel 7 jours (max 3 tentatives)
- Injoignable → Rappel 7 jours
- Répondeur → Rappel 3 jours (max 5)
- Absent → Rappel 3 jours

### Négatif
- Black listé → Status "rgpd"
- Refus argumenté → Status "refus"
- Pas intéressé → Exclusion 180 jours
- Faux Numéro → Status "invalide"

### Hors cible
- Particulier → Suppression
- À la retraite → Exclusion
- En liquidation → Suppression
- Arrêt activité → Suppression
- Géré par siège → Exclusion
- Déjà démarché → Exclusion 90 jours

## 🔒 Sécurité

- [ ] Changer le mot de passe PostgreSQL par défaut
- [ ] Configurer HTTPS avec certificat SSL
- [ ] Limiter les accès réseau au backend
- [ ] Mettre en place une authentification (à implémenter)
- [ ] Configurer les backups PostgreSQL

## 🆘 Dépannage

### La base ne se connecte pas
```bash
# Vérifier PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1"

# Vérifier les logs
docker-compose logs postgres
```

### L'API ne répond pas
```bash
# Vérifier le backend
pm2 status
pm2 logs crm-backend

# Ou avec Docker
docker-compose logs backend
```

### Erreur d'import
- Vérifier l'encodage du fichier (UTF-8 recommandé)
- Vérifier que les colonnes sont bien mappées
- Consulter les logs backend

## 📝 TODO

- [ ] Authentification utilisateurs
- [ ] Multi-utilisateurs avec rôles
- [ ] Dashboard graphique
- [ ] Notifications email
- [ ] Planificateur de campagnes
- [ ] API externe pour intégration CRM

## 📄 Licence

Propriétaire - Usage interne uniquement
