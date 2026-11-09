[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string[]]$Files,

  [ValidateSet("Plan", "Preview", "Production")]
  [string]$Mode = "Plan",

  [string]$BaseRef = "",
  [string]$Project = "ecl-split-one",
  [string]$Scope = "deebeedee-ecls-projects",
  [string]$ProductionUrl = "https://eclchina.lol",
  [string]$ExpectedPreviewDeployment = "",
  [switch]$Approved
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)] [string]$Command,
    [Parameter(Mandatory = $true)] [string[]]$Arguments
  )
  $output = @(& $Command @Arguments 2>&1 | ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($Command $($Arguments -join ' ')):`n$($output -join [Environment]::NewLine)"
  }
  return $output
}

function Get-DeploymentId {
  param([Parameter(Mandatory = $true)] [string]$Url)
  $inspect = Invoke-External "vercel" @("inspect", $Url, "--scope", $Scope, "--no-color")
  $match = [regex]::Match(($inspect -join "`n"), "(?m)^id\s+(dpl_[A-Za-z0-9]+)\s*$")
  if (-not $match.Success) {
    throw "Could not resolve the deployment ID for $Url."
  }
  return $match.Groups[1].Value
}

function Get-DeploymentMetadata {
  param([Parameter(Mandatory = $true)] [string]$DeploymentId)
  $raw = Invoke-External "vercel" @(
    "api",
    "/v13/deployments/$DeploymentId",
    "--scope",
    $Scope,
    "--no-color"
  )
  return (($raw -join "`n") | ConvertFrom-Json)
}

function Get-OptionalProperty {
  param(
    [AllowNull()] [object]$InputObject,
    [Parameter(Mandatory = $true)] [string]$Name
  )
  if ($null -eq $InputObject) { return $null }
  $property = $InputObject.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Get-ProductionMetadata {
  $deploymentId = Get-DeploymentId $ProductionUrl
  return Get-DeploymentMetadata $deploymentId
}

function Assert-SafeRelativeFile {
  param(
    [Parameter(Mandatory = $true)] [string]$RepositoryRoot,
    [Parameter(Mandatory = $true)] [string]$RelativePath
  )
  if ([System.IO.Path]::IsPathRooted($RelativePath)) {
    throw "Hotfix file paths must be repository-relative: $RelativePath"
  }
  if ([System.Management.Automation.WildcardPattern]::ContainsWildcardCharacters($RelativePath)) {
    throw "Wildcards are not allowed in hotfix file paths: $RelativePath"
  }
  $portablePath = $RelativePath.Replace("\", "/")
  while ($portablePath.StartsWith("./", [System.StringComparison]::Ordinal)) {
    $portablePath = $portablePath.Substring(2)
  }
  if (
    $portablePath -match "(^|/)(\.git|\.vercel|\.tmp|node_modules)(/|$)" -or
    $portablePath -match "(^|/)\.env([^/]*)$"
  ) {
    throw "Secrets, metadata, dependencies, and temporary files cannot be overlaid: $RelativePath"
  }
  $absolutePath = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot $RelativePath))
  $rootPrefix = $RepositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $absolutePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Hotfix file resolves outside the repository: $RelativePath"
  }
  if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
    throw "Hotfix file does not exist: $RelativePath"
  }
  $item = Get-Item -LiteralPath $absolutePath
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Reparse points/symlinks are not allowed in the hotfix overlay: $RelativePath"
  }
  return [pscustomobject]@{
    RelativePath = $portablePath
    AbsolutePath = $absolutePath
  }
}

