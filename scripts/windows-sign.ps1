param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Path
)

$required = @('SM_HOST', 'SM_API_KEY', 'SM_CLIENT_CERT_FILE', 'SM_CLIENT_CERT_PASSWORD', 'SM_KEYPAIR_ALIAS')
foreach ($name in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Missing required DigiCert signing environment variable: $name"
  }
}

$resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
& smctl sign --simple --keypair-alias $env:SM_KEYPAIR_ALIAS --input $resolved
if ($LASTEXITCODE -ne 0) {
  throw "DigiCert smctl failed to sign $resolved with exit code $LASTEXITCODE"
}

$signature = Get-AuthenticodeSignature -FilePath $resolved
if ($signature.Status -ne 'Valid') {
  throw "Authenticode verification failed for $resolved with status $($signature.Status)"
}
