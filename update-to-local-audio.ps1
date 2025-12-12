# Update episodes-index.js to use local audio files
Write-Host "Updating episodes-index.js to use local audio files..." -ForegroundColor Cyan

$indexFile = ".\episodes-index.js"
$content = Get-Content $indexFile -Raw

# Replace all archive.org URLs with local ./audio/ paths
$updatedContent = $content -replace 'https://archive\.org/download/englishpod_all/', 'audio/'

# Save updated file
Set-Content -Path $indexFile -Value $updatedContent -NoNewline

Write-Host "✅ Done! All 365 episodes now use local audio files." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the website locally" -ForegroundColor White
Write-Host "2. Upload the 'audio' folder to your server" -ForegroundColor White
Write-Host "3. Upload all other files (index.html, script.js, etc.)" -ForegroundColor White
