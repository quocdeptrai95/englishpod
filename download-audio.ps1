# Download all 365 audio files from archive.org
# Total size: ~2.5GB

$audioFolder = ".\audio"
if (-not (Test-Path $audioFolder)) {
    New-Item -ItemType Directory -Path $audioFolder | Out-Null
    Write-Host "Created folder: $audioFolder" -ForegroundColor Green
}

# Read episodes index to get all MP3 URLs
$indexContent = Get-Content ".\episodes-index.js" -Raw
$indexContent -match 'window\.episodesIndex\s*=\s*window\.episodesIndex\s*\|\|\s*(\[.*?\]);' | Out-Null
$jsonContent = $matches[1]

# Parse JSON
$episodes = $jsonContent | ConvertFrom-Json

Write-Host "Found $($episodes.Count) episodes" -ForegroundColor Cyan
Write-Host "Estimated total size: ~2.5GB" -ForegroundColor Yellow
Write-Host "This will take a while depending on your internet speed..." -ForegroundColor Yellow
Write-Host ""

$downloaded = 0
$skipped = 0
$failed = 0

foreach ($episode in $episodes) {
    $fileName = [System.IO.Path]::GetFileName($episode.mp3)
    $localPath = Join-Path $audioFolder $fileName
    
    # Skip if already downloaded
    if (Test-Path $localPath) {
        Write-Host "[$($episode.id)/$($episodes.Count)] Skipped: $fileName (already exists)" -ForegroundColor Gray
        $skipped++
        continue
    }
    
    $mp3Url = $episode.mp3
    if ($mp3Url -like '/englishpod_*') {
        $mp3Url = "https://archive.org/download/englishpod_all/$fileName"
    }
    if ($mp3Url -like 'http*') {
        try {
            Write-Host "[$($episode.id)/$($episodes.Count)] Downloading: $fileName" -ForegroundColor Cyan
            # Download with progress
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $mp3Url -OutFile $localPath -TimeoutSec 120
            $ProgressPreference = 'Continue'
            $fileSize = (Get-Item $localPath).Length / 1MB
            Write-Host "[$($episode.id)/$($episodes.Count)] Downloaded: $fileName ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
            $downloaded++
            # Small delay to avoid overwhelming the server
            Start-Sleep -Milliseconds 100
        } catch {
            Write-Host "[$($episode.id)/$($episodes.Count)] Failed: $fileName - $($_.Exception.Message)" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "[$($episode.id)/$($episodes.Count)] Skipped: $fileName (local path)" -ForegroundColor Gray
        $skipped++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download Summary:" -ForegroundColor Cyan
Write-Host "Downloaded: $downloaded files" -ForegroundColor Green
Write-Host "Skipped: $skipped files" -ForegroundColor Gray
Write-Host "Failed: $failed files" -ForegroundColor Red

$totalFiles = Get-ChildItem $audioFolder -Filter *.mp3 | Measure-Object -Property Length -Sum
$totalSizeGB = [math]::Round($totalFiles.Sum / 1GB, 2)
Write-Host "Total size: $totalSizeGB GB ($($totalFiles.Count) files)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
