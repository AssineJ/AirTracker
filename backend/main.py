from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from typing import Optional, Dict, List
import unicodedata
import httpx
import os
from dotenv import load_dotenv
import time
import re
from urllib.parse import unquote, urlparse

load_dotenv()

app = FastAPI(title="AirCheck API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache simples com TTL
cache_store: Dict[str, tuple] = {}
CACHE_TTL = 300  # 5 minutos

def get_from_cache(key: str):
    if key in cache_store:
        data, timestamp = cache_store[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
        del cache_store[key]
    return None

def set_cache(key: str, data):
    cache_store[key] = (data, time.time())

# ==================== CLIENTE WAQI ====================

class WAQIClient:
    """World Air Quality Index API Client"""
    BASE_URL = "https://api.waqi.info"
    
    def __init__(self, token: str):
        self.token = token
    
    async def get_by_coords(self, lat: float, lng: float) -> Optional[Dict]:
        """Busca estação mais próxima das coordenadas"""
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
                print(f"❌ WAQI error: {e}")
                return None
    
    async def search_by_name(self, city_name: str) -> Optional[Dict]:
        """Busca por nome da cidade"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/search/",
                    params={"token": self.token, "keyword": city_name},
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("status") == "ok":
                    return data.get("data", [])
                return None
            except Exception as e:
                print(f"❌ WAQI search error: {e}")
                return None

# Cliente de Geocodificação (Nominatim - gratuito, sem chave)
class NominatimClient:
    BASE_URL = "https://nominatim.openstreetmap.org"

    def __init__(self):
        # Dados determinísticos para garantir funcionamento offline/em testes
        self._fallback_places: List[Dict[str, float | str]] = [
            {"name": "São Paulo", "lat": -23.55, "lng": -46.63},
            {"name": "Rio de Janeiro", "lat": -22.91, "lng": -43.17},
            {"name": "Tóquio", "lat": 35.68, "lng": 139.76},
            {"name": "Tokyo", "lat": 35.68, "lng": 139.76},
            {"name": "Londres", "lat": 51.51, "lng": -0.13},
            {"name": "London", "lat": 51.51, "lng": -0.13},
            {"name": "Nova York", "lat": 40.71, "lng": -74.0},
            {"name": "New York", "lat": 40.71, "lng": -74.0},
            {"name": "Hong Kong", "lat": 22.3193, "lng": 114.1694},
            {"name": "Dubai", "lat": 25.276987, "lng": 55.296249},
        ]

        raw_country_capitals: List[Dict[str, object]] = [
            {
                "aliases": ["brasil", "brazil", "republica federativa do brasil"],
                "city": "Brasília",
                "country": "Brasil",
                "lat": -15.793889,
                "lng": -47.882778,
            },
            {
                "aliases": ["estados unidos", "united states", "usa", "united states of america"],
                "city": "Washington, D.C.",
                "country": "Estados Unidos",
                "lat": 38.907192,
                "lng": -77.036873,
            },
            {
                "aliases": ["reino unido", "united kingdom", "uk", "great britain", "inglaterra"],
                "city": "Londres",
                "country": "Reino Unido",
                "lat": 51.507351,
                "lng": -0.127758,
            },
            {
                "aliases": ["franca", "france", "republica francesa"],
                "city": "Paris",
                "country": "França",
                "lat": 48.856613,
                "lng": 2.352222,
            },
            {
                "aliases": ["japao", "japan", "nihon"],
                "city": "Tóquio",
                "country": "Japão",
                "lat": 35.689487,
                "lng": 139.691711,
            },
            {
                "aliases": ["china", "república popular da china", "people's republic of china"],
                "city": "Pequim",
                "country": "China",
                "lat": 39.904202,
                "lng": 116.407394,
            },
            {
                "aliases": ["india", "índia", "bharat"],
                "city": "Nova Deli",
                "country": "Índia",
                "lat": 28.613939,
                "lng": 77.209023,
            },
            {
                "aliases": ["emirados arabes unidos", "united arab emirates", "uae"],
                "city": "Abu Dhabi",
                "country": "Emirados Árabes Unidos",
                "lat": 24.453884,
                "lng": 54.3773438,
            },
            {
                "aliases": ["coreia do sul", "south korea", "republic of korea"],
                "city": "Seul",
                "country": "Coreia do Sul",
                "lat": 37.566536,
                "lng": 126.977966,
            },
            {
                "aliases": ["canada", "canadá"],
                "city": "Ottawa",
                "country": "Canadá",
                "lat": 45.421532,
                "lng": -75.697189,
            },
            {
                "aliases": ["australia", "austrália"],
                "city": "Canberra",
                "country": "Austrália",
                "lat": -35.280937,
                "lng": 149.130009,
            },
            {
                "aliases": ["alemanha", "germany", "deutschland"],
                "city": "Berlim",
                "country": "Alemanha",
                "lat": 52.520008,
                "lng": 13.404954,
            },
            {
                "aliases": ["italia", "itália", "italy"],
                "city": "Roma",
                "country": "Itália",
                "lat": 41.902782,
                "lng": 12.496366,
            },
            {
                "aliases": ["portugal", "republica portuguesa"],
                "city": "Lisboa",
                "country": "Portugal",
                "lat": 38.722252,
                "lng": -9.139337,
            },
            {
                "aliases": ["espanha", "spain", "reino de espanha"],
                "city": "Madri",
                "country": "Espanha",
                "lat": 40.416775,
                "lng": -3.70379,
            },
            {
                "aliases": ["argentina", "republica argentina"],
                "city": "Buenos Aires",
                "country": "Argentina",
                "lat": -34.603722,
                "lng": -58.381592,
            },
            {
                "aliases": ["mexico", "méxico", "estados unidos mexicanos"],
                "city": "Cidade do México",
                "country": "México",
                "lat": 19.432608,
                "lng": -99.133209,
            },
        ]

        self._country_capitals = [
            {
                "aliases": {self._normalize_text(alias) for alias in entry["aliases"]},
                "city": entry["city"],
                "country": entry["country"],
                "lat": entry["lat"],
                "lng": entry["lng"],
            }
            for entry in raw_country_capitals
        ]

    @staticmethod
    def _normalize_text(value: str) -> str:
        return (
            unicodedata.normalize("NFKD", value)
            .encode("ascii", errors="ignore")
            .decode("ascii")
            .strip()
            .lower()
        )

    def _fallback_search(self, query: str) -> List[Dict]:
        normalized_query = self._normalize_text(query)
        if not normalized_query:
            return []

        matches = [
            {
                **place,
                "label": place.get("label") or str(place.get("name", "")),
            }
            for place in self._fallback_places
            if normalized_query in self._normalize_text(str(place["name"]))
        ]
        return matches

    def _match_country_capital(self, query: str) -> Optional[Dict]:
        normalized_query = self._normalize_text(query)
        if not normalized_query:
            return None

        for entry in self._country_capitals:
            if normalized_query in entry["aliases"]:
                label = f"{entry['city']}, {entry['country']}"
                return {
                    "name": entry["city"],
                    "label": label,
                    "lat": entry["lat"],
                    "lng": entry["lng"],
                }
        return None

    async def search(self, query: str) -> List[Dict]:
        country_match = self._match_country_capital(query)
        if country_match:
            return [country_match]

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/search",
                    params={"q": query, "format": "json", "limit": 10},
                    headers={"User-Agent": "AirCheck/2.0"},
                    timeout=10.0
                )
                response.raise_for_status()
                results = response.json()
                normalized_results = [
                    {
                        "name": (
                            r.get("display_name", "")
                            .split(",")[0]
                            .encode("ascii", errors="ignore")
                            .decode("ascii")
                        ),
                        "label": r.get("display_name", ""),
                        "lat": float(r["lat"]),
                        "lng": float(r["lon"])
                    }
                    for r in results
                ]

                if normalized_results:
                    return normalized_results

                # Se a API retornar vazio, utilizar dados fallback
                return self._fallback_search(query)
            except Exception as e:
                print(f"❌ Nominatim error: {e}")
                return self._fallback_search(query)

# ==================== SERVIÇO DE AQI ====================

class AqiService:
    """Serviço para processar dados de AQI"""

    @staticmethod
    def _strip_parenthetical(value: str) -> str:
        if not value:
            return ""
        return re.sub(r"\s*\(.*?\)\s*", "", value).strip()

    @staticmethod
    def _clean_city_candidate(candidate: str) -> str:
        if not candidate:
            return ""

        cleaned = candidate.strip()
        cleaned = AqiService._strip_parenthetical(cleaned)
        cleaned = cleaned.strip(" ,-/")

        suffixes = [
            " air quality monitoring station",
            " air quality station",
            " monitoring station",
            " monitoring site",
            " station",
            " observatory",
            " embassy",
            " us embassy",
        ]

        lower_cleaned = cleaned.lower()
        for suffix in suffixes:
            if lower_cleaned.endswith(suffix):
                cleaned = cleaned[: -len(suffix)].strip(" ,-/")
                lower_cleaned = cleaned.lower()

        words = cleaned.split()
        if len(words) > 1 and words[-1].isupper() and len(words[-1]) <= 3:
            words = words[:-1]
        cleaned = " ".join(words).strip()

        return cleaned

    @staticmethod
    def _city_from_url(city_url: Optional[str]) -> str:
        if not city_url:
            return ""

        parsed = urlparse(city_url)
        path_parts = [segment for segment in unquote(parsed.path).split("/") if segment]
        if not path_parts:
            return ""

        if path_parts[0].lower() == "city":
            path_parts = path_parts[1:]

        if not path_parts:
            return ""

        if len(path_parts) >= 2:
            candidate = path_parts[-2]
        else:
            candidate = path_parts[-1]

        cleaned = candidate.replace("-", " ").replace("_", " ").strip()
        return cleaned.title()

    @staticmethod
    def _derive_location_details(city: Dict[str, str]) -> Dict[str, str]:
        raw_name = (city or {}).get("name", "Desconhecido")
        cleaned_label = AqiService._strip_parenthetical(raw_name)
        parts = [part.strip() for part in cleaned_label.split(",") if part.strip()]

        station = parts[0] if parts else cleaned_label

        city_candidate = ""
        if len(parts) >= 3:
            city_candidate = parts[-2]
        elif parts:
            city_candidate = AqiService._clean_city_candidate(parts[0])

        if not city_candidate:
            city_candidate = AqiService._city_from_url((city or {}).get("url"))

        if not city_candidate:
            city_candidate = AqiService._clean_city_candidate(station)

        if not city_candidate:
            city_candidate = "Desconhecido"

        return {
            "label": cleaned_label,
            "city": city_candidate,
            "station": station,
        }

    # Tabela de categorias AQI (US EPA)
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
        """Calcula categoria baseado no valor AQI"""
        for low, high, category in AqiService.AQI_BREAKPOINTS:
            if low <= aqi <= high:
                return category
        return "Perigoso"
    
    @staticmethod
    def normalize_waqi_data(data: Dict) -> Dict:
        """
        Normaliza dados do WAQI para formato padrão
        
        Estrutura do WAQI:
        {
            "aqi": 72,
            "idx": 12345,
            "city": {
                "name": "São Paulo",
                "geo": [-23.55, -46.63],
                "url": "..."
            },
            "iaqi": {
                "pm25": {"v": 21.3},
                "pm10": {"v": 38.9},
                "o3": {"v": 64.0},
                "no2": {"v": 14.1},
                "so2": {"v": 2.0},
                "co": {"v": 0.4}
            },
            "time": {
                "s": "2025-11-05 12:00:00",
                "tz": "-03:00",
                "v": 1730815200,
                "iso": "2025-11-05T12:00:00-03:00"
            }
        }
        """
        try:
            aqi = data.get("aqi", 0)
            
            # Se AQI for string (às vezes vem "-"), converter
            if isinstance(aqi, str):
                if aqi == "-":
                    aqi = 0
                else:
                    try:
                        aqi = int(aqi)
                    except:
                        aqi = 0
            
            # Extrair poluentes individuais (iaqi = Individual Air Quality Index)
            iaqi = data.get("iaqi", {})
            
            pollutants = {
                "pm25": iaqi.get("pm25", {}).get("v"),
                "pm10": iaqi.get("pm10", {}).get("v"),
                "o3": iaqi.get("o3", {}).get("v"),
                "no2": iaqi.get("no2", {}).get("v"),
                "so2": iaqi.get("so2", {}).get("v"),
                "co": iaqi.get("co", {}).get("v")
            }
            
            # Informações da cidade
            city = data.get("city", {})
            geo = city.get("geo", [0, 0])
            location_details = AqiService._derive_location_details(city)

            # Timestamp
            time_info = data.get("time", {})
            timestamp = time_info.get("iso", datetime.now(timezone.utc).isoformat())

            return {
                "aqi": int(aqi),
                "category": AqiService.calculate_category(int(aqi)),
                "pollutants": pollutants,
                "location": {
                    "lat": geo[0] if len(geo) > 0 else 0,
                    "lng": geo[1] if len(geo) > 1 else 0,
                    "label": location_details["label"],
                    "city": location_details["city"],
                    "station": location_details["station"],
                },
                "source": "waqi",
                "timestamp": timestamp,
                "attribution": "Data provided by the World Air Quality Index project (https://waqi.info)",
            }

        except Exception as e:
            print(f"❌ Error normalizing WAQI data: {e}")
            raise HTTPException(status_code=500, detail="Erro ao processar dados da API")
    
    @staticmethod
    def generate_mock_data(lat: float, lng: float) -> Dict:
        """
        Gera dados mock determinísticos quando WAQI não tem dados
        (usado apenas quando não há token ou API não responde)
        """
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
            "location": {
                "lat": lat,
                "lng": lng,
                "label": f"Lat {lat:.2f}, Lng {lng:.2f}",
                "city": f"Lat {lat:.2f}, Lng {lng:.2f}",
                "station": f"Lat {lat:.2f}, Lng {lng:.2f}",
            },
            "source": "mock",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "attribution": "Mock data - Configure WAQI_API_KEY for real data"
        }

# ==================== INSTÂNCIAS ====================

WAQI_TOKEN = os.getenv("WAQI_API_KEY")

if not WAQI_TOKEN:
    print("⚠️  WARNING: WAQI_API_KEY não configurado!")
    print("📝 Obtenha seu token gratuito em: https://aqicn.org/data-platform/token/")
    print("💡 O sistema funcionará com dados mock até você configurar a chave.")

waqi = WAQIClient(WAQI_TOKEN) if WAQI_TOKEN else None
nominatim = NominatimClient()


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "").encode("ascii", "ignore").decode("ascii")
    return normalized.lower().strip()


FALLBACK_PLACES = [
    {"name": "São Paulo, Brasil", "lat": -23.55, "lng": -46.63},
    {"name": "Rio de Janeiro, Brasil", "lat": -22.91, "lng": -43.17},
    {"name": "Brasília, Brasil", "lat": -15.7939, "lng": -47.8828},
    {"name": "Lisboa, Portugal", "lat": 38.7223, "lng": -9.1393},
    {"name": "Tóquio, Japão", "lat": 35.6762, "lng": 139.6503},
    {"name": "Hong Kong, China", "lat": 22.3193, "lng": 114.1694},
    {"name": "Dubai, Emirados Árabes Unidos", "lat": 25.2048, "lng": 55.2708},
]


def extract_place_parts(place_name: str) -> Dict[str, str]:
    """Retorna nome normalizado completo, cidade e país de um fallback."""

    normalized_full = normalize_text(place_name)
    pieces = [p.strip() for p in normalized_full.split(",") if p.strip()]
    city = pieces[0] if pieces else normalized_full
    country = pieces[-1] if len(pieces) > 1 else ""

    return {
        "full": normalized_full,
        "city": city,
        "country": country,
    }


def build_country_capital_map() -> Dict[str, Dict]:
    """Mapeia países conhecidos para suas capitais no fallback."""

    manual_map = {
        "brasil": "Brasília, Brasil",
        "portugal": "Lisboa, Portugal",
        "japao": "Tóquio, Japão",
        "china": "Hong Kong, China",
        "emirados arabes unidos": "Dubai, Emirados Árabes Unidos",
    }

    capitals: Dict[str, Dict] = {}

    for country_key, place_name in manual_map.items():
        normalized_target = normalize_text(place_name)
        for place in FALLBACK_PLACES:
            place_parts = extract_place_parts(place["name"])
            if place_parts["full"] == normalized_target:
                capitals[country_key] = place
                break

    return capitals


COUNTRY_CAPITALS = build_country_capital_map()


def resolve_fallback_results(query: str) -> List[Dict]:
    """Resolve resultados determinísticos quando Nominatim não responde."""

    normalized_query = " ".join(normalize_text(query).split())

    if not normalized_query:
        return []

    query_parts = [p.strip() for p in normalized_query.split(",") if p.strip()]
    city_part = query_parts[0] if query_parts else normalized_query
    country_part = query_parts[-1] if len(query_parts) > 1 else ""

    exact_matches: List[Dict] = []
    city_matches: List[Dict] = []

    for place in FALLBACK_PLACES:
        parts = extract_place_parts(place["name"])

        aliases = {
            parts["full"],
            parts["city"],
        }

        if parts["country"]:
            aliases.add(f"{parts['city']}, {parts['country']}")
            aliases.add(f"{parts['city']} {parts['country']}")

        if normalized_query in aliases:
            exact_matches.append(place)
            continue

        if city_part == parts["city"]:
            if country_part:
                if country_part == parts["country"]:
                    exact_matches.append(place)
                else:
                    city_matches.append(place)
            else:
                city_matches.append(place)

    if exact_matches:
        return exact_matches

    if city_matches and not country_part:
        return city_matches

    if country_part and country_part in COUNTRY_CAPITALS:
        return [COUNTRY_CAPITALS[country_part]]

    if not country_part and normalized_query in COUNTRY_CAPITALS:
        return [COUNTRY_CAPITALS[normalized_query]]

    partial_matches = [
        place
        for place in FALLBACK_PLACES
        if normalized_query in extract_place_parts(place["name"])["full"]
    ]

    return partial_matches
aqi_service = AqiService()

# ==================== ROTAS ====================

@app.get("/")
async def root():
    """Rota raiz com informações da API"""
    return {
        "name": "AirCheck API",
        "version": "2.0.0",
        "status": "online",
        "waqi_configured": bool(WAQI_TOKEN),
        "endpoints": {
            "health": "/health",
            "places": "/places/search?q=<cidade>",
            "aqi": "/aqi/current?lat=<lat>&lng=<lng>",
            "docs": "/docs"
        },
        "message": "Configure WAQI_API_KEY no .env para dados reais" if not WAQI_TOKEN else "WAQI configurado!"
    }

@app.get("/health")
async def health_check():
    """Verificação de saúde do sistema"""
    return {
        "status": "ok",
        "waqi_configured": bool(WAQI_TOKEN),
        "cache_size": len(cache_store),
        "message": "Obtenha token em https://aqicn.org/data-platform/token/" if not WAQI_TOKEN else "Sistema operacional",
        "apis": {
            "waqi": "configurada" if WAQI_TOKEN else "mock",
            "nominatim": "online"
        }
    }

@app.get("/places/search")
async def search_places(q: str = Query(..., min_length=1, description="Nome da cidade para buscar")):
    """
    Busca lugares por nome usando Nominatim (OpenStreetMap)
    
    Exemplo: /places/search?q=São Paulo
    """
    cache_key = f"place:{q}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    results = await nominatim.search(q)

    if not results:
        fallback_results = resolve_fallback_results(q)

        if fallback_results:
            set_cache(cache_key, fallback_results)
            return fallback_results

        raise HTTPException(status_code=404, detail="Nenhum local encontrado")
    
    set_cache(cache_key, results)
    return results

@app.get("/aqi/current")
async def get_current_aqi(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude")
):
    """
    Obtém dados de qualidade do ar para coordenadas específicas
    
    Usa a API WAQI (World Air Quality Index)
    
    Exemplo: /aqi/current?lat=-23.55&lng=-46.63
    """
    # Verificar cache
    cache_key = f"aqi:{lat:.4f},{lng:.4f}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    # Se não tem token WAQI, retorna mock
    if not waqi:
        print("⚠️  Usando dados mock - Configure WAQI_API_KEY")
        result = aqi_service.generate_mock_data(lat, lng)
        set_cache(cache_key, result)
        return result
    
    # Tentar obter dados do WAQI
    try:
        waqi_data = await waqi.get_by_coords(lat, lng)
        
        if waqi_data:
            result = aqi_service.normalize_waqi_data(waqi_data)
            set_cache(cache_key, result)
            return result
        else:
            # WAQI não tem dados para esta localização
            raise HTTPException(
                status_code=404, 
                detail=f"Nenhuma estação de monitoramento encontrada próxima a {lat}, {lng}. Tente coordenadas de grandes cidades."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao consultar WAQI: {e}")
        # Se houver erro na API, retorna mock como fallback
        result = aqi_service.generate_mock_data(lat, lng)
        result["error"] = "Erro ao acessar API WAQI - usando dados mock"
        set_cache(cache_key, result)
        return result

@app.get("/aqi/search")
async def search_aqi_by_city(
    city: str = Query(..., min_length=2, description="Nome da cidade")
):
    """
    Busca AQI diretamente pelo nome da cidade usando WAQI
    
    Exemplo: /aqi/search?city=Beijing
    """
    if not waqi:
        raise HTTPException(
            status_code=503, 
            detail="WAQI_API_KEY não configurado. Obtenha em https://aqicn.org/data-platform/token/"
        )
    
    cache_key = f"aqi:search:{city}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    try:
        results = await waqi.search_by_name(city)
        
        if not results or len(results) == 0:
            raise HTTPException(status_code=404, detail=f"Nenhuma estação encontrada para '{city}'")
        
        # Processar resultados
        processed = []
        for station in results[:5]:  # Limitar a 5 resultados
            if station.get("aqi") and station.get("aqi") != "-":
                processed.append({
                    "station_name": station.get("station", {}).get("name", "Unknown"),
                    "aqi": int(station.get("aqi")) if isinstance(station.get("aqi"), (int, str)) else 0,
                    "url": station.get("station", {}).get("url", "")
                })
        
        set_cache(cache_key, processed)
        return processed
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar cidade: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar dados: {str(e)}")

# ==================== INFORMAÇÕES ADICIONAIS ====================

@app.get("/info/categories")
async def get_aqi_categories():
    """Retorna as categorias de AQI e seus ranges"""
    return {
        "categories": [
            {"range": "0-50", "name": "Bom", "color": "green", "description": "Qualidade do ar satisfatória"},
            {"range": "51-100", "name": "Moderado", "color": "yellow", "description": "Qualidade aceitável"},
            {"range": "101-150", "name": "Insalubre para Grupos Sensíveis", "color": "orange", "description": "Grupos sensíveis podem ter efeitos"},
            {"range": "151-200", "name": "Insalubre", "color": "red", "description": "Todos podem começar a ter efeitos"},
            {"range": "201-300", "name": "Muito Insalubre", "color": "purple", "description": "Alerta de saúde"},
            {"range": "301+", "name": "Perigoso", "color": "maroon", "description": "Emergência de saúde"}
        ],
        "pollutants": {
            "pm25": {"name": "PM2.5", "unit": "µg/m³", "description": "Partículas finas"},
            "pm10": {"name": "PM10", "unit": "µg/m³", "description": "Partículas inaláveis"},
            "o3": {"name": "O₃", "unit": "µg/m³", "description": "Ozônio"},
            "no2": {"name": "NO₂", "unit": "µg/m³", "description": "Dióxido de nitrogênio"},
            "so2": {"name": "SO₂", "unit": "µg/m³", "description": "Dióxido de enxofre"},
            "co": {"name": "CO", "unit": "mg/m³", "description": "Monóxido de carbono"}
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)