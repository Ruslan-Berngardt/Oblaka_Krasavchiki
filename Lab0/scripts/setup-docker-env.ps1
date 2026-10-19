$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot '../.env.docker'
if (Test-Path $target) {
    Write-Host '.env.docker already exists; existing settings were preserved.'
    exit 0
}
$bytes = New-Object byte[] 24
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$password = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
$content = "# Local Docker configuration. Do not commit or share this file.`nPOSTGRES_USER=kadr`nPOSTGRES_DB=kadr`nPOSTGRES_PASSWORD=$password`nHOST_PORT=8080`n"
$encoding = New-Object System.Text.UTF8Encoding($false)
$file = [System.IO.File]::Open($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try {
    $data = $encoding.GetBytes($content)
    $file.Write($data, 0, $data.Length)
} finally { $file.Dispose() }
Write-Host '.env.docker created. The database password is stored locally and was not printed.'
