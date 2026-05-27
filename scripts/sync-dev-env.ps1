param(
  [string]$Stage = "dev",
  [string]$Region = "eu-central-1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $repoRoot ".env.local"
$stackName = "dreiecksrennen-$Stage-api-stack"

$apiUrl = aws cloudformation describe-stacks `
  --stack-name $stackName `
  --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
  --output text

if (-not $apiUrl -or $apiUrl.Trim() -eq "" -or $apiUrl.Trim() -eq "None") {
  throw "CloudFormation output ApiUrl was not found for stack $stackName."
}

$apiUrl = $apiUrl.Trim().TrimEnd("/")

$defaults = [ordered]@{
  VITE_API_BASE_URL = "/api"
  VITE_API_PROXY_TARGET = $apiUrl
  VITE_COGNITO_ENABLED = "true"
  VITE_COGNITO_DOMAIN = "https://dreiecksrennen-dev-auth-330221.auth.eu-central-1.amazoncognito.com"
  VITE_COGNITO_CLIENT_ID = "5ttev7ggo2mmcn354gpt2eh31t"
  VITE_COGNITO_REDIRECT_URI = "http://localhost:5173/admin/login"
  VITE_COGNITO_LOGOUT_URI = "http://localhost:5173/admin/login"
  VITE_COGNITO_SCOPES = "openid email profile"
  VITE_PUBLIC_CONTACT_EMAIL = "nennung@msc-oberlausitzer-dreilaendereck.eu"
  VITE_PUBLIC_WEBSITE_URL = "https://msc-oberlausitzer-dreilaendereck.eu"
  VITE_AUTH_IDLE_TIMEOUT_MINUTES = "45"
  VITE_AUTH_MAX_SESSION_HOURS = "12"
  VITE_ADMIN_ENABLE_TOKEN_LOGIN = "false"
  VITE_ADMIN_ENABLE_ROLE_PREVIEW = "false"
}

$values = [ordered]@{}
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $key, $value = $line.Split("=", 2)
    if ($key.Trim()) {
      $values[$key.Trim()] = $value
    }
  }
}

foreach ($key in $defaults.Keys) {
  $values[$key] = $defaults[$key]
}

$content = foreach ($key in $values.Keys) {
  "$key=$($values[$key])"
}

Set-Content -Path $envPath -Value $content -Encoding UTF8
Write-Host "Updated .env.local for $Stage API: $apiUrl"
