$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$dist = Join-Path $root 'dist'
$zipPath = Join-Path $dist "daria-timer-$($manifest.version).zip"

$files = @(
  'manifest.json',
  'background.js',
  'content/content.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
)

New-Item -ItemType Directory -Force $dist | Out-Null
if (Test-Path $zipPath) { Remove-Item $zipPath -Confirm:$false }

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  foreach ($f in $files) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $root $f), $f, 'Optimal') | Out-Null
  }
} finally {
  $zip.Dispose()
}

Write-Host "Built $zipPath"
