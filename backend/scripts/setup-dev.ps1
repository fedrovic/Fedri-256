<#
Simple setup helper for SkillSwap backend.

Usage:
  In PowerShell run:
    powershell -ExecutionPolicy Bypass -File backend\scripts\setup-dev.ps1

This script will:
  - copy .env.example to .env if missing
  - start Postgres and Redis with docker compose (if docker is available)
  - run npm ci, prisma generate, and npm run db:reset (if npm is available)
#>

function Test-Command($name) {
  try { Get-Command $name -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

Write-Host "== SkillSwap backend local setup =="

# Move to backend folder (script is located at backend\scripts)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Set-Location ..

Write-Host "Working directory: $(Get-Location)"

if (-not (Test-Path .env)) {
  if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example"
  } else {
    Write-Warning ".env.example missing - please create .env manually"
  }
} else {
  Write-Host ".env exists — keeping it"
}

$haveNode   = Test-Command node
$haveNpm    = Test-Command npm
$haveNpx    = Test-Command npx
$haveDocker = Test-Command docker

if ($haveDocker) {
  Write-Host "Starting Postgres and Redis via docker compose..."
  docker compose up -d postgres redis
  if ($LASTEXITCODE -ne 0) { Write-Warning "docker compose returned an error" }
}

if ($haveNpm) {
  Write-Host "Running npm ci..."
  npm ci
  if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed"; exit 1 }

  if ($haveNpx) {
    Write-Host "Running npx prisma generate..."
    npx prisma generate
  }

  Write-Host "Running npm run db:reset..."
  npm run db:reset
} else {
  Write-Warning "npm not found - skipping dependency and prisma steps"
}

Write-Host 'Done. Start backend with: $env:PORT=5000; npm run dev'
