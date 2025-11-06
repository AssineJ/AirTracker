import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Home, 
    Search, 
    MapPin, 
    Settings, 
    Wind, 
    Menu,
    User,
    Leaf,
    X,
    ChevronRight,
    Plus,
    Check,
    Trash2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const createLocationId = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return `unknown:${Math.random().toString(36).slice(2, 8)}`;
    }

    return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
};

// --- Dados iniciais para o aplicativo ---
const initialLocations = [
    { id: createLocationId(-23.55, -46.63), name: 'São Paulo', label: 'São Paulo, Brasil', lat: -23.55, lng: -46.63, aqi: 0 },
    { id: createLocationId(35.68, 139.76), name: 'Tóquio', label: 'Tóquio, Japão', lat: 35.68, lng: 139.76, aqi: 0 },
    { id: createLocationId(28.61, 77.2), name: 'Nova Deli', label: 'Nova Deli, Índia', lat: 28.61, lng: 77.20, aqi: 0 },
    { id: createLocationId(39.9, 116.4), name: 'Pequim', label: 'Pequim, China', lat: 39.90, lng: 116.40, aqi: 0 },
    { id: createLocationId(34.05, -118.24), name: 'Los Angeles', label: 'Los Angeles, EUA', lat: 34.05, lng: -118.24, aqi: 0 },
    { id: createLocationId(-25.42, -49.27), name: 'Curitiba', label: 'Curitiba, Brasil', lat: -25.42, lng: -49.27, aqi: 0 },
];

const getLocationParts = (name = '') => {
    const parts = name
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);

    return {
        primary: parts[0] ?? (name || 'Local desconhecido'),
        secondary: parts.slice(1).join(', '),
    };
};

// --- Funções Auxiliares de Estilo ---
const getAqiInfo = (aqiValue) => {
    const aqi = Number.isFinite(aqiValue) ? aqiValue : 0;
    if (aqi <= 50) return { category: 'Bom', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-400' };
    if (aqi <= 100) return { category: 'Moderado', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-400' };
    if (aqi <= 150) return { category: 'Ruim (Sensíveis)', color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-400' };
    if (aqi <= 200) return { category: 'Ruim', color: 'text-red-500', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' };
    if (aqi <= 300) return { category: 'Muito Ruim', color: 'text-purple-500', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-400' };
    return { category: 'Perigoso', color: 'text-maroon-400', bgColor: 'bg-maroon-500/20', borderColor: 'border-maroon-400' };
};


// --- Componente: Card do Mapa Interativo ---
// Este é o componente complexo que criamos antes
const MapCard = ({ location, isLoading }) => {
    if (!location) {
        return null;
    }

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [isMapInteractive, setIsMapInteractive] = useState(false);
    
    // INÍCIO DA ALTERAÇÃO: Corrigir a condição de corrida do Leaflet
    // Começa como 'false' para forçar a verificação e carregamento no useEffect
    const [isLeafletReady, setIsLeafletReady] = useState(false);

    const aqiInfo = getAqiInfo(location.aqi);
    const { primary: primaryName } = getLocationParts(location.name ?? location.label);
    const mapCoords = [location.lat ?? 0, location.lng ?? 0];
    const displayAqi = Number.isFinite(location.aqi) ? location.aqi : '--';
    const locationLabel = location?.label || location?.station || location?.name || 'Local desconhecido';
    const defaultZoom = 13;

    useEffect(() => {
        // Verifica se o Leaflet já está totalmente carregado
        if (window.L && window.L.map) {
            // console.log("Leaflet já está carregado.");
            // Garante que a correção do ícone seja aplicada
            if (!L.Icon.Default.prototype._getIconUrl) {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });
            }
            setIsLeafletReady(true);
            return;
        }

        // Impede a injeção duplicada do script se o componente re-renderizar
        // enquanto o script ainda está a ser baixado.
        if (document.querySelector('script[src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]')) {
            // console.log("Carregamento do Leaflet em progresso...");
            return;
        }

        // console.log("A carregar o Leaflet...");
        // Carrega o Leaflet se ainda não foi carregado
        // Carrega CSS
        const leafletCSS = document.createElement('link');
            leafletCSS.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            leafletCSS.rel = "stylesheet";
            document.head.appendChild(leafletCSS);

            // Carrega JS
            const leafletJS = document.createElement('script');
            leafletJS.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        leafletJS.async = true;
        leafletJS.onload = () => {
            // console.log("Leaflet carregado com sucesso.");
            // Corrige o bug do ícone do marcador
            delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });
                setIsLeafletReady(true);
            };
            document.head.appendChild(leafletJS);
        // A CHAVE '}' EXTRA FOI REMOVIDA DAQUI. Este é o fecho do useEffect.
    }, []);

    useEffect(() => {
        // Inicializa o mapa quando o Leaflet estiver pronto e o ref do div existir
        if (isLeafletReady && mapRef.current && !mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, {
                center: mapCoords,
                zoom: defaultZoom,
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                touchZoom: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(mapInstance.current);

            L.marker(mapCoords).addTo(mapInstance.current);
        }

        // Atualiza o mapa quando a localização mudar
        if (mapInstance.current) {
            mapInstance.current.setView(mapCoords, defaultZoom);
            // Limpa marcadores antigos e adiciona um novo
            mapInstance.current.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    layer.remove();
                }
            });
            L.marker(mapCoords).addTo(mapInstance.current);
        }
    }, [isLeafletReady, location]); // Depende do location para atualizar

    const handleExpandMap = (e) => {
        e.stopPropagation();
        setIsMapInteractive(true);
        if (mapInstance.current) {
            mapInstance.current.zoomControl.addTo(mapInstance.current);
            mapInstance.current.dragging.enable();
            mapInstance.current.scrollWheelZoom.enable();
            mapInstance.current.touchZoom.enable();
        }
    };

    const handleCloseMap = (e) => {
        e.stopPropagation();
        setIsMapInteractive(false);
        if (mapInstance.current) {
            mapInstance.current.zoomControl.remove();
            mapInstance.current.dragging.disable();
            mapInstance.current.scrollWheelZoom.disable();
            mapInstance.current.touchZoom.disable();
            mapInstance.current.setView(mapCoords, defaultZoom);
        }
    };

