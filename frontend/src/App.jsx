import React, { useState, useEffect, useRef } from 'react';
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
    Trash2,
    History // Adicionado o ícone de Histórico
} from 'lucide-react';

// --- Dados de Exemplo (Mock Data) ---
const mockLocations = [
    { id: 1, name: 'São Paulo, Brasil', lat: -23.55, lng: -46.63, aqi: 55, category: 'Moderado' },
    { id: 2, name: 'Tóquio, Japão', lat: 35.68, lng: 139.76, aqi: 12, category: 'Bom' },
    { id: 3, name: 'Nova Deli, Índia', lat: 28.61, lng: 77.20, aqi: 180, category: 'Ruim' },
    { id: 4, name: 'Pequim, China', lat: 39.90, lng: 116.40, aqi: 95, category: 'Moderado' },
    { id: 5, name: 'Los Angeles, EUA', lat: 34.05, lng: -118.24, aqi: 72, category: 'Moderado' },
    { id: 6, name: 'Curitiba, Brasil', lat: -25.42, lng: -49.27, aqi: 25, category: 'Bom' },
];

const mockSearchResults = [
    { id: 10, name: 'Rio de Janeiro, Brasil', lat: -22.90, lng: -43.17, aqi: 40, category: 'Bom' },
    { id: 11, name: 'Belo Horizonte, Brasil', lat: -19.92, lng: -43.93, aqi: 33, category: 'Bom' },
    { id: 12, name: 'Paris, França', lat: 48.85, lng: 2.35, aqi: 60, category: 'Moderado' },
];

// --- Funções Auxiliares de Estilo ---
const getAqiInfo = (aqi) => {
    if (aqi <= 50) return { category: 'Bom', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-400' };
    if (aqi <= 100) return { category: 'Moderado', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-400' };
    if (aqi <= 150) return { category: 'Ruim (Sensíveis)', color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-400' };
    if (aqi <= 200) return { category: 'Ruim', color: 'text-red-500', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' };
    if (aqi <= 300) return { category: 'Muito Ruim', color: 'text-purple-500', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-400' };
    return { category: 'Perigoso', color: 'text-maroon-400', bgColor: 'bg-maroon-500/20', borderColor: 'border-maroon-400' };
};


// --- Componente: Card do Mapa Interativo ---
// Este é o componente complexo que criamos antes
const MapCard = ({ location }) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [isMapInteractive, setIsMapInteractive] = useState(false);
    
    // INÍCIO DA ALTERAÇÃO: Corrigir a condição de corrida do Leaflet
    // Começa como 'false' para forçar a verificação e carregamento no useEffect
    const [isLeafletReady, setIsLeafletReady] = useState(false);

    const aqiInfo = getAqiInfo(location.aqi);
    const mapCoords = [location.lat, location.lng];
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
                    {location.aqi}
                </div>
                <div className="text-lg font-semibold mt-2">AQI - Índice de Qualidade</div>
                <div className="flex items-center text-gray-300 mt-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span>{location.name}</span>
                </div>
                
                <div className={`mt-4 ${aqiInfo.bgColor} ${aqiInfo.color} ${aqiInfo.borderColor} border font-bold py-2 px-5 rounded-full text-sm`}>
                    {aqiInfo.category.toUpperCase()}
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
                    <div className="font-semibold text-white">{location.name.split(',')[0]}</div>
                    <div className="text-sm text-gray-400">{aqiInfo.category}</div>
                </div>
            </div>
        </div>
    </div>
);
};

// --- Tela 1: Inicial (Home) ---
const HomeScreen = ({ location }) => {
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Seu Local Atual</h1>
            <MapCard location={location} />
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
                    return (
                        <div key={loc.id} className="bg-gray-800 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center cursor-pointer" onClick={() => onSelectLocation(loc)}>
                                <div className={`p-3 rounded-lg ${aqiInfo.bgColor} ${aqiInfo.color} mr-4`}>
                                    <span className="font-bold text-xl">{loc.aqi}</span>
                                </div>
                                <div>
                                    <div className="font-semibold">{loc.name.split(',')[0]}</div>
                                    <div className="text-sm text-gray-400">{loc.name.split(',')[1]}</div>
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
const SearchScreen = ({ savedLocations, onAddLocation }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Busca real na API FastAPI
    const handleSearch = async () => {
        if (searchTerm.trim() === '') return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`http://localhost:8000/places/search?q=${encodeURIComponent(searchTerm)}`);
            if (!res.ok) throw new Error('Erro ao buscar local');
            const data = await res.json();
            setResults(data);
        } catch (err) {
            setError('Nenhum local encontrado.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold">Buscar Localidade</h1>
                <button className="text-gray-400 hover:text-white" title="Histórico de Busca">
                    <History className="w-6 h-6" />
                </button>
            </div>
            
            <div className="relative mb-4">
                <input 
                    type="text"
                    placeholder="Digite o nome da cidade..."
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

            {/* Resultados */}
            {loading && <p className="text-gray-400 text-sm">Carregando...</p>}
            {error && <p className="text-gray-400 text-sm">{error}</p>}

            {!loading && !error && results.length > 0 && (
                <div className="space-y-3">
                    {results.map((loc, idx) => (
                        <div key={idx} className="bg-gray-800 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="font-semibold">{loc.name}</div>
                                <div className="text-sm text-gray-400">
                                    Lat: {loc.lat.toFixed(2)}, Lng: {loc.lng.toFixed(2)}
                                </div>
                            </div>
                            <button 
                                onClick={() => onAddLocation({
                                    id: idx + 1000,
                                    name: loc.name,
                                    lat: loc.lat,
                                    lng: loc.lng,
                                    aqi: 0,
                                    category: 'Desconhecido'
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
    const SettingItem = ({ icon, name }) => (
        <div className="bg-gray-800 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-gray-700">
            <div className="flex items-center">
                {icon}
                <span className="ml-4 font-medium">{name}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
        </div>
    );

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Configurações</h1>
            <div className="space-y-3">
                {/* Item "Minha Conta" removido */}
                <SettingItem icon={<Wind className="w-5 h-5 text-gray-400" />} name="Unidades (AQI, °C)" />
                <SettingItem icon={<Settings className="w-5 h-5 text-gray-400" />} name="Notificações" />
                <SettingItem icon={<Leaf className="w-5 h-5 text-gray-400" />} name="Sobre o AirCheck" />
            </div>
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
    const [locations, setLocations] = useState(mockLocations);
    const [currentLocation, setCurrentLocation] = useState(mockLocations[0]);

    // Função para renderizar a página correta
    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <HomeScreen location={currentLocation} />;
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
                return <HomeScreen location={currentLocation} />;
        }
    };

    // --- Funções de Manipulação de Dados ---
    const handleSelectLocation = (location) => {
        setCurrentLocation(location);
        setCurrentPage('home'); // Navega para a home para ver os detalhes
    };

    const handleAddLocation = (location) => {
        if (!locations.some(loc => loc.id === location.id)) {
            setLocations([location, ...locations]);
        }
        setCurrentPage('locations'); // Navega para a lista de locais
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