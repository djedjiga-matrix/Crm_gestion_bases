import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload, Download, Search, Filter, Plus, Trash2, Edit, Eye,
  Users, Target, FileSpreadsheet, Settings, Home, RefreshCw,
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Clock,
  MapPin, Phone, Mail, Building, Calendar, TrendingUp,
  Loader2, FileText, BarChart3, Zap, CheckCircle2, Database,
  Navigation, Play, Pause, MapPinned, Building2, Route, Shield, Map
} from 'lucide-react';

const API_URL = '/api';

// ============================================
// API Client
// ============================================
const api = {
  async get(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post(endpoint, data, isFormData = false) {
    const options = {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
    };
    if (!isFormData) {
      options.headers = { 'Content-Type': 'application/json' };
    }
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(await res.text());
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return res.json();
    }
    return res.blob();
  },
  async put(endpoint, data) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async delete(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ============================================
// Utility Components
// ============================================
const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled, loading, icon: Icon }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    warning: 'bg-orange-500 text-white hover:bg-orange-600',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]} disabled:cursor-not-allowed`}
    >
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', onClick }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <Card className={`p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
  return (
    <div className={`fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center z-50`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
      {message}
    </div>
  );
};

const ProgressBar = ({ value, max, label }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{value?.toLocaleString()} / {max?.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

// ============================================
// Dashboard Component
// ============================================
const Dashboard = ({ stats, enrichmentStatus, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-gray-500">Gestionnaire de bases de données B2B</p>
        </div>
        <Button onClick={onRefresh} variant="outline" icon={RefreshCw}>Actualiser</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Contacts" value={stats?.contacts?.total} icon={Users} color="blue" />
        <StatCard title="TPE (< 20 sal.)" value={stats?.contacts?.small_business} icon={Building} color="green" />
        <StatCard title="Jamais exportés" value={stats?.contacts?.jamais_exportes} icon={FileSpreadsheet} color="purple" />
        <StatCard title="À enrichir" value={enrichmentStatus?.a_enrichir} icon={Database} color="orange" />
      </div>

      {/* Enrichment Status */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          État de l'enrichissement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressBar
            value={enrichmentStatus?.avec_siret}
            max={stats?.contacts?.total}
            label="Avec SIRET"
          />
          <ProgressBar
            value={enrichmentStatus?.geocodes}
            max={stats?.contacts?.total}
            label="Géocodés"
          />
          <ProgressBar
            value={enrichmentStatus?.avec_trajet}
            max={stats?.contacts?.total}
            label="Trajets calculés"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Répartition par statut</h3>
          <div className="space-y-3">
            {[
              { label: 'Nouveaux', value: stats?.contacts?.nouveaux, color: 'bg-blue-500' },
              { label: 'En campagne', value: stats?.contacts?.en_campagne, color: 'bg-yellow-500' },
              { label: 'RDV Pris', value: stats?.contacts?.rdv_pris, color: 'bg-green-500' },
              { label: 'Relance', value: stats?.contacts?.relance, color: 'bg-purple-500' },
              { label: 'Exclus', value: stats?.contacts?.exclus, color: 'bg-red-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${item.color} mr-3`}></div>
                <span className="flex-1">{item.label}</span>
                <span className="font-medium">{item.value?.toLocaleString() || 0}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Qualité des données</h3>
          <div className="space-y-3">
            {[
              { label: 'Avec effectif', value: enrichmentStatus?.avec_effectif, total: stats?.contacts?.total },
              { label: 'Géocodés', value: enrichmentStatus?.geocodes, total: stats?.contacts?.total },
              { label: 'Trajets calculés', value: enrichmentStatus?.avec_trajet, total: stats?.contacts?.total },
              { label: '< 30 min trajet', value: stats?.contacts?.moins_30min, total: stats?.contacts?.total },
            ].map(item => {
              const pct = item.total ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span>{item.value?.toLocaleString() || 0} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================
// Enrichment Page Component
// ============================================
const EnrichmentPage = ({ onComplete, showToast }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [startPostalCode, setStartPostalCode] = useState('');
  const [batchSize, setBatchSize] = useState(100);
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState([]);

  useEffect(() => {
    loadStatus();
    loadPreview();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.get('/enrichment/status');
      setStatus(data);
    } catch (err) {
      console.error('Error loading status:', err);
    }
  };

  const loadPreview = async () => {
    try {
      const data = await api.get('/enrichment/preview?limit=5');
      setPreview(data);
    } catch (err) {
      console.error('Error loading preview:', err);
    }
  };

  const runEnrichment = async (type) => {
    setLoading(true);
    setCurrentTask(type);
    setResults(null);

    try {
      let data;
      switch (type) {
        case 'entreprise':
          data = await api.post('/enrichment/entreprise', { limit: batchSize });
          break;
        case 'geocode':
          data = await api.post('/enrichment/geocode', { limit: batchSize });
          break;
        case 'trajets':
          if (!startPostalCode) {
            showToast('Veuillez entrer un code postal de départ', 'error');
            setLoading(false);
            setCurrentTask(null);
            return;
          }
          data = await api.post('/enrichment/trajets', { limit: batchSize, startPostalCode });
          break;
        case 'all':
          data = await api.post('/enrichment/all', { limit: batchSize, startPostalCode: startPostalCode || undefined });
          break;
        case 'activity':
          data = await api.post('/enrichment/detect-activity');
          break;
      }

      setResults(data.results);
      showToast('Enrichissement terminé !', 'success');
      loadStatus();
      loadPreview();
      onComplete?.();
    } catch (err) {
      console.error('Error running enrichment:', err);
      showToast('Erreur lors de l\'enrichissement', 'error');
    }

    setLoading(false);
    setCurrentTask(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enrichissement des données</h1>
          <p className="text-gray-500">APIs officielles françaises (Sirene, Adresse, IGN)</p>
        </div>
        <Button onClick={loadStatus} variant="outline" icon={RefreshCw}>Actualiser</Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total" value={status?.total} icon={Users} color="blue" />
        <StatCard title="Avec SIRET" value={status?.avec_siret} icon={Building2} color="green" />
        <StatCard title="Avec effectif" value={status?.avec_effectif} icon={Users} color="purple" />
        <StatCard title="Géocodés" value={status?.geocodes} icon={MapPin} color="yellow" />
        <StatCard title="Avec trajet" value={status?.avec_trajet} icon={Route} color="orange" />
      </div>

      {/* Configuration */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code postal de départ (pour trajets)
            </label>
            <input
              type="text"
              value={startPostalCode}
              onChange={(e) => setStartPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Ex: 35000, 59000..."
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              maxLength={5}
            />
            <p className="text-xs text-gray-500 mt-1">Centre de la commune utilisé comme point de départ</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Taille du lot
            </label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value={50}>50 contacts</option>
              <option value={100}>100 contacts</option>
              <option value={200}>200 contacts</option>
              <option value={500}>500 contacts</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Plus le lot est grand, plus l'enrichissement prend du temps</p>
          </div>
        </div>
      </Card>

      {/* Enrichment Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold">Données Entreprise</h4>
              <p className="text-sm text-gray-500">SIRET, NAF, effectif, dirigeant</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            API Sirene - Recherche par nom + CP
          </p>
          <Button
            onClick={() => runEnrichment('entreprise')}
            loading={currentTask === 'entreprise'}
            disabled={loading}
            icon={Zap}
            className="w-full"
          >
            Enrichir entreprises
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold">Géocodage</h4>
              <p className="text-sm text-gray-500">Latitude, longitude</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            API Adresse - Géolocalisation précise
          </p>
          <Button
            onClick={() => runEnrichment('geocode')}
            loading={currentTask === 'geocode'}
            disabled={loading}
            variant="success"
            icon={MapPinned}
            className="w-full"
          >
            Géocoder
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Route className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h4 className="font-semibold">Temps de trajet</h4>
              <p className="text-sm text-gray-500">Distance, durée en voiture</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            API IGN - Itinéraire depuis point de départ
          </p>
          <Button
            onClick={() => runEnrichment('trajets')}
            loading={currentTask === 'trajets'}
            disabled={loading || !startPostalCode}
            variant="warning"
            icon={Navigation}
            className="w-full"
          >
            Calculer trajets
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold">Enrichissement complet</h4>
              <p className="text-sm text-gray-500">Tout en une passe</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Entreprise + Géocodage + Trajets
          </p>
          <Button
            onClick={() => runEnrichment('all')}
            loading={currentTask === 'all'}
            disabled={loading}
            variant="primary"
            icon={Play}
            className="w-full"
          >
            Tout enrichir
          </Button>
        </Card>
      </div>

      {/* Activity Group Detection */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Détection automatique des groupes d'activité</h3>
            <p className="text-sm text-gray-500 mt-1">
              Classe automatiquement les contacts par secteur (Restauration, BTP, Commerce...)
              selon leur catégorie et code NAF
            </p>
          </div>
          <Button
            onClick={() => runEnrichment('activity')}
            loading={currentTask === 'activity'}
            disabled={loading}
            variant="secondary"
            icon={Target}
          >
            Détecter activités
          </Button>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Résultats du dernier enrichissement
          </h3>

          {results.total !== undefined && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">{results.total}</div>
                <div className="text-sm text-gray-500">Traités</div>
              </div>
              {results.enriched !== undefined && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.enriched}</div>
                  <div className="text-sm text-gray-500">Enrichis</div>
                </div>
              )}
              {results.geocoded !== undefined && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.geocoded}</div>
                  <div className="text-sm text-gray-500">Géocodés</div>
                </div>
              )}
              {results.calculated !== undefined && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.calculated}</div>
                  <div className="text-sm text-gray-500">Trajets calculés</div>
                </div>
              )}
              {results.not_found !== undefined && (
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{results.not_found}</div>
                  <div className="text-sm text-gray-500">Non trouvés</div>
                </div>
              )}
              {results.errors !== undefined && (
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{results.errors}</div>
                  <div className="text-sm text-gray-500">Erreurs</div>
                </div>
              )}
            </div>
          )}

          {/* Detailed results for "all" enrichment */}
          {results.entreprise && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Entreprises</h4>
                <p className="text-sm">Enrichis: <span className="font-bold text-green-600">{results.entreprise.enriched}</span></p>
                <p className="text-sm">Non trouvés: <span className="font-bold text-yellow-600">{results.entreprise.not_found}</span></p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Géocodage</h4>
                <p className="text-sm">Géocodés: <span className="font-bold text-green-600">{results.geocode.geocoded}</span></p>
                <p className="text-sm">Non trouvés: <span className="font-bold text-yellow-600">{results.geocode.not_found}</span></p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Trajets</h4>
                <p className="text-sm">Calculés: <span className="font-bold text-green-600">{results.trajets.calculated}</span></p>
                <p className="text-sm">Erreurs: <span className="font-bold text-red-600">{results.trajets.errors}</span></p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Preview */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Aperçu des contacts à enrichir</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CP / Ville</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SIRET</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Géoloc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trajet</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {preview.map(contact => (
                <tr key={contact.id}>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{contact.id_fiche}</td>
                  <td className="px-4 py-3 text-sm font-medium">{contact.nom}</td>
                  <td className="px-4 py-3 text-sm">{contact.code_postal} {contact.ville}</td>
                  <td className="px-4 py-3 text-sm">
                    {contact.siret ? <Badge color="green">✓</Badge> : <Badge color="red">Manquant</Badge>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {contact.latitude ? <Badge color="green">✓</Badge> : <Badge color="red">Manquant</Badge>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {contact.duree_secondes ? <span>{Math.round(contact.duree_secondes / 60)} min</span> : <Badge color="gray">-</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ============================================
// Contacts List Component
// ============================================
const ContactsList = ({ showToast }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    search: '', departement: '', activityGroup: '', status: '',
    smallBusiness: false, maxDuree: '', onlyNew: false, authorizedOnly: false,
  });
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [activityGroups, setActivityGroups] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [hasAuthorizedCp, setHasAuthorizedCp] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page, limit: 50,
        ...(filters.search && { search: filters.search }),
        ...(filters.departement && { departement: filters.departement }),
        ...(filters.activityGroup && { activityGroup: filters.activityGroup }),
        ...(filters.status && { status: filters.status }),
        ...(filters.smallBusiness && { smallBusiness: 'true' }),
        ...(filters.maxDuree && { maxDuree: filters.maxDuree }),
        ...(filters.onlyNew && { onlyNew: 'true' }),
        ...(filters.authorizedOnly && { authorizedOnly: 'true' }),
      });
      const data = await api.get(`/contacts?${params}`);
      setContacts(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
    setLoading(false);
  }, [pagination.page, filters]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  useEffect(() => {
    api.get('/reference/activity-groups').then(setActivityGroups).catch(console.error);
    api.get('/reference/departements?actifOnly=true').then(setDepartements).catch(console.error);
    api.get('/authorized-cp').then(data => setHasAuthorizedCp(data.length > 0)).catch(() => { });
  }, []);

  const handleSelectAll = (e) => setSelectedContacts(e.target.checked ? contacts.map(c => c.id) : []);
  const handleSelect = (id) => setSelectedContacts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleExport = async (format) => {
    try {
      const blob = await api.post('/exports', { format, filters });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export réussi !', 'success');
      loadContacts();
    } catch (err) {
      console.error('Error exporting:', err);
      showToast('Erreur lors de l\'export', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts ({pagination.total?.toLocaleString()})</h1>
        <div className="flex gap-2">
          <Button onClick={loadContacts} variant="outline" icon={RefreshCw}>Actualiser</Button>
          <Button onClick={() => handleExport('xlsx')} variant="success" icon={Download}>Excel</Button>
          <Button onClick={() => handleExport('csv')} variant="secondary" icon={FileText}>CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Rechercher..." value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <select value={filters.departement} onChange={(e) => setFilters(prev => ({ ...prev, departement: e.target.value }))} className="border rounded-lg px-3 py-2">
            <option value="">Tous départements</option>
            {departements.map(d => <option key={d.code} value={d.code}>{d.code} - {d.nom}</option>)}
          </select>
          <select value={filters.activityGroup} onChange={(e) => setFilters(prev => ({ ...prev, activityGroup: e.target.value }))} className="border rounded-lg px-3 py-2">
            <option value="">Toutes activités</option>
            {activityGroups.map(g => <option key={g.code} value={g.code}>{g.nom}</option>)}
          </select>
          <select value={filters.maxDuree} onChange={(e) => setFilters(prev => ({ ...prev, maxDuree: e.target.value }))} className="border rounded-lg px-3 py-2">
            <option value="">Tous trajets</option>
            <option value="15">≤ 15 min</option>
            <option value="30">≤ 30 min</option>
            <option value="45">≤ 45 min</option>
            <option value="60">≤ 1h</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.smallBusiness} onChange={(e) => setFilters(prev => ({ ...prev, smallBusiness: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm">TPE</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.onlyNew} onChange={(e) => setFilters(prev => ({ ...prev, onlyNew: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm">Non exportés</span>
          </label>
          {hasAuthorizedCp && (
            <label className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
              <input type="checkbox" checked={filters.authorizedOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, authorizedOnly: e.target.checked }))}
                className="w-4 h-4 accent-purple-600" />
              <span className="text-sm font-medium text-purple-700">CP autorisés</span>
            </label>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-12"><input type="checkbox" onChange={handleSelectAll} checked={selectedContacts.length === contacts.length && contacts.length > 0} className="w-4 h-4" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localisation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effectif</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trajet</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">Aucun contact trouvé</td></tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedContacts.includes(contact.id)} onChange={() => handleSelect(contact.id)} className="w-4 h-4" /></td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{contact.id_fiche}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{contact.nom}</div>
                      {contact.siret && <div className="text-xs text-gray-500">SIRET: {contact.siret}</div>}
                      {contact.dirigeant && <div className="text-xs text-gray-400">{contact.dirigeant}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{contact.code_postal} {contact.ville}</div>
                      {contact.latitude && <div className="text-xs text-green-600">✓ Géocodé</div>}
                    </td>
                    <td className="px-4 py-3">
                      {contact.telephone && <div className="flex items-center text-sm"><Phone className="w-3 h-3 mr-1 text-gray-400" />{contact.telephone}</div>}
                      {contact.email && <div className="flex items-center text-sm text-gray-500"><Mail className="w-3 h-3 mr-1 text-gray-400" />{contact.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {contact.effectif_label ? (
                        <span className={`text-sm ${contact.is_small_business ? 'text-green-600 font-medium' : ''}`}>{contact.effectif_label}</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {contact.groupe_code ? <Badge color="purple">{contact.groupe_code}</Badge> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {contact.duree_secondes ? (
                        <div className="text-sm">
                          <div className="font-medium">{Math.round(contact.duree_secondes / 60)} min</div>
                          <div className="text-xs text-gray-500">{(contact.distance_metres / 1000).toFixed(1)} km</div>
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-500">Page {pagination.page} sur {pagination.totalPages} ({pagination.total} résultats)</div>
          <div className="flex gap-2">
            <Button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page <= 1} variant="outline" size="sm"><ChevronLeft className="w-4 h-4" /></Button>
            <Button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.totalPages} variant="outline" size="sm"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ============================================
// Import Component
// ============================================
const ImportPage = ({ onImportComplete, showToast }) => {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [mapping, setMapping] = useState({});
  const [mode, setMode] = useState('new');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const targetFields = [
    { key: 'nom', label: 'Nom entreprise', required: true },
    { key: 'adresse', label: 'Adresse' }, { key: 'code_postal', label: 'Code postal' },
    { key: 'ville', label: 'Ville' }, { key: 'telephone', label: 'Téléphone' },
    { key: 'mobile', label: 'Mobile' }, { key: 'email', label: 'Email' },
    { key: 'siret', label: 'SIRET' }, { key: 'categorie', label: 'Catégorie/Activité' },
    { key: 'effectif_code', label: 'Effectif (code)' }, { key: 'effectif_label', label: 'Effectif (label)' },
    { key: 'dirigeant', label: 'Dirigeant' }, { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' }, { key: 'id_fiche', label: 'ID Fiche (existant)' },
  ];

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const data = await api.post('/import/analyze', formData, true);
      setAnalysis(data);
      setMapping(data.autoMapping || {});
    } catch (err) {
      showToast('Erreur lors de l\'analyse', 'error');
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!file || !analysis) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('mode', mode);
      const data = await api.post('/import/process', formData, true);
      setResult(data.results);
      showToast(`Import terminé: ${data.results.imported} contacts`, 'success');
      onImportComplete?.();
    } catch (err) {
      setResult({ error: err.message });
      showToast('Erreur lors de l\'import', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import de fichier</h1>
      <Card className="p-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium">Cliquez ou déposez un fichier</p>
            <p className="text-sm text-gray-500 mt-1">Excel (.xlsx, .xls) ou CSV</p>
          </label>
        </div>
        {file && (
          <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center"><FileSpreadsheet className="w-5 h-5 text-blue-600 mr-2" /><span className="font-medium">{file.name}</span></div>
            {analysis && <span className="text-sm text-gray-600">{analysis.totalRows} lignes</span>}
          </div>
        )}
      </Card>

      {analysis && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Mapping des colonnes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targetFields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select value={mapping[field.key] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                  <option value="">-- Non mappé --</option>
                  {analysis.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode d'import</label>
            <div className="flex gap-4">
              {[{ value: 'new', label: 'Nouveaux uniquement' }, { value: 'update', label: 'Mettre à jour + Ajouter' }, { value: 'all', label: 'Tout importer' }].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input type="radio" name="mode" value={opt.value} checked={mode === opt.value} onChange={(e) => setMode(e.target.value)} />
                  <span className="font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleImport} loading={loading} icon={Upload}>Importer {analysis.totalRows} lignes</Button>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Résultat de l'import</h3>
          {result.error ? (
            <div className="text-red-600 flex items-center"><AlertCircle className="w-5 h-5 mr-2" />{result.error}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg"><div className="text-2xl font-bold">{result.total}</div><div className="text-sm text-gray-500">Total</div></div>
              <div className="text-center p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-600">{result.imported}</div><div className="text-sm text-gray-500">Importés</div></div>
              <div className="text-center p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-600">{result.updated}</div><div className="text-sm text-gray-500">Mis à jour</div></div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg"><div className="text-2xl font-bold text-yellow-600">{result.duplicates}</div><div className="text-sm text-gray-500">Doublons</div></div>
              <div className="text-center p-4 bg-red-50 rounded-lg"><div className="text-2xl font-bold text-red-600">{result.errors}</div><div className="text-sm text-gray-500">Erreurs</div></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

// ============================================
// Settings Component
// ============================================
const SettingsPage = ({ showToast }) => {
  const [activityGroups, setActivityGroups] = useState([]);
  const [departements, setDepartements] = useState([]);

  useEffect(() => {
    api.get('/reference/activity-groups').then(setActivityGroups).catch(console.error);
    api.get('/reference/departements').then(setDepartements).catch(console.error);
  }, []);

  const toggleDepartement = async (code) => {
    try {
      await api.put(`/reference/departements/${code}/toggle`);
      const data = await api.get('/reference/departements');
      setDepartements(data);
      showToast('Département mis à jour', 'success');
    } catch (err) {
      showToast('Erreur', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Groupes d'activité (avec horaires d'appel recommandés)</h3>
        <div className="grid gap-3">
          {activityGroups.map(g => (
            <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: g.couleur }}></div>
                <div>
                  <div className="font-medium">{g.nom}</div>
                  <div className="text-sm text-gray-500">{g.horaires_ok && `Horaires: ${JSON.parse(g.horaires_ok).join(', ')}`}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{g.nb_contacts || 0} contacts</div>
                <div className="text-sm text-green-600">{g.nb_small_business || 0} TPE</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Départements actifs</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {departements.map(d => (
            <button key={d.code} onClick={() => toggleDepartement(d.code)}
              className={`flex items-center justify-between p-2 border rounded-lg transition-colors ${d.actif ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}>
              <span className="text-sm font-medium">{d.code}</span>
              {d.nb_contacts > 0 && <span className="text-xs text-gray-500">({d.nb_contacts})</span>}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ============================================
// Authorized CP Component
// ============================================
const AuthorizedCpPage = ({ showToast, onUpdate }) => {
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [newCodes, setNewCodes] = useState('');
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesData, statsData] = await Promise.all([
        api.get(`/authorized-cp${filterDept ? `?departement=${filterDept}` : ''}`),
        api.get('/authorized-cp/stats'),
      ]);
      setCodes(codesData);
      setStats(statsData);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filterDept]);

  const handleAddBulk = async () => {
    if (!newCodes.trim()) return;
    try {
      const result = await api.post('/authorized-cp/bulk', { codes_postaux: newCodes });
      showToast(`${result.results.imported} CP ajoutés`, 'success');
      setNewCodes('');
      loadData();
      onUpdate?.();
    } catch (err) { showToast('Erreur', 'error'); }
  };

  const handleFileImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.post('/authorized-cp/import', formData, true);
      setImportResult(result.results);
      showToast(`${result.results.imported} CP importés`, 'success');
      setFile(null);
      loadData();
      onUpdate?.();
    } catch (err) { showToast('Erreur', 'error'); }
    setLoading(false);
  };

  const handleDelete = async (cp) => {
    if (!confirm(`Supprimer le CP ${cp} ?`)) return;
    try {
      await api.delete(`/authorized-cp/${cp}`);
      showToast('CP supprimé', 'success');
      loadData();
      onUpdate?.();
    } catch (err) { showToast('Erreur', 'error'); }
  };

  const handleDeleteDept = async (dept) => {
    if (!confirm(`Supprimer tous les CP du département ${dept} ?`)) return;
    try {
      const result = await api.delete(`/authorized-cp/departement/${dept}`);
      showToast(`${result.deleted} CP supprimés`, 'success');
      loadData();
      onUpdate?.();
    } catch (err) { showToast('Erreur', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Codes postaux autorisés</h1>
          <p className="text-gray-500">Définissez les CP sur lesquels vous pouvez travailler</p>
        </div>
        <Button onClick={loadData} variant="outline" icon={RefreshCw}>Actualiser</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total CP autorisés" value={codes.length} icon={Shield} color="purple" />
        <StatCard title="Départements" value={[...new Set(codes.map(c => c.departement_code))].length} icon={Map} color="blue" />
        <StatCard title="Contacts disponibles" value={codes.reduce((s, c) => s + (c.nb_contacts || 0), 0)} icon={Users} color="green" />
      </div>

      {/* Import fichier */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Importer depuis un fichier Excel/CSV</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files[0])} className="w-full border rounded-lg px-4 py-2" />
            <p className="text-xs text-gray-500 mt-1">Le fichier doit contenir une colonne "Code Postal" ou "CP"</p>
          </div>
          <Button onClick={handleFileImport} loading={loading} disabled={!file} icon={Upload}>Importer</Button>
        </div>
        {importResult && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            Import : {importResult.imported} importés, {importResult.duplicates} doublons, {importResult.errors} erreurs
          </div>
        )}
      </Card>

      {/* Ajout manuel */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Ajouter manuellement</h3>
        <div className="flex gap-4">
          <textarea value={newCodes} onChange={(e) => setNewCodes(e.target.value)}
            placeholder="Ex: 59000, 59100, 59200..." className="flex-1 border rounded-lg px-4 py-2 h-24" />
          <Button onClick={handleAddBulk} icon={Plus}>Ajouter</Button>
        </div>
      </Card>

      {/* Liste par département */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Liste ({codes.length} CP)</h3>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="">Tous les départements</option>
            {stats.map(s => <option key={s.departement_code} value={s.departement_code}>{s.departement_code} - {s.departement_nom}</option>)}
          </select>
        </div>

        {stats.map(dept => (
          <div key={dept.departement_code} className="mb-6">
            <div className="flex items-center justify-between mb-2 p-3 bg-gray-100 rounded-lg">
              <div>
                <span className="font-bold">{dept.departement_code} - {dept.departement_nom}</span>
                <span className="ml-4 text-sm text-gray-600">{dept.nb_cp_autorises} CP • {dept.nb_contacts_autorises} contacts</span>
              </div>
              <Button onClick={() => handleDeleteDept(dept.departement_code)} variant="danger" size="sm" icon={Trash2}>Supprimer tout</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {codes.filter(c => c.departement_code === dept.departement_code).map(cp => (
                <div key={cp.code_postal} className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full">
                  <span className="font-mono">{cp.code_postal}</span>
                  {cp.ville && <span className="text-sm text-gray-500">{cp.ville}</span>}
                  <span className="text-xs text-gray-400">({cp.nb_contacts || 0})</span>
                  <button onClick={() => handleDelete(cp.code_postal)} className="text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {codes.length === 0 && <p className="text-center text-gray-500 py-8">Aucun CP autorisé</p>}
      </Card>
    </div>
  );
};

// ============================================
// Main App
// ============================================
export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [enrichmentStatus, setEnrichmentStatus] = useState(null);
  const [authorizedStats, setAuthorizedStats] = useState({ totalCp: 0, totalContacts: 0, byDept: [] });
  const [toast, setToast] = useState(null);

  const loadData = async () => {
    try {
      const [statsData, enrichData, authData] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/enrichment/status'),
        api.get('/authorized-cp/stats'),
      ]);
      setStats(statsData);
      setEnrichmentStatus(enrichData);
      setAuthorizedStats({
        totalCp: authData.reduce((s, d) => s + parseInt(d.nb_cp_autorises || 0), 0),
        totalContacts: authData.reduce((s, d) => s + parseInt(d.nb_contacts_autorises || 0), 0),
        byDept: authData,
      });
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => { loadData(); }, []);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'authorized-cp', label: 'CP Autorisés', icon: Shield },
    { id: 'enrichment', label: 'Enrichissement', icon: Zap },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-40">
        <div className="p-6">
          <h1 className="text-xl font-bold text-blue-600">Base Manager</h1>
          <p className="text-xs text-gray-500 mt-1">Préparation données B2B</p>
        </div>
        <nav className="px-4">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentPage === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <item.icon className="w-5 h-5" />{item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500 mb-2">Base de données</div>
          <div className="text-lg font-bold">{stats?.contacts?.total?.toLocaleString() || 0} contacts</div>
          <div className="text-sm text-green-600">{enrichmentStatus?.avec_siret?.toLocaleString() || 0} enrichis</div>
        </div>
      </aside>
      <main className="ml-64 p-8">
        {currentPage === 'dashboard' && <Dashboard stats={stats} enrichmentStatus={enrichmentStatus} onRefresh={loadData} />}
        {currentPage === 'contacts' && <ContactsList showToast={showToast} />}
        {currentPage === 'enrichment' && <EnrichmentPage onComplete={loadData} showToast={showToast} />}
        {currentPage === 'authorized-cp' && <AuthorizedCpPage showToast={showToast} onUpdate={loadData} />}
        {currentPage === 'import' && <ImportPage onImportComplete={loadData} showToast={showToast} />}
        {currentPage === 'settings' && <SettingsPage showToast={showToast} />}
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