return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-700">
        {/* Mapa */}
        <div className="w-full h-80 relative">
            <div ref={mapRef} className="w-full h-full"></div>

            {/* Sobreposição AQI */}
            <div className={`absolute inset-0 flex flex-col justify-center items-center bg-gray-900 bg-opacity-75 transition-opacity duration-300 z-10 ${isMapInteractive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className={`text-7xl font-extrabold ${aqiInfo.color}`}>
                    {isLoading ? '…' : displayAqi}
                </div>
                <div className="text-lg font-semibold mt-2">AQI - Índice de Qualidade</div>
                <div className="flex items-center text-gray-300 mt-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span>{locationLabel}</span>
                </div>

                <div className={`mt-4 ${aqiInfo.bgColor} ${aqiInfo.color} ${aqiInfo.borderColor} border font-bold py-2 px-5 rounded-full text-sm`}>
                    {isLoading ? 'ATUALIZANDO…' : aqiInfo.category.toUpperCase()}
                </div>

                <button onClick={handleExpandMap} className="mt-6 text-xs text-blue-300 hover:text-blue-200 font-medium">
                    Ver mapa interativo
                </button>
            </div>

            {/* Botão de Fechar */}
            {isMapInteractive && (
                <button onClick={handleCloseMap} className="absolute top-3 right-3 bg-white text-gray-800 rounded-full p-2 z-20 shadow-lg">
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>

        {/* Métricas simplificadas (estilo "Locais Salvos") */}
        <div className="flex justify-between items-center bg-gray-800 px-4 py-3 border-t border-gray-700">
            <div className="flex items-center">
                <div className={`p-2 rounded-lg ${aqiInfo.bgColor} ${aqiInfo.color} mr-3`}>
                    <span className="font-bold text-lg">{location.aqi}</span>
                </div>
                <div>
                    <div className="font-semibold text-white">{primaryName}</div>
                    <div className="text-sm text-gray-400">{aqiInfo.category}</div>
                </div>
            </div>
        </div>
    </div>
);
};

// --- Tela 1: Inicial (Home) ---
const HomeScreen = ({ location, isLoading }) => {
    if (!location) {
        return null;
    }

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Seu Local Atual</h1>
            <MapCard location={location} isLoading={isLoading} />
            <div className="mt-4 bg-gray-800 p-4 rounded-xl">
                 <h2 className="text-lg font-semibold mb-2">Recomendação de Saúde</h2>
                 <p className="text-sm text-gray-300">
                    {location.aqi <= 50 
                        ? "Aproveite o dia ao ar livre!" 
                        : "Grupos sensíveis: considerem reduzir atividades ao ar livre."}
                 </p>
            </div>
        </div>
    );
};

// --- Tela 2: Lista de Locais (Locations) ---
const LocationsScreen = ({ locations, onSelectLocation, onRemoveLocation }) => {
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Locais Salvos</h1>
            <div className="space-y-3">
                {locations.map(loc => {
                    const aqiInfo = getAqiInfo(loc.aqi);
                    const cityName = loc.name || getLocationParts(loc.label ?? '').primary;
                    const labelDetail = typeof loc.label === 'string' ? loc.label.trim() : '';
                    const stationDetail = typeof loc.station === 'string' ? loc.station.trim() : '';
                    const normalizedCity = (cityName || '').trim().toLowerCase();

                    let secondaryText = 'Sem detalhes adicionais';
                    if (labelDetail && labelDetail.toLowerCase() !== normalizedCity) {
                        secondaryText = labelDetail;
                    } else if (stationDetail && stationDetail.toLowerCase() !== normalizedCity) {
                        secondaryText = stationDetail;
                    } else {
                        const { secondary } = getLocationParts(labelDetail || stationDetail || cityName || '');
                        if (secondary) {
                            secondaryText = secondary;
                        }
                    }

                    return (
                        <div key={loc.id} className="bg-gray-800 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center cursor-pointer" onClick={() => onSelectLocation(loc)}>
                                <div className={`p-3 rounded-lg ${aqiInfo.bgColor} ${aqiInfo.color} mr-4`}>
                                    <span className="font-bold text-xl">{Number.isFinite(loc.aqi) ? loc.aqi : '--'}</span>
                                </div>
                                <div>
                                    <div className="font-semibold">{cityName || 'Local desconhecido'}</div>
                                    <div className="text-sm text-gray-400">{secondaryText}</div>
                                </div>
                            </div>
                            <button onClick={() => onRemoveLocation(loc.id)} className="text-gray-500 hover:text-red-500">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Tela 3: Pesquisa (Search) ---
const generateLocationId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `loc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const SearchScreen = ({ savedLocations, onAddLocation }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        const term = searchTerm.trim();
        if (!term) {
            setError('Digite o nome de uma cidade ou país.');
            setResults([]);
            setHasSearched(true);
            return;
        }

        setHasSearched(true);
        setLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetch(`${API_BASE_URL}/places/search?q=${encodeURIComponent(term)}`);

            if (!response.ok) {
                throw new Error('Erro ao buscar local');
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                setError('Nenhum local encontrado.');
                return;
            }

            const normalized = data.map((item, index) => ({
                ...item,
                lat: typeof item.lat === 'string' ? Number.parseFloat(item.lat) : item.lat,
                lng: typeof item.lng === 'string' ? Number.parseFloat(item.lng) : item.lng,
                _internalId: item.id ?? `result-${index}`,
            }));

            setResults(normalized);
        } catch (err) {
            console.error('Erro ao buscar localidade:', err);
            setError('Nenhum local encontrado.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const isSaved = (candidate) => {
        return savedLocations.some((loc) => {
            const sameLat = Math.abs(loc.lat - candidate.lat) < 0.0001;
            const sameLng = Math.abs(loc.lng - candidate.lng) < 0.0001;
            return sameLat && sameLng;
        });
    };

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-xl font-bold">Buscar Localidade</h1>
                <p className="text-sm text-gray-400 mt-1">
                    Pesquise cidades ou países. Ao informar apenas o país, a capital será sugerida automaticamente.
                </p>
            </div>

            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Digite o nome da cidade ou país..."
                    className="w-full bg-gray-700 rounded-full py-3 px-5 pr-12 text-white placeholder-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                    onClick={handleSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-400"
                >
                    <Search className="w-5 h-5" />
                </button>
            </div>

            {loading && <p className="text-gray-400 text-sm">Carregando...</p>}
            {!loading && error && <p className="text-gray-400 text-sm">{error}</p>}

            {!loading && hasSearched && !error && results.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum resultado. Tente outro termo.</p>
            )}

            {!loading && results.length > 0 && (
                <div className="space-y-3">
                    {results.map((loc, idx) => (
                        <div key={`${loc.lat}-${loc.lng}-${idx}`} className="bg-gray-800 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="font-semibold">{loc.name}</div>
                                <div className="text-sm text-gray-400">
                                    Lat: {loc.lat.toFixed(2)}, Lng: {loc.lng.toFixed(2)}
                                </div>
                                <button
                                    onClick={() => !alreadySaved && onAddLocation(loc)}
                                    className={`flex items-center justify-center w-10 h-10 rounded-full border transition ${alreadySaved ? 'border-gray-600 text-gray-500 cursor-not-allowed' : 'border-blue-400 text-blue-400 hover:text-blue-300 hover:border-blue-300'}`}
                                    disabled={alreadySaved}
                                    title={alreadySaved ? 'Local já salvo' : 'Salvar local'}
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={() => onAddLocation({
                                    id: generateLocationId(),
                                    name: loc.name,
                                    lat: loc.lat,
                                    lng: loc.lng,
                                    aqi: loc.aqi ?? 0,
                                    category: loc.category ?? 'Desconhecido'
                                })}
                                className="text-blue-400 hover:text-blue-300"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Tela 4: Configurações (Settings) ---
const SettingsScreen = () => {
    const [modalInfo, setModalInfo] = useState(null);

    const openModal = (title, description, Icon) => {
        setModalInfo({ title, description, Icon });
    };

    const closeModal = () => setModalInfo(null);

    const SettingItem = ({ Icon, name, description }) => (
        <button
            type="button"
            onClick={() => openModal(name, description, Icon)}
            className="w-full bg-gray-800 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <div className="flex items-center text-left">
                <Icon className="w-5 h-5 text-gray-400" />
                <span className="ml-4 font-medium">{name}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
    );

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Configurações</h1>
            <div className="space-y-3">
                {/* Item "Minha Conta" removido */}
                <SettingItem
                    Icon={Wind}
                    name="Unidades (AQI, °C)"
                    description="Qualidade do ar apresentada no padrão AQI (World Air Quality Index). Temperaturas exibidas em graus Celsius (°C)."
                />
                <SettingItem
                    Icon={Settings}
                    name="Notificações"
                    description="Receba alertas quando a qualidade do ar mudar de forma significativa."
                />
                <SettingItem
                    Icon={Leaf}
                    name="Sobre o AirCheck"
                    description="O AirCheck ajuda você a monitorar a qualidade do ar em tempo real usando dados da rede WAQI. Salve cidades importantes, acompanhe mapas interativos e receba recomendações para proteger sua saúde."
                />
            </div>

            {modalInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" role="presentation">
                    <div
                        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-11/12 max-w-md shadow-2xl relative"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="settings-modal-title"
                    >
                        <button
                            type="button"
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            aria-label="Fechar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center mb-4">
                            <modalInfo.Icon className="w-5 h-5 text-blue-400 mr-2" />
                            <h2 id="settings-modal-title" className="text-lg font-semibold">{modalInfo.title}</h2>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{modalInfo.description}</p>
                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
                            >
                                Entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Componente: Cabeçalho (Header) ---
const Header = () => (
    <header className="p-4 flex justify-center items-center bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
        {/* Ícone de Menu (3 listras) removido */}
        <span className="font-bold text-lg flex items-center">
            <Leaf className="w-5 h-5 mr-2 text-blue-400" />
            AirCheck
        </span>
        {/* Ícone de Usuário removido */}
    </header>
);

// --- Componente: Navegação Inferior (Bottom Nav) ---
const BottomNav = ({ activePage, onNavigate }) => {
    const NavItem = ({ icon: Icon, pageName }) => {
        const isActive = activePage === pageName;
        return (
            <button 
                onClick={() => onNavigate(pageName)}
                className={`flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-blue-400' : 'text-gray-500'} hover:text-blue-300 w-1/4`}
            >
                <Icon className="w-6 h-6" />
            </button>
        );
    };

    return (
        <nav className="flex justify-around items-center p-2 bg-gray-800 border-t border-gray-700 sticky bottom-0 z-20">
            <NavItem icon={Home} pageName="home" />
            <NavItem icon={MapPin} pageName="locations" />
            <NavItem icon={Search} pageName="search" />
            <NavItem icon={Settings} pageName="settings" />
        </nav>
    );
};

// --- Componente Principal: App ---
export default function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [locations, setLocations] = useState(initialLocations);
    const [currentLocation, setCurrentLocation] = useState(initialLocations[0]);
    const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);

    const fetchAqiForLocation = useCallback(async (location) => {
        if (!location) {
            return location;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/aqi/current?lat=${location.lat}&lng=${location.lng}`
            );

            if (!response.ok) {
                throw new Error('Erro ao carregar dados de qualidade do ar.');
            }

            const data = await response.json();

            const rawAqi = typeof data?.aqi === 'number'
                ? data.aqi
                : Number.parseInt(data?.aqi, 10);
            const safeAqi = Number.isFinite(rawAqi) ? rawAqi : 0;
            const apiLabel = typeof data?.location?.label === 'string' ? data.location.label.trim() : '';
            const apiCity = typeof data?.location?.city === 'string' ? data.location.city.trim() : '';
            const apiStation = typeof data?.location?.station === 'string' ? data.location.station.trim() : '';

            const fallbackName = location.name || apiLabel || apiStation || 'Local desconhecido';
            const sanitizedName = apiCity || fallbackName;
            const normalizedLabel = apiLabel || location.label || fallbackName;
            const stationLabel = apiStation || location.station;

            return {
                ...location,
                name: sanitizedName,
                label: normalizedLabel,
                station: stationLabel,
                lat: data?.location?.lat ?? location.lat,
                lng: data?.location?.lng ?? location.lng,
                aqi: safeAqi,
                lastUpdated: data?.timestamp ?? null,
                source: data?.source ?? 'waqi',
                error: data?.error,
            };
        } catch (error) {
            console.error('❌ Falha ao atualizar dados de AQI', error);
            return {
                ...location,
                label: location.label || location.name,
                station: location.station,
                aqi: Number.isFinite(location.aqi) ? location.aqi : 0,
                source: location?.source ?? 'indisponível',
                error: 'Não foi possível atualizar os dados em tempo real.',
            };
        }
    }, []);

    useEffect(() => {
        const bootstrapLocations = async () => {
            setIsLoadingCurrent(true);
            const updatedLocations = await Promise.all(
                initialLocations.map(loc => fetchAqiForLocation(loc))
            );
            const sanitizedLocations = updatedLocations.filter(Boolean);

            if (sanitizedLocations.length > 0) {
                setLocations(sanitizedLocations);
                setCurrentLocation(sanitizedLocations[0]);
            }

            setIsLoadingCurrent(false);
        };

        bootstrapLocations();
    }, [fetchAqiForLocation]);

    // Função para renderizar a página correta
    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <HomeScreen location={currentLocation} isLoading={isLoadingCurrent} />;
            case 'locations':
                return <LocationsScreen 
                            locations={locations} 
                            onSelectLocation={handleSelectLocation}
                            onRemoveLocation={handleRemoveLocation}
                        />;
            case 'search':
                return <SearchScreen 
                            savedLocations={locations} 
                            onAddLocation={handleAddLocation} 
                        />;
            case 'settings':
                return <SettingsScreen />;
            default:
                return <HomeScreen location={currentLocation} isLoading={isLoadingCurrent} />;
        }
    };

    // --- Funções de Manipulação de Dados ---
    const handleSelectLocation = async (location) => {
        if (!location) {
            return;
        }

        setCurrentPage('home');
        setIsLoadingCurrent(true);
        const updatedLocation = await fetchAqiForLocation(location);
        setIsLoadingCurrent(false);

        if (!updatedLocation) {
            return;
        }

        setCurrentLocation(updatedLocation);
        setLocations(prev => prev.map(loc => (loc.id === updatedLocation.id ? updatedLocation : loc)));
    };

    const handleAddLocation = (location) => {
        const normalizeName = (value) => (value || '').toLowerCase().trim();

        const existing = locations.find((loc) => {
            const sameName = normalizeName(loc.name) === normalizeName(location.name);
            const sameCoords = Math.abs(loc.lat - location.lat) < 1e-4 && Math.abs(loc.lng - location.lng) < 1e-4;
            return sameName || sameCoords;
        });

        if (existing) {
            setCurrentLocation(existing);
            setCurrentPage('home');
            return;
        }

        const newLocation = {
            id: location.id || generateLocationId(),
            aqi: typeof location.aqi === 'number' ? location.aqi : 0,
            category: location.category || 'Desconhecido',
            ...location,
        };

        setLocations([newLocation, ...locations]);
        setCurrentLocation(newLocation);
        setCurrentPage('locations');
    };

    const handleRemoveLocation = (id) => {
        // Impede que o último local seja removido
        if (locations.length <= 1) {
            alert("Não é possível remover o último local."); // (Em um app real, usaríamos um modal)
            return;
        }
        // Se o local removido for o local atual, seleciona um novo local atual
        if (currentLocation.id === id) {
            setCurrentLocation(locations.find(loc => loc.id !== id));
        }
        setLocations(locations.filter(loc => loc.id !== id));
    };


    return (
        // Simulação da Moldura do Celular
        <div className="flex justify-center items-center min-h-screen bg-gray-700 p-4">
            <div className="w-full max-w-sm bg-gray-900 text-white rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-700">
                {/* 1. Cabeçalho */}
                <Header />

                {/* 2. Conteúdo da Página (rolável) */}
                <div className="h-[70vh] overflow-y-auto">
                    {renderPage()}
                </div>

                {/* 3. Navegação Inferior */}
                <BottomNav activePage={currentPage} onNavigate={setCurrentPage} />
            </div>
        </div>
    );
}