import React, { useState } from 'react';
import { MapPin, Search, Loader, AlertCircle, Wind } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const AQI_CATEGORIES = {
  'Bom': { color: 'bg-green-500', range: '0-50' },
  'Moderado': { color: 'bg-yellow-500', range: '51-100' },
  'Insalubre para Grupos Sensíveis': { color: 'bg-orange-500', range: '101-150' },
  'Insalubre': { color: 'bg-red-500', range: '151-200' },
  'Muito Insalubre': { color: 'bg-purple-500', range: '201-300' },
  'Perigoso': { color: 'bg-red-900', range: '301+' }
};

function App() {
  const [searchMode, setSearchMode] = useState('name');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aqiData, setAqiData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  const handleUseLocation = () => {
    setLoading(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError('Geolocalização não é suportada pelo seu navegador.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentLocation({ lat, lng });
        await fetchAQI(lat, lng);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Permissão de localização negada. Use a busca manual.');
        } else {
          setError('Erro ao obter localização. Tente novamente.');
        }
      }
    );
  };

  const fetchAQI = async (lat, lng) => {
    try {
      const response = await fetch(`${API_BASE_URL}/aqi/current?lat=${lat}&lng=${lng}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao buscar dados de qualidade do ar');
      }
      const data = await response.json();
      setAqiData(data);
      setError('');
    } catch (err) {
      setError(err.message);
      setAqiData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setError('Digite um local ou coordenadas');
      return;
    }

    setLoading(true);
    setError('');
    setAqiData(null);

    try {
      if (searchMode === 'coords') {
        const normalized = searchInput.replace(',', '.').trim();
        const parts = normalized.split(/[\s,]+/);
        
        if (parts.length !== 2) {
          throw new Error('Formato inválido. Use: lat,lng ou lat lng');
        }

        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          throw new Error('Coordenadas inválidas. Lat: -90 a 90, Lng: -180 a 180');
        }

        setCurrentLocation({ lat, lng });
        await fetchAQI(lat, lng);
      } else {
        const response = await fetch(`${API_BASE_URL}/places/search?q=${encodeURIComponent(searchInput)}`);
        if (!response.ok) {
          throw new Error('Erro ao buscar local');
        }
        const places = await response.json();
        
        if (places.length === 0) {
          throw new Error('Nenhum local encontrado. Tente outro nome.');
        }

        const place = places[0];
        setCurrentLocation({ lat: place.lat, lng: place.lng });
        await fetchAQI(place.lat, place.lng);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center py-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Wind className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">AirCheck</h1>
          </div>
          <p className="text-gray-600">Monitor de Qualidade do Ar</p>
        </header>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchMode('name')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                searchMode === 'name'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Nome do Local
            </button>
            <button
              onClick={() => setSearchMode('coords')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                searchMode === 'coords'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Coordenadas
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={searchMode === 'name' ? 'Ex: São Paulo, SP' : 'Ex: -23.55,-46.63'}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Buscar
            </button>
          </div>

          <button
            onClick={handleUseLocation}
            disabled={loading}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            Usar Minha Localização
          </button>

          {currentLocation && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              📍 Lat: {currentLocation.lat.toFixed(4)}, Lng: {currentLocation.lng.toFixed(4)}
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 flex items-center justify-center">
            <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="ml-3 text-gray-700">Carregando dados...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {aqiData && !loading && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className={`inline-block px-6 py-3 rounded-full ${AQI_CATEGORIES[aqiData.category]?.color || 'bg-gray-500'} text-white mb-3`}>
                <div className="text-5xl font-bold">{aqiData.aqi}</div>
                <div className="text-sm mt-1">AQI</div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{aqiData.category}</h2>
              <p className="text-gray-600">{aqiData.location.label}</p>
              <p className="text-sm text-gray-500 mt-1">
                Fonte: {aqiData.source} | {new Date(aqiData.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-700 mb-3">Principais Poluentes</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(aqiData.pollutants).map(([key, value]) => (
                  value !== null && (
                    <div key={key} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 uppercase">{key}</div>
                      <div className="text-xl font-bold text-gray-800">
                        {typeof value === 'number' ? value.toFixed(1) : value}
                        <span className="text-sm font-normal text-gray-500 ml-1">
                          {key === 'co' ? 'mg/m³' : 'µg/m³'}
                        </span>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;