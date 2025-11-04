# AirCheck - Monitor de Qualidade do Ar 🌍💨

Aplicação MVP para monitoramento de qualidade do ar com validação de localização GPS e busca por nome ou coordenadas.

## 🚀 Funcionalidades

- ✅ Geolocalização HTML5 (botão "Usar minha localização")
- ✅ Busca por nome de local (ex: "São Paulo, SP")
- ✅ Busca por coordenadas (ex: "-23.55,-46.63")
- ✅ Exibição de AQI (Air Quality Index) atual
- ✅ Principais poluentes: PM2.5, PM10, O₃, NO₂, SO₂, CO
- ✅ Cache de 5 minutos para reduzir chamadas externas
- ✅ Fallback automático: OpenAQ → OpenWeather → Mock

## 📋 Pré-requisitos

- **Python 3.8+**
- **Node.js 16+** e npm
- (Opcional) Chave da API OpenWeather

## 🛠️ Instalação e Execução

### 1. Backend (FastAPI)
```bash
# Entrar na pasta do backend
cd backend

# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# (Opcional) Configurar variável de ambiente
# Copiar .env.example para .env e adicionar sua chave OpenWeather
cp ../.env.example .env

# Executar servidor
uvicorn main:app --reload
```

O backend estará rodando em: **http://localhost:8000**

Documentação automática (Swagger): **http://localhost:8000/docs**

### 2. Frontend (React + Vite)

Em outro terminal:
```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev
```

O frontend estará rodando em: **http://localhost:5173**

## 📡 Endpoints da API

### GET /health
Verificação de status do servidor.
```bash
curl http://localhost:8000/health
```

Resposta:
```json
{"status": "ok"}
```

### GET /places/search?q={texto}
Busca lugares por nome.
```bash
curl "http://localhost:8000/places/search?q=São%20Paulo"
```

Resposta:
```json
[
  {
    "name": "São Paulo, Região Sudeste, Brasil",
    "lat": -23.5505199,
    "lng": -46.6333094
  }
]
```

### GET /aqi/current?lat={lat}&lng={lng}
Obtém dados de qualidade do ar para coordenadas.
```bash
curl "http://localhost:8000/aqi/current?lat=-23.55&lng=-46.63"
```

Resposta:
```json
{
  "aqi": 72,
  "category": "Moderado",
  "pollutants": {
    "pm25": 21.3,
    "pm10": 38.9,
    "o3": 64.0,
    "no2": 14.1,
    "so2": 2.0,
    "co": 0.4
  },
  "location": {
    "lat": -23.55,
    "lng": -46.63,
    "label": "São Paulo, BR"
  },
  "source": "openaq",
  "timestamp": "2025-01-01T12:34:56Z"
}
```

## 🎯 Critérios de Aceite (Teste Manual)

1. ✅ Clicar em "Usar minha localização" → exibe lat/lng e retorna AQI
2. ✅ Buscar por nome "São Paulo" → retorna coordenadas e AQI
3. ✅ Buscar por coordenadas "-23.55,-46.63" → retorna AQI
4. ✅ Com `OPENWEATHER_API_KEY` vazio, sistema funciona com OpenAQ ou Mock

## 📊 Categorias de AQI (US EPA)

| AQI | Categoria | Cor |
|-----|-----------|-----|
| 0-50 | Bom | Verde |
| 51-100 | Moderado | Amarelo |
| 101-150 | Insalubre para Grupos Sensíveis | Laranja |
| 151-200 | Insalubre | Vermelho |
| 201-300 | Muito Insalubre | Roxo |
| 301+ | Perigoso | Marrom |

## 🔧 Arquitetura

### Backend
- **Framework**: FastAPI
- **APIs externas**:
  - Nominatim (OpenStreetMap) - Geocodificação
  - OpenAQ - Qualidade do ar (preferencial)
  - OpenWeather - Fallback (requer chave)
- **Cache**: Em memória com TTL de 5 minutos

### Frontend
- **Framework**: React 18 + Vite
- **Estilo**: Tailwind CSS (via CDN)
- **Ícones**: Lucide React
- **Estado**: React Hooks (useState)

## 📝 Notas

- Sem banco de dados (cache em memória)
- Sem autenticação/login
- APIs nunca consumidas direto do frontend
- Coordenadas válidas: -90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180
- Normalização automática de separadores decimais (, → .)

## 🐛 Resolução de Problemas

**Erro de CORS**: Certifique-se de que o backend está rodando na porta 8000.

**"Permissão de localização negada"**: Use a busca manual por nome ou coordenadas.

**Sem dados para a região**: Tente coordenadas próximas a grandes cidades ou o sistema usará dados mock.
