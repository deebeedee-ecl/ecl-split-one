[CmdletBinding()]
param(
  [string]$Project = 'ecl-split-one',
  [string]$Scope = 'deebeedee-ecls-projects',
  [string]$Branch = '',
  [string]$InputPath = '.tmp/china-stats-ladder-snapshot.json',
  [switch]$ConfirmPreviewWrite
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$collectorWasEnabled = $false
$enabledDeployment = $null
$sourceDeployment = $null
$collectorSecret = $null

function New-RandomHex {
  param([Parameter(Mandatory = $true)][int]$Bytes)

  $buffer = [byte[]]::new($Bytes)
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $random.GetBytes($buffer)
  } finally {
    $random.Dispose()
  }
  return (([BitConverter]::ToString($buffer) -replace '-', '').ToLowerInvariant())
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][scriptblock]$Operation
  )

  $output = & $Operation
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
  return $output
}

function Update-BranchVariable {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value,
    [switch]$Sensitive
  )

  $arguments = @(
    'env', 'update', $Name,
    '--environment', 'preview',
    '--git-branch', $Branch,
    '--project', $Project,
    '--scope', $Scope,
    '--yes'
  )
  if ($Sensitive) {
    $arguments += '--sensitive'
  }

  $Value | & vercel @arguments | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Updating preview variable $Name failed."
  }
}

function Get-LatestCommitDeployment {
  $output = Invoke-Checked -Description 'Listing preview deployments' -Operation {
    & vercel ls $Project `
      --scope $Scope `
      --limit 1 `
      --status READY `
      --meta "githubCommitSha=$script:commitSha" `
      --meta "githubCommitRef=$Branch" `
      --json
  }
  $deploymentList = ($output -join [Environment]::NewLine) | ConvertFrom-Json
  $url = [string]$deploymentList.deployments[0].url
  if ([string]::IsNullOrWhiteSpace($url)) {
    throw "No READY preview deployment was found for commit $script:commitSha."
  }
  return $url.Trim()
}

function New-PreviewDeployment {
  param([Parameter(Mandatory = $true)][string]$Source)

  Invoke-Checked -Description 'Preview redeploy' -Operation {
    & vercel redeploy $Source --environment preview --scope $Scope --json
  } | Out-Null
  return Get-LatestCommitDeployment
}

function Send-Snapshot {
  param(
    [Parameter(Mandatory = $true)][string]$Deployment,
    [Parameter(Mandatory = $true)][string]$Secret
  )

  $baseUrl = if ($Deployment.StartsWith('http')) { $Deployment } else { "https://$Deployment" }
  $output = Invoke-Checked -Description 'Collector upload' -Operation {
    & vercel curl /api/jobs/china-stats-ladder `
      --deployment $baseUrl `
      --scope $Scope `
      -- `
      --silent `
      --show-error `
      --fail-with-body `
      --request POST `
      --header 'Content-Type: application/json' `
      --header "x-ecl-china-stats-secret: $Secret" `
      --data-binary "@$script:resolvedInputPath"
  }
  $response = ($output -join [Environment]::NewLine) | ConvertFrom-Json
  if ($response.ok -ne $true -or [string]::IsNullOrWhiteSpace([string]$response.status)) {
    throw 'Collector returned an invalid success response.'
  }
  Write-Host "UPLOAD_STATUS=$($response.status) SERVER=$($response.server) ROWS=$($response.rows)"
  return $response
}

function Assert-CollectorDisabled {
  param([Parameter(Mandatory = $true)][string]$Deployment)

  $baseUrl = if ($Deployment.StartsWith('http')) { $Deployment } else { "https://$Deployment" }
  $output = Invoke-Checked -Description 'Collector rollback probe' -Operation {
    & vercel curl /api/jobs/china-stats-ladder `
      --deployment $baseUrl `
      --scope $Scope `
      -- `
      --silent `
      --show-error `
      --request POST `
      --header 'Content-Type: application/json' `
      --data '{}'
  }
  $response = ($output -join [Environment]::NewLine) | ConvertFrom-Json
  if ($response.ok -ne $false -or $response.code -ne 'COLLECTOR_UNAVAILABLE') {
    throw 'The final preview deployment did not prove that the collector is disabled.'
  }
  Write-Output 'COLLECTOR_DISABLED=true'
}

