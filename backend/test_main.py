import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    """Testa endpoint de health"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "apis" in data
    assert "cache_size" in data

def test_search_places_sao_paulo():
    """Testa busca de lugares"""
    response = client.get("/places/search?q=São Paulo")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "name" in data[0]
    assert "lat" in data[0]
    assert "lng" in data[0]

def test_search_places_empty():
    """Testa busca vazia"""
    response = client.get("/places/search?q=")
    assert response.status_code == 422  # Validation error

def test_get_aqi_sao_paulo():
    """Testa obtenção de AQI"""
    response = client.get("/aqi/current?lat=-23.55&lng=-46.63")
    assert response.status_code == 200
    data = response.json()
    assert "aqi" in data
    assert "category" in data
    assert "pollutants" in data
    assert "location" in data
    assert "source" in data
    assert "timestamp" in data
    assert isinstance(data["aqi"], int)
    assert data["aqi"] >= 0

def test_get_aqi_invalid_lat():
    """Testa latitude inválida"""
    response = client.get("/aqi/current?lat=100&lng=-46.63")
    assert response.status_code == 422

def test_get_aqi_invalid_lng():
    """Testa longitude inválida"""
    response = client.get("/aqi/current?lat=-23.55&lng=-200")
    assert response.status_code == 422

def test_get_aqi_missing_params():
    """Testa parâmetros ausentes"""
    response = client.get("/aqi/current")
    assert response.status_code == 422

def test_aqi_categories():
    """Testa todas as categorias de AQI"""
    test_coords = [
        (-23.55, -46.63),  # São Paulo
        (-22.91, -43.17),  # Rio
        (35.68, 139.76),   # Tóquio
        (51.51, -0.13),    # Londres
    ]
    
    for lat, lng in test_coords:
        response = client.get(f"/aqi/current?lat={lat}&lng={lng}")
        assert response.status_code == 200
        data = response.json()
        
        # Validar categoria
        valid_categories = [
            "Bom", "Moderado", "Insalubre para Grupos Sensíveis",
            "Insalubre", "Muito Insalubre", "Perigoso"
        ]
        assert data["category"] in valid_categories
        
        # Validar poluentes
        pollutants = data["pollutants"]
        assert "pm25" in pollutants
        assert "pm10" in pollutants

def test_cache_functionality():
    """Testa funcionamento do cache"""
    # Primeira chamada
    response1 = client.get("/aqi/current?lat=-23.55&lng=-46.63")
    data1 = response1.json()
    
    # Segunda chamada (deve usar cache)
    response2 = client.get("/aqi/current?lat=-23.55&lng=-46.63")
    data2 = response2.json()
    
    # Dados devem ser idênticos (cache)
    assert data1 == data2
    
    # Verificar que cache aumentou
    health = client.get("/health").json()
    assert health["cache_size"] > 0

def test_pollutants_structure():
    """Testa estrutura dos poluentes"""
    response = client.get("/aqi/current?lat=-23.55&lng=-46.63")
    data = response.json()
    
    pollutants = data["pollutants"]
    expected_pollutants = ["pm25", "pm10", "o3", "no2", "so2", "co"]
    
    for pollutant in expected_pollutants:
        assert pollutant in pollutants

def test_location_structure():
    """Testa estrutura da localização"""
    response = client.get("/aqi/current?lat=-23.55&lng=-46.63")
    data = response.json()
    
    location = data["location"]
    assert "lat" in location
    assert "lng" in location
    assert "label" in location
    assert location["lat"] == -23.55
    assert location["lng"] == -46.63

def test_multiple_sources():
    """Testa que diferentes fontes podem ser usadas"""
    sources_found = set()
    
    # Testar várias coordenadas para pegar diferentes fontes
    coords = [
        (-23.55, -46.63),
        (40.71, -74.01),
        (51.51, -0.13),
        (35.68, 139.76),
    ]
    
    for lat, lng in coords:
        response = client.get(f"/aqi/current?lat={lat}&lng={lng}")
        data = response.json()
        sources_found.add(data["source"])
    
    # Pelo menos uma fonte deve funcionar
    assert len(sources_found) > 0
    
    # Fontes válidas (apenas WAQI ou mock quando token não está configurado)
    valid_sources = ["waqi", "mock"]
    for source in sources_found:
        assert source in valid_sources
