#!/usr/bin/env bash
set -e

# ─── Switch to script directory ───────────────────────────────────────────────
cd "$(dirname "$(realpath "$0")")"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}  →${NC} $*"; }
success() { echo -e "${GREEN}  ✓${NC} $*"; }
warn()    { echo -e "${YELLOW}  !${NC} $*"; }
error()   { echo -e "${RED}  ✗${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}  summariser — install from source${NC}"
echo ""

# ─── Node.js check ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install it from https://nodejs.org (v18+)"
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  error "Node.js v18+ required (found v$NODE_VER)"
fi
success "Node.js v$(node --version | tr -d 'v') found"

# ─── npm check ────────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  error "npm is not installed"
fi
success "npm $(npm --version) found"

# ─── Install dependencies ─────────────────────────────────────────────────────
info "Installing dependencies..."
npm install --silent
success "Dependencies installed"

# ─── Build ────────────────────────────────────────────────────────────────────
info "Compiling TypeScript..."
npm run build
success "Build complete (dist/)"

# ─── Global install ───────────────────────────────────────────────────────────
info "Installing globally via npm link..."
npm link
success "'sumr' and 'summariser' commands are now available globally"

echo ""
echo -e "${GREEN}  Done!${NC} Run the setup wizard to configure your API key:"
echo ""
echo "    sumr config init"
echo ""
