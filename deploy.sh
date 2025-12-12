#!/bin/bash

# ============================================
# Script de déploiement CRM Prospection
# ============================================

set -e

echo "🚀 Déploiement CRM Prospection"
echo "=============================="

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "Installation de Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installé. Reconnectez-vous pour appliquer les permissions."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Installation de Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo "📝 Configuration de l'environnement..."
    read -p "Mot de passe PostgreSQL: " DB_PASS
    read -p "Domaine (ex: crm.monsite.com ou localhost): " DOMAIN
    
    cat > .env << EOF
DB_PASSWORD=$DB_PASS
CORS_ORIGIN=http://$DOMAIN
API_URL=http://$DOMAIN/api
EOF
    
    # Copier aussi pour le backend
    cat > backend/.env << EOF
DB_HOST=postgres
DB_PORT=5432
DB_NAME=crm_prospection
DB_USER=postgres
DB_PASSWORD=$DB_PASS
PORT=3001
NODE_ENV=production
CORS_ORIGIN=http://$DOMAIN
EOF
    
    echo "✅ Fichiers .env créés"
fi

# Démarrer les services
echo "🐳 Démarrage des services..."
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose up -d --build

echo ""
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier les services
echo ""
echo "📊 État des services:"
docker-compose ps

# Test de connexion
echo ""
echo "🔍 Test de l'API..."
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    echo "✅ API OK"
else
    echo "⚠️  API non accessible, vérifiez les logs:"
    echo "   docker-compose logs backend"
fi

echo ""
echo "============================================"
echo "✅ Déploiement terminé !"
echo ""
echo "📌 Accès:"
echo "   - Frontend: http://localhost"
echo "   - API: http://localhost:3001/api"
echo ""
echo "📌 Commandes utiles:"
echo "   - Logs: docker-compose logs -f"
echo "   - Arrêter: docker-compose down"
echo "   - Redémarrer: docker-compose restart"
echo "============================================"