try {
  if (-not $ConfirmPreviewWrite) {
    throw 'Preview mutation was not confirmed. Re-run with -ConfirmPreviewWrite after explicit authorization.'
  }
  foreach ($command in @('git', 'vercel', 'node')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
      throw "Required command is unavailable: $command"
    }
  }

  Set-Location $repositoryRoot
  $currentBranch = (& git branch --show-current).Trim()
  if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = $currentBranch
  }
  if ([string]::IsNullOrWhiteSpace($Branch) -or $Branch -in @('main', 'master')) {
    throw 'The preview smoke command must run from an explicit non-production branch.'
  }
  if ($Branch -ne $currentBranch) {
    throw "The requested preview branch does not match the current Git branch: $currentBranch"
  }
  if (-not [string]::IsNullOrWhiteSpace((& git status --porcelain))) {
    throw 'The worktree must be clean so the preview deployment matches the tested commit.'
  }

  $script:commitSha = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $script:commitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'The current Git commit could not be resolved.'
  }

  $temporaryRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot '.tmp'))
  $script:resolvedInputPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $InputPath))
  $temporaryPrefix = $temporaryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $script:resolvedInputPath.StartsWith($temporaryPrefix, [StringComparison]::OrdinalIgnoreCase) `
    -or [IO.Path]::GetExtension($script:resolvedInputPath) -ne '.json' `
    -or -not (Test-Path -LiteralPath $script:resolvedInputPath -PathType Leaf)) {
    throw 'The collector input must be an existing JSON file under the repository .tmp directory.'
  }
  $snapshotText = [IO.File]::ReadAllText($script:resolvedInputPath)
  if ($snapshotText -match '"(?:puuid|summonerId|openId|openid|credentialSource)"\s*:' `
    -or $snapshotText -match 'remoting-auth-token') {
    throw 'The collector input contains a private identifier or credential marker.'
  }
  $snapshot = $snapshotText | ConvertFrom-Json
  $expectedSource = if ($snapshot.schemaVersion -eq 1) {
    'LCU_APEX_LADDER'
  } elseif ($snapshot.schemaVersion -eq 2) {
    'WEGAME_TIER_RANK'
  } else {
    ''
  }
  $resultRows = @($snapshot.results | ForEach-Object { @($_.rows) })
  if ($snapshot.connected -ne $true `
    -or $snapshot.source -ne $expectedSource `
    -or $snapshot.platform -notin @('HN1', 'BGP2') `
    -or -not $snapshot.capturedAt `
    -or @($snapshot.results).Count -ne 3 `
    -or $resultRows.Count -eq 0) {
    throw 'The collector input does not contain a complete sanitized snapshot.'
  }
  $snapshotText = $null

  $sourceDeployment = Get-LatestCommitDeployment
  $collectorSecret = New-RandomHex -Bytes 48
  Update-BranchVariable -Name 'CHINA_STATS_COLLECTOR_SECRET' -Value $collectorSecret -Sensitive
  Update-BranchVariable -Name 'CHINA_STATS_LADDER_INGEST_ENABLED' -Value 'true'
  $collectorWasEnabled = $true

  $enabledDeployment = New-PreviewDeployment -Source $sourceDeployment
  $first = Send-Snapshot -Deployment $enabledDeployment -Secret $collectorSecret
  if ($first.status -notin @('created', 'replaced', 'duplicate')) {
    throw "The first upload returned an unexpected status: $($first.status)"
  }
  $retry = Send-Snapshot -Deployment $enabledDeployment -Secret $collectorSecret
  if ($retry.status -ne 'duplicate') {
    throw "The exact retry was not idempotent: $($retry.status)"
  }
} finally {
  $collectorSecret = $null
  if ($collectorWasEnabled) {
    Update-BranchVariable -Name 'CHINA_STATS_LADDER_INGEST_ENABLED' -Value 'false'
    $rollbackSource = if ($enabledDeployment) { $enabledDeployment } else { $sourceDeployment }
    $disabledDeployment = New-PreviewDeployment -Source $rollbackSource
    Assert-CollectorDisabled -Deployment $disabledDeployment
    Write-Output "FINAL_DISABLED_DEPLOYMENT=$disabledDeployment"
  }
  Set-Location $repositoryRoot
}
