# summariser — install from source (PowerShell)
# Usage: .\install.ps1
# Requires Node.js v18+

$ErrorActionPreference = "Stop"

# ─── Switch to script directory ───────────────────────────────────────────────
Set-Location $PSScriptRoot

function info    { Write-Host "  -> $args" -ForegroundColor Cyan }
function success { Write-Host "  v $args"  -ForegroundColor Green }
function fail    { Write-Host "  x $args"  -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  summariser -- install from source" -ForegroundColor Cyan
Write-Host ""

# ─── Node.js check ────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    fail "Node.js is not installed. Download from https://nodejs.org (v18+)"
}

$nodeMajor = node -e "process.stdout.write(process.versions.node.split('.')[0])"
if ([int]$nodeMajor -lt 18) {
    fail "Node.js v18+ required (found v$nodeMajor)"
}
success "Node.js $(node --version) found"

# ─── npm check ────────────────────────────────────────────────────────────────
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    fail "npm is not installed"
}
success "npm $(npm --version) found"

# ─── Install dependencies ─────────────────────────────────────────────────────
info "Installing dependencies..."
npm install --silent
if ($LASTEXITCODE -ne 0) { fail "npm install failed" }
success "Dependencies installed"

# ─── Build ────────────────────────────────────────────────────────────────────
info "Compiling TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) { fail "Build failed" }
success "Build complete (dist/)"

# ─── Global install ───────────────────────────────────────────────────────────
info "Installing globally via npm link..."
npm link
if ($LASTEXITCODE -ne 0) { fail "npm link failed" }
success "'sumr' and 'summariser' commands are now available globally"

Write-Host ""
Write-Host "  Done! Run the setup wizard to configure your API key:" -ForegroundColor Green
Write-Host ""
Write-Host "    sumr config init"
Write-Host ""
