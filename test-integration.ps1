Write-Host "`n🧪 Iniciando Testes de Integração AirCheck" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$PASS = 0
$FAIL = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Expected
    )
    
    Write-Host "Testando: $Name... " -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
    }
    catch {
        # Tenta extrair o código de status de uma resposta de erro HTTP (ex: 422, 404)
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
        else {
            # Falha de conexão (ex: backend offline)
            $statusCode = 0 # ou algum código de erro que não seja o esperado
            Write-Host "✗ FALHA DE CONEXÃO: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    if ($statusCode -eq $Expected) {
        Write-Host "✓ PASS" -ForegroundColor Green
        $script:PASS++
    }
    else {
        Write-Host "✗ FAIL (Expected: $Expected, Got: $statusCode)" -ForegroundColor Red
        $script:FAIL++
    }
}

# 1. Verificar se backend está rodando
Write-Host "1. Verificando Backend..."
try {
    # CORREÇÃO: Trocado 'localhost' por '127.0.0.1' para forçar IPv4
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Backend online`n" -ForegroundColor Green
}
catch {
    Write-Host "❌ Backend não está rodando!" -ForegroundColor Red
    Write-Host "Execute: cd backend && uvicorn main:app --reload"
    exit 1
}

# 2. Testes
Write-Host "2. Executando Testes..."
# CORREÇÃO: Trocado 'localhost' por '127.0.0.1' em todos os endpoints
Test-Endpoint "Health Check" "http://127.0.0.1:8000/health" 200
Test-Endpoint "Search São Paulo" "http://127.0.0.1:8000/places/search?q=São%20Paulo" 200
Test-Endpoint "AQI São Paulo" "http://127.0.0.1:8000/aqi/current?lat=-23.55&lng=-46.63" 200
Test-Endpoint "AQI Tóquio" "http://127.0.0.1:8000/aqi/current?lat=35.68&lng=139.76" 200
Test-Endpoint "Invalid Lat" "http://127.0.0.1:8000/aqi/current?lat=100&lng=0" 422
Test-Endpoint "Invalid Lng" "http://127.0.0.1:8000/aqi/current?lat=0&lng=-200" 422
Test-Endpoint "Missing Params" "http://127.0.0.1:8000/aqi/current" 422

Write-Host "`n3. Verificando Estrutura de Resposta..."
try {
    # CORREÇÃO: Trocado 'localhost' por '127.0.0.1'
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/aqi/current?lat=-23.55&lng=-46.63"
    
    if ($response.aqi) {
        Write-Host "✓ Campo 'aqi' presente" -ForegroundColor Green
        $script:PASS++
    }
    if ($response.category) {
        Write-Host "✓ Campo 'category' presente" -ForegroundColor Green
        $script:PASS++
    }
    if ($response.pollutants) {
        Write-Host "✓ Campo 'pollutants' presente" -ForegroundColor Green
        $script:PASS++
    }
}
catch {
    Write-Host "✗ Erro ao verificar estrutura: $($_.Exception.Message)" -ForegroundColor Red
    $script:FAIL += 3
}

Write-Host "`n=========================================="
Write-Host "📊 Resultados:"
Write-Host "Passou: $PASS" -ForegroundColor Green
Write-Host "Falhou: $FAIL" -ForegroundColor Red
Write-Host ""

if ($FAIL -eq 0) {
    Write-Host "🎉 Todos os testes passaram!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "❌ Alguns testes falharam" -ForegroundColor Red
    exit 1
}