Write-Host "`n🧪 Testando Cidades Brasileiras..." -ForegroundColor Cyan

$cities = @(
    "São Paulo",
    "Rio de Janeiro", 
    "Curitiba",
    "Porto Alegre",
    "Brasília",
    "Salvador"
)

foreach ($city in $cities) {
    Write-Host "`n📍 Buscando: $city" -ForegroundColor Yellow
    try {
        $result = Invoke-RestMethod "http://localhost:8000/places/search?q=$([uri]::EscapeDataString($city))"
        $first = $result[0]
        Write-Host "  ✓ Encontrado: $($first.name)" -ForegroundColor Green
        Write-Host "  Coordenadas: $($first.lat), $($first.lng)" -ForegroundColor Gray
    }
    catch {
        Write-Host "  ✗ Erro: $_" -ForegroundColor Red
    }
}

Write-Host "`n✅ Teste concluído!" -ForegroundColor Green