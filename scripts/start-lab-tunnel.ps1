$ErrorActionPreference = "Stop"

$tunnelId = [Environment]::GetEnvironmentVariable("BOMBA_LAB_TUNNEL_ID", "User")
if (-not $tunnelId) { throw "BOMBA_LAB_TUNNEL_ID nao configurado." }

$credentials = Join-Path $env:USERPROFILE ".cloudflared\$tunnelId.json"
if (-not (Test-Path -LiteralPath $credentials)) { throw "Credencial do tunnel Bomba PvP nao encontrada." }

$runtimeDirectory = Join-Path $env:LOCALAPPDATA "BombaPVP\lab-broker"
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$config = Join-Path $runtimeDirectory "named-tunnel.yml"
@"
tunnel: $tunnelId
credentials-file: $credentials
no-autoupdate: true

ingress:
  - hostname: lab-broker.bombapvp.com
    service: http://127.0.0.1:8766
  - service: http_status:404
"@ | Set-Content -LiteralPath $config -Encoding utf8

cloudflared tunnel --config $config run $tunnelId
