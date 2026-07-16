$ErrorActionPreference = "Stop"

$secret = $env:LAB_BROKER_SECRET
if (-not $secret) { $secret = [Environment]::GetEnvironmentVariable("BOMBA_LAB_BROKER_SECRET", "User") }
$key = $env:NINE_ROUTER_API_KEY
if (-not $key) { $key = [Environment]::GetEnvironmentVariable("BOMBA_LAB_NINE_ROUTER_KEY", "User") }

if (-not $secret) { throw "BOMBA_LAB_BROKER_SECRET nao configurado." }
if (-not $key) { throw "BOMBA_LAB_NINE_ROUTER_KEY nao configurado." }

$env:LAB_BROKER_SECRET = $secret
$env:NINE_ROUTER_API_KEY = $key
$env:NINE_ROUTER_BASE_URL = "http://127.0.0.1:20128/v1"

node lab-broker/server.mjs
