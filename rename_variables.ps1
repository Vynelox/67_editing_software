# Read the file
$filePath = 'main.cjs'
$content = Get-Content $filePath -Raw

# Replace all instances using whole word matching
$content = $content -replace '\boverlayWin\b', 'shader_window'
$content = $content -replace '\bwin\b', 'app_window'

# Write the file back
Set-Content $filePath $content

Write-Host 'Renaming complete:'
Write-Host '  overlayWin -> shader_window'
Write-Host '  win -> app_window'