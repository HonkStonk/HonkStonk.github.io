param([switch]$SetupOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.local/collector-venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { $pythonPath = 'python' }
$keyPath = Join-Path $projectRoot '.local/tickster-key.xml'
$previousKey = $env:TICKSTER_API_KEY

try {
    Write-Host 'Paste your Tickster API key at the hidden prompt, then press Enter.'
    Write-Host 'It will be checked and encrypted for your Windows account on this computer.'
    $concertSecret = Read-Host 'Tickster API key' -AsSecureString
    $env:TICKSTER_API_KEY = [System.Net.NetworkCredential]::new('', $concertSecret).Password
    & $pythonPath (Join-Path $PSScriptRoot 'fetch_concerts.py') --check-tickster
    if ($LASTEXITCODE -ne 0) { throw 'Tickster did not accept the key.' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $keyPath) -Force | Out-Null
    $concertSecret | Export-Clixml -LiteralPath $keyPath
    Write-Host 'Tickster connected. Future local collector runs will load this encrypted key automatically.'
    if (-not $SetupOnly) {
        Write-Host 'Refreshing the local concert snapshot now. This may take a few minutes.'
        & $pythonPath (Join-Path $PSScriptRoot 'fetch_concerts.py') --require-ticketmaster --require-tickster
        if ($LASTEXITCODE -ne 0) { throw 'Concert refresh failed.' }
    }
    Write-Host 'This configures your computer. GitHub Actions needs its own TICKSTER_API_KEY repository secret.'
} catch {
    Write-Host 'Setup could not finish. Check the Tickster API key and your connection, then try again.'
    exit 1
} finally {
    $env:TICKSTER_API_KEY = $previousKey
    if ($concertSecret) { $concertSecret.Dispose() }
}