function Get-ArtifactHash {
  param(
    [Parameter(Mandatory = $true)] [string]$BaseSha,
    [Parameter(Mandatory = $true)] [object[]]$SafeFiles
  )
  $lines = @("base=$BaseSha")
  foreach ($file in ($SafeFiles | Sort-Object RelativePath)) {
    $contentHash = (Get-FileHash -LiteralPath $file.AbsolutePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $lines += "$($file.RelativePath)=$contentHash"
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
  $stream = [System.IO.MemoryStream]::new($bytes)
  try {
    return (Get-FileHash -InputStream $stream -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  finally {
    $stream.Dispose()
  }
}

function Invoke-Deployment {
  param(
    [Parameter(Mandatory = $true)] [string]$PackageRoot,
    [Parameter(Mandatory = $true)] [ValidateSet("preview", "production")] [string]$Environment,
    [Parameter(Mandatory = $true)] [string]$DeploymentBaseSha,
    [Parameter(Mandatory = $true)] [string]$DeploymentArtifactHash
  )
  $arguments = @(
    "deploy",
    $PackageRoot,
    "--yes",
    "--project",
    $Project,
    "--scope",
    $Scope,
    "--archive=tgz",
    "--meta",
    "eclHotfixBaseSha=$DeploymentBaseSha",
    "--meta",
    "eclHotfixArtifactHash=$DeploymentArtifactHash",
    "--no-color"
  )
  if ($Environment -eq "production") {
    $arguments += "--prod"
  }
  else {
    $arguments += @("--environment", "preview")
  }

  $output = Invoke-External "vercel" $arguments
  $joined = $output -join "`n"
  $urlMatches = [regex]::Matches($joined, "https://[A-Za-z0-9-]+\.vercel\.app")
  if ($urlMatches.Count -eq 0) {
    throw "Vercel did not return a deployment URL.`n$joined"
  }
  $deploymentUrl = $urlMatches[$urlMatches.Count - 1].Value
  $deploymentId = Get-DeploymentId $deploymentUrl
  $metadata = Get-DeploymentMetadata $deploymentId
  if ($metadata.readyState -ne "READY") {
    throw "Deployment $deploymentId is not READY (state: $($metadata.readyState))."
  }
  return [pscustomobject]@{
    Id = $deploymentId
    Url = $deploymentUrl
    ReadyState = $metadata.readyState
    Environment = $Environment
  }
}

$repositoryRoot = (Invoke-External "git" @("rev-parse", "--show-toplevel") | Select-Object -Last 1).Trim()
if (-not $repositoryRoot) { throw "Not inside a Git repository." }
$repositoryRoot = [System.IO.Path]::GetFullPath($repositoryRoot)
$safeFiles = @($Files | ForEach-Object { Assert-SafeRelativeFile $repositoryRoot $_ })
if ($safeFiles.Count -eq 0) { throw "At least one exact hotfix file is required." }
if (@($safeFiles.RelativePath | Select-Object -Unique).Count -ne $safeFiles.Count) {
  throw "The hotfix file list contains duplicates."
}

$productionBefore = $null
if ($BaseRef) {
  $baseSha = (Invoke-External "git" @("rev-parse", "$BaseRef^{commit}") | Select-Object -Last 1).Trim()
}
else {
  $productionBefore = Get-ProductionMetadata
  $gitSource = Get-OptionalProperty $productionBefore "gitSource"
  $deploymentMeta = Get-OptionalProperty $productionBefore "meta"
  $gitSourceSha = Get-OptionalProperty $gitSource "sha"
  $hotfixBaseSha = Get-OptionalProperty $deploymentMeta "eclHotfixBaseSha"
  $metadataBaseSha = if ($gitSourceSha) {
    [string]$gitSourceSha
  }
  elseif ($hotfixBaseSha) {
    [string]$hotfixBaseSha
  }
  else { "" }
  if (-not $metadataBaseSha) {
    throw "The current production deployment does not expose a Git or isolated-hotfix base SHA. Supply -BaseRef explicitly."
  }
  $baseSha = $metadataBaseSha
  $commitExists = $true
  try {
    Invoke-External "git" @("cat-file", "-e", "$baseSha^{commit}") | Out-Null
  }
  catch {
    $commitExists = $false
  }
  if (-not $commitExists) {
    $gitSourceRef = Get-OptionalProperty $gitSource "ref"
    if ($gitSourceRef) {
      Invoke-External "git" @("fetch", "--no-tags", "origin", [string]$gitSourceRef) | Out-Null
    }
    else {
      Invoke-External "git" @("fetch", "--no-tags", "origin", $baseSha) | Out-Null
    }
    Invoke-External "git" @("cat-file", "-e", "$baseSha^{commit}") | Out-Null
  }
}

$temporaryRoot = Join-Path $repositoryRoot ".tmp"
New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
$runName = "isolated-hotfix-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$packageRoot = Join-Path $temporaryRoot $runName
$archivePath = "$packageRoot.zip"
New-Item -ItemType Directory -Path $packageRoot | Out-Null
Invoke-External "git" @("archive", "--format=zip", "--output=$archivePath", $baseSha) | Out-Null
Expand-Archive -LiteralPath $archivePath -DestinationPath $packageRoot

$overlay = @()
foreach ($file in $safeFiles) {
  $destination = Join-Path $packageRoot $file.RelativePath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  $baselineHash = if (Test-Path -LiteralPath $destination -PathType Leaf) {
    (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  else { $null }
  Copy-Item -LiteralPath $file.AbsolutePath -Destination $destination
  $overlayHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
  $overlay += [pscustomobject]@{
    path = $file.RelativePath
    changedFromBase = $baselineHash -ne $overlayHash
    sha256 = $overlayHash
  }
}

$artifactHash = Get-ArtifactHash $baseSha $safeFiles
$statePath = Join-Path $temporaryRoot "isolated-hotfix-state.json"
$plan = [ordered]@{
  mode = $Mode.ToLowerInvariant()
  baseSha = $baseSha
  artifactHash = $artifactHash
  packageRoot = $packageRoot
  files = $overlay
  productionBefore = if ($productionBefore) { [string]$productionBefore.id } else { $null }
  externalWrites = $Mode -ne "Plan"
}

if ($Mode -eq "Plan") {
  $plan | ConvertTo-Json -Depth 5
  exit 0
}

if ($Mode -eq "Preview") {
  $preview = Invoke-Deployment $packageRoot "preview" $baseSha $artifactHash
  $state = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    baseSha = $baseSha
    artifactHash = $artifactHash
    files = @($safeFiles.RelativePath | Sort-Object)
    previewDeploymentId = $preview.Id
    previewUrl = $preview.Url
    previewReadyState = $preview.ReadyState
  }
  $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8
  $plan.preview = $preview
  $plan.statePath = $statePath
  $plan | ConvertTo-Json -Depth 5
  exit 0
}

if (-not $Approved) {
  throw "Production mode requires the explicit -Approved switch."
}
if (-not $ExpectedPreviewDeployment) {
  throw "Production mode requires -ExpectedPreviewDeployment=<dpl_...>."
}
if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
  throw "No local preview state exists. Run Preview mode with this exact artifact first."
}
$previewState = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
if ($previewState.previewDeploymentId -ne $ExpectedPreviewDeployment) {
  throw "Expected preview deployment does not match the recorded preview state."
}
if ($previewState.baseSha -ne $baseSha -or $previewState.artifactHash -ne $artifactHash) {
  throw "Base commit or hotfix files changed after preview. Run Preview mode again."
}
$currentFiles = @($safeFiles.RelativePath | Sort-Object)
$recordedFiles = @($previewState.files | Sort-Object)
if (($currentFiles -join "`n") -ne ($recordedFiles -join "`n")) {
  throw "Hotfix file allowlist changed after preview. Run Preview mode again."
}
$previewMetadata = Get-DeploymentMetadata $ExpectedPreviewDeployment
if ($previewMetadata.readyState -ne "READY" -or $previewMetadata.target -eq "production") {
  throw "Expected preview deployment is not a READY non-production deployment."
}

if (-not $productionBefore) { $productionBefore = Get-ProductionMetadata }
$production = Invoke-Deployment $packageRoot "production" $baseSha $artifactHash
$plan.production = $production
$plan.rollbackDeploymentId = [string]$productionBefore.id
$plan.rollbackCommand = "vercel rollback $($productionBefore.id) --scope $Scope"
$plan | ConvertTo-Json -Depth 5
