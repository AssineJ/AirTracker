from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional, Dict, List
import httpx
import os
from functools import lru_cache
import time

app = FastAPI(title="AirCheck API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache
cache_store: Dict[str, tuple] = {}
CACHE_TTL = 300

def get_from_cache(key: str):
    if key in cache_store:
        data, timestamp = cache_store[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
        del cache_store[key]
    return None

def set_cache(key: str, data):
    cache_store[key] = (data, time.time())

# ==================== CLIENTES DE API ====================

class OpenMeteoClient:
    """Open-Meteo Air Quality API - SEM CHAVE NECESSÁRIA!"""
    BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
    
    async def get_air_quality(self, lat: float, lng: float) -> Optional[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    self.BASE_URL,
                    params={
                        "latitude": lat,
                        "longitude": lng,
                        "current": "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi",
                        "timezone": "auto"
                    },
                    timeout=10.0
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Open-Meteo error: {e}")
                return None

class WAQIClient:
    """World Air Quality Index - Requer token gratuito"""
    BASE_URL = "https://api.waqi.info"
    
    def __init__(self, token: Optional[str]):
        self.token = token
    
    async def get_by_coords(self, lat: float, lng: float) -> Optional[Dict]:
        if not self.token:
            return None
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/feed/geo:{lat};{lng}/",
                    params={"token": self.token},
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("status") == "ok":
                    return data.get("data")
                return None
            except Exception as e:
                print(f"WAQI error: {e}")
                return None

class OpenWeatherClient:
    BASE_URL = "http://api.openweathermap.org/data/2.5"
    
    def __init__(self, api_key: Optional[str]):
        self.api_key = api_key
    
    async def get_air_pollution(self, lat: float, lng: float) -> Optional[Dict]:
        if not self.api_key:
            return None
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/air_pollution",
                    params={"lat": lat, "lon": lng, "appid": self.api_key},
                    timeout=10.0
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"OpenWeather error: {e}")
                return None

class APINinjasClient:
    """API Ninjas Air Quality"""
    BASE_URL = "https://api.api-ninjas.com/v1/airquality"
    
    def __init__(self, api_key: Optional[str]):
        self.api_key = api_key
    
    async def get_air_quality(self, lat: float, lng: float) -> Optional[Dict]:
        if not self.api_key:
            return None
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    self.BASE_URL,
                    params={"lat": lat, "lon": lng},
                    headers={"X-Api-Key": self.api_key},
                    timeout=10.0
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"API Ninjas error: {e}")
                return None

class OpenAQClient:
    BASE_URL = "https://api.openaq.org/v2"
    
    async def get_latest(self, lat: float, lng: float, radius: int = 25000) -> Optional[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/latest",
                    params={
                        "coordinates": f"{lat},{lng}",
                        "radius": radius,
                        "limit": 1,
                        "order_by": "distance"
                    },
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("results") and len(data["results"]) > 0:
                    return data["results"][0]
                return None
            except Exception as e:
                print(f"OpenAQ error: {e}")
                return None

class NominatimClient:
    BASE_URL = "https://nominatim.openstreetmap.org"
    
    async def search(self, query: str) -> List[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/search",
                    params={"q": query, "format": "json", "limit": 5},
                    headers={"User-Agent": "AirCheck/2.0"},
                    timeout=10.0
                )
                response.raise_for_status()
                results = response.json()
                return [
                    {
                        "name": r.get("display_name", ""),
                        "lat": float(r["lat"]),
                        "lng": float(r["lon"])
                    }
                    for r in results
                ]
            except Exception:
                return []

# ==================== SERVIÇO DE AQI ====================

class AqiService:
    AQI_BREAKPOINTS = [
        (0, 50, "Bom"),
        (51, 100, "Moderado"),
        (101, 150, "Insalubre para Grupos Sensíveis"),
        (151, 200, "Insalubre"),
        (201, 300, "Muito Insalubre"),
        (301, 500, "Perigoso")
    ]
    
    @staticmethod
    def calculate_category(aqi: int) -> str:
        for low, high, category in AqiService.AQI_BREAKPOINTS:
            if low <= aqi <= high:
                return category
        return "Perigoso"
    
    @staticmethod
    def normalize_open_meteo(data: Dict, lat: float, lng: float) -> Dict:
        """Normaliza dados do Open-Meteo"""
        current = data.get("current", {})
        aqi = current.get("european_aqi", 50)
        
        # Converter µg/m³ para os valores esperados
        pollutants = {
            "pm25": current.get("pm2_5"),
            "pm10": current.get("pm10"),
            "o3": current.get("ozone"),
            "no2": current.get("nitrogen_dioxide"),
            "so2": current.get("sulphur_dioxide"),
            "co": current.get("carbon_monoxide", 0) / 1000 if current.get("carbon_monoxide") else None
        }
        
        return {
            "aqi": int(aqi),
            "category": AqiService.calculate_category(int(aqi)),
            "pollutants": pollutants,
            "location": {
                "lat": lat,
                "lng": lng,
                "label": f"Lat {lat:.2f}, Lng {lng:.2f}"
            },
            "source": "open-meteo",
            "timestamp": current.get("time", datetime.utcnow().isoformat()) + "Z"
        }
    
    @staticmethod
    def normalize_waqi(data: Dict) -> Dict:
        """Normaliza dados do WAQI"""
        aqi = data.get("aqi", 50)
        iaqi = data.get("iaqi", {})
        city = data.get("city", {})
        
        pollutants = {
            "pm25": iaqi.get("pm25", {}).get("v"),
            "pm10": iaqi.get("pm10", {}).get("v"),
            "o3": iaqi.get("o3", {}).get("v"),
            "no2": iaqi.get("no2", {}).get("v"),
            "so2": iaqi.get("so2", {}).get("v"),
            "co": iaqi.get("co", {}).get("v")
        }
        
        location_name = city.get("name", "Unknown")
        geo = city.get("geo", [0, 0])
        
        return {
            "aqi": int(aqi),
            "category": AqiService.calculate_category(int(aqi)),
            "pollutants": pollutants,
            "location": {
                "lat": geo[0] if len(geo) > 0 else 0,
                "lng": geo[1] if len(geo) > 1 else 0,
                "label": location_name
            },
            "source": "waqi",
            "timestamp": data.get("time", {}).get("iso", datetime.utcnow().isoformat()) + "Z"
        }
    
    @staticmethod
    def normalize_api_ninjas(data: Dict, lat: float, lng: float) -> Dict:
        """Normaliza dados do API Ninjas"""
        aqi = data.get("overall_aqi", 50)
        
        pollutants = {
            "pm25": data.get("PM2.5", {}).get("concentration"),
            "pm10": data.get("PM10", {}).get("concentration"),
            "o3": data.get("O3", {}).get("concentration"),
            "no2": data.get("NO2", {}).get("concentration"),
            "so2": data.get("SO2", {}).get("concentration"),
            "co": data.get("CO", {}).get("concentration", 0) / 1000 if data.get("CO") else None
        }
        
        return {
            "aqi": int(aqi),
            "category": AqiService.calculate_category(int(aqi)),
            "pollutants": pollutants,
            "location": {
                "lat": lat,
                "lng": lng,
                "label": f"Lat {lat:.2f}, Lng {lng:.2f}"
            },
            "source": "api-ninjas",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    @staticmethod
    def normalize_openweather(data: Dict, lat: float, lng: float) -> Dict:
        """Normaliza dados do OpenWeather"""
        components = data.get("list", [{}])[0].get("components", {})
        aqi_value = data.get("list", [{}])[0].get("main", {}).get("aqi", 1)
        
        aqi_map = {1: 25, 2: 75, 3: 125, 4: 175, 5: 250}
        aqi = aqi_map.get(aqi_value, 50)
        
        pollutants = {
            "pm25": components.get("pm2_5"),
            "pm10": components.get("pm10"),
            "o3": components.get("o3"),
            "no2": components.get("no2"),
            "so2": components.get("so2"),
            "co": components.get("co", 0) / 1000 if components.get("co") else None
        }
        
        return {
            "aqi": aqi,
            "category": AqiService.calculate_category(aqi),
            "pollutants": pollutants,
            "location": {
                "lat": lat,
                "lng": lng,
                "label": f"Lat {lat:.2f}, Lng {lng:.2f}"
            },
            "source": "openweather",
            "timestamp": datetime.utcfromtimestamp(data.get("list", [{}])[0].get("dt", time.time())).isoformat() + "Z"
        }
    
    @staticmethod
    def normalize_openaq(data: Dict) -> Dict:
        """Normaliza dados do OpenAQ"""
        pollutants = {"pm25": None, "pm10": None, "o3": None, "no2": None, "so2": None, "co": None}
        
        for measurement in data.get("measurements", []):
            param = measurement.get("parameter", "").lower()
            value = measurement.get("value")
            
            if param in pollutants and value is not None:
                pollutants[param] = float(value)
        
        pm25 = pollutants.get("pm25")
        if pm25 is not None:
            if pm25 <= 12.0:
                aqi = int(pm25 * 50 / 12.0)
            elif pm25 <= 35.4:
                aqi = int(50 + (pm25 - 12.0) * 50 / 23.4)
            elif pm25 <= 55.4:
                aqi = int(100 + (pm25 - 35.4) * 50 / 20.0)
            elif pm25 <= 150.4:
                aqi = int(150 + (pm25 - 55.4) * 50 / 95.0)
            else:
                aqi = int(200 + min((pm25 - 150.4) * 100 / 100.0, 300))
        else:
            aqi = 50
        
        location_name = data.get("location", "")
        country = data.get("country", "")
        
        return {
            "aqi": aqi,
            "category": AqiService.calculate_category(aqi),
            "pollutants": pollutants,
            "location": {
                "lat": data["coordinates"]["latitude"],
                "lng": data["coordinates"]["longitude"],
                "label": f"{location_name}, {country}" if location_name else f"{country}"
            },
            "source": "openaq",
            "timestamp": data.get("measurements", [{}])[0].get("lastUpdated", datetime.utcnow().isoformat() + "Z")
        }
    
    @staticmethod
    def generate_mock(lat: float, lng: float) -> Dict:
        """Mock determinístico"""
        import hashlib
        seed = int(hashlib.md5(f"{lat:.2f},{lng:.2f}".encode()).hexdigest(), 16) % 100
        aqi = 50 + seed
        
        return {
            "aqi": aqi,
            "category": AqiService.calculate_category(aqi),
            "pollutants": {
                "pm25": 10.0 + (seed * 0.3),
                "pm10": 20.0 + (seed * 0.5),
                "o3": 40.0 + (seed * 0.8),
                "no2": 10.0 + (seed * 0.2),
                "so2": 2.0 + (seed * 0.05),
                "co": 0.3 + (seed * 0.01)
            },
            "location": {"lat": lat, "lng": lng, "label": f"Lat {lat:.2f}, Lng {lng:.2f}"},
            "source": "mock",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

# Instâncias
open_meteo = OpenMeteoClient()
waqi = WAQIClient(os.getenv("WAQI_API_KEY"))
openweather = OpenWeatherClient(os.getenv("OPENWEATHER_API_KEY"))
api_ninjas = APINinjasClient(os.getenv("API_NINJAS_KEY"))
openaq = OpenAQClient()
nominatim = NominatimClient()
aqi_service = AqiService()

# ==================== ROTAS ====================

@app.get("/health")
async def health_check():
    apis_configured = {
        "open_meteo": True,  # Sempre disponível
        "waqi": bool(os.getenv("WAQI_API_KEY")),
        "openweather": bool(os.getenv("OPENWEATHER_API_KEY")),
        "api_ninjas": bool(os.getenv("API_NINJAS_KEY")),
        "openaq": True  # Sempre disponível
    }
    return {
        "status": "ok",
        "apis": apis_configured,
        "cache_size": len(cache_store)
    }

@app.get("/places/search")
async def search_places(q: str = Query(..., min_length=1)):
    cache_key = f"place:{q}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    results = await nominatim.search(q)
    set_cache(cache_key, results)
    return results

@app.get("/aqi/current")
async def get_current_aqi(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180)
):
    cache_key = f"aqi:{lat:.4f},{lng:.4f}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    # Estratégia: tentar na ordem de prioridade
    
    # 1. Open-Meteo (sem chave, sempre funciona)
    data = await open_meteo.get_air_quality(lat, lng)
    if data:
        result = aqi_service.normalize_open_meteo(data, lat, lng)
        set_cache(cache_key, result)
        return result
    
    # 2. WAQI (se configurado)
    data = await waqi.get_by_coords(lat, lng)
    if data:
        result = aqi_service.normalize_waqi(data)
        set_cache(cache_key, result)
        return result
    
    # 3. API Ninjas (se configurado)
    data = await api_ninjas.get_air_quality(lat, lng)
    if data:
        result = aqi_service.normalize_api_ninjas(data, lat, lng)
        set_cache(cache_key, result)
        return result
    
    # 4. OpenWeather (se configurado)
    data = await openweather.get_air_pollution(lat, lng)
    if data:
        result = aqi_service.normalize_openweather(data, lat, lng)
        set_cache(cache_key, result)
        return result
    
    # 5. OpenAQ (sem chave)
    data = await openaq.get_latest(lat, lng)
    if data:
        result = aqi_service.normalize_openaq(data)
        set_cache(cache_key, result)
        return result
    
    # 6. Mock como último recurso
    result = aqi_service.generate_mock(lat, lng)
    set_cache(cache_key, result)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)