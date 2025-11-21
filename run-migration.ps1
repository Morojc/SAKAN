# PowerShell script to help execute the Supabase migration
# Option 1: Copy SQL to clipboard for easy pasting into Supabase Dashboard
# Option 2: Use Supabase CLI if installed

$migrationFile = "supabase\migrations\20241120000000_nextauth_schema.sql"

if (Test-Path $migrationFile) {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Supabase Migration Execution Guide" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "OPTION 1: Supabase Dashboard (Recommended)" -ForegroundColor Yellow
    Write-Host "1. Open https://app.supabase.com" -ForegroundColor White
    Write-Host "2. Select your project" -ForegroundColor White
    Write-Host "3. Go to SQL Editor (left sidebar)" -ForegroundColor White
    Write-Host "4. Click 'New query'" -ForegroundColor White
    Write-Host "5. Copy the contents of: $migrationFile" -ForegroundColor White
    Write-Host "6. Paste into the SQL Editor" -ForegroundColor White
    Write-Host "7. Click 'Run' or press Ctrl+Enter" -ForegroundColor White
    Write-Host ""
    
    # Copy to clipboard
    $content = Get-Content $migrationFile -Raw
    Set-Clipboard -Value $content
    Write-Host "✓ Migration SQL has been copied to your clipboard!" -ForegroundColor Green
    Write-Host "  Just paste it into Supabase SQL Editor and run it." -ForegroundColor Green
    Write-Host ""
    
    Write-Host "OPTION 2: Supabase CLI (if installed)" -ForegroundColor Yellow
    Write-Host "Run: supabase db push" -ForegroundColor White
    Write-Host "Or: supabase migration up" -ForegroundColor White
    Write-Host ""
    
    Write-Host "After running the migration:" -ForegroundColor Cyan
    Write-Host "1. Restart your dev server (npm run dev or pnpm dev)" -ForegroundColor White
    Write-Host "2. Try Google sign-in again" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host "Error: Migration file not found at $migrationFile" -ForegroundColor Red
}

