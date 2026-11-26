[CmdletBinding()]
param(
  [string]$Project = 'ecl-split-one',
  [string]$Scope = 'deebeedee-ecls-projects',
  [Parameter(Mandatory = $true)][string]$SupabaseProjectRef,
  [string[]]$InputPath = @('.tmp/china-stats-ladder-snapshot.json'),
  [string]$ExpectedProductionSha = '',
  [switch]$ConfirmProductionWrite
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$databaseCheckPath = Join-Path $PSScriptRoot 'china-stats-ladder-production-check.sql'
$collectorSecret = $null
$collectorMayBeEnabled = $false
$enabledDeployment = $null
$sourceDeployment = $null
$finalDisabledDeployment = $null
$variableNames = @()
$validatedSnapshots = @()
$npxCommand = if (Get-Command 'npx.cmd' -ErrorAction SilentlyContinue) { 'npx.cmd' } else { 'npx' }

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][scriptblock]$Operation
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $Operation
    $commandExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($commandExitCode -ne 0) {
    throw "$Description failed with exit code $commandExitCode."
  }
  return $output
}

function New-RandomHex {
  param([Parameter(Mandatory = $true)][int]$Bytes)

  $buffer = [byte[]]::new($Bytes)
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $random.GetBytes($buffer)
  } finally {
    $random.Dispose()
  }
  return (([BitConverter]::ToString($buffer) -replace '-', '').ToLowerInvariant())
}

function ConvertFrom-BoundedJsonOutput {
  param(
    [Parameter(Mandatory = $true)][string]$Raw,
    [Parameter(Mandatory = $true)][string]$Description
  )

  $jsonStart = $Raw.IndexOf('{')
  $jsonEnd = $Raw.LastIndexOf('}')
  if ($jsonStart -lt 0 -or $jsonEnd -le $jsonStart) {
    throw "$Description returned no parseable JSON."
  }
  return ($Raw.Substring($jsonStart, $jsonEnd - $jsonStart + 1) | ConvertFrom-Json)
}

function Invoke-SupabaseReadOnlyCheck {
  $raw = Invoke-Checked -Description 'Supabase read-only ladder check' -Operation {
    & $npxCommand supabase db query `
      "--remote=$SupabaseProjectRef" `
      --read-only `
      --file $databaseCheckPath `
      --output-format json 2>&1 | Out-String
  }
  return ConvertFrom-BoundedJsonOutput -Raw ([string]$raw) -Description 'Supabase read-only ladder check'
}

function Get-SnapshotMetadata {
  param([Parameter(Mandatory = $true)]$DatabaseRow)

  $metadata = $DatabaseRow.snapshot_metadata
  if ($metadata -is [string]) {
    $metadata = $metadata | ConvertFrom-Json
  }
  return @($metadata)
}

function Assert-DatabaseInvariants {
  param([Parameter(Mandatory = $true)]$DatabaseResult)

  if (@($DatabaseResult.rows).Count -ne 1) {
    throw 'Production ladder database check returned an unexpected row count.'
  }
  $row = $DatabaseResult.rows[0]
  if ($row.correct_database -ne $true `
    -or $row.ladder_table_present -ne $true `
    -or $row.table_owner -ne 'postgres' `
    -or $row.v2_constraint_present -ne $true `
    -or [int]$row.completed_ladder_migration_count -ne 2 `
    -or [int]$row.browser_role_grant_count -ne 0 `
    -or $row.temporary_migrator_present -ne $false) {
    throw 'Production ladder database invariants are not satisfied.'
  }
  return $row
}

function Assert-InputsAreNotStale {
  param(
    [Parameter(Mandatory = $true)]$DatabaseRow,
    [Parameter(Mandatory = $true)][array]$Snapshots
  )

  $storedSnapshots = Get-SnapshotMetadata -DatabaseRow $DatabaseRow
  foreach ($snapshot in $Snapshots) {
    $stored = @($storedSnapshots | Where-Object { $_.server -eq $snapshot.Server })
    if ($stored.Count -gt 1) {
      throw "Production contains duplicate metadata for $($snapshot.Server)."
    }
    if ($stored.Count -eq 1) {
      $storedCapturedAt = [DateTimeOffset]::Parse([string]$stored[0].capturedAt)
      if ($snapshot.CapturedAt -lt $storedCapturedAt) {
        throw "The $($snapshot.Server) snapshot is older than production."
      }
    }
  }
}

function Assert-UploadedSnapshots {
  param(
    [Parameter(Mandatory = $true)]$DatabaseRow,
    [Parameter(Mandatory = $true)][array]$Snapshots
  )

  $storedSnapshots = Get-SnapshotMetadata -DatabaseRow $DatabaseRow
  foreach ($snapshot in $Snapshots) {
    $stored = @($storedSnapshots | Where-Object { $_.server -eq $snapshot.Server })
    if ($stored.Count -ne 1) {
      throw "Production did not contain exactly one $($snapshot.Server) snapshot after upload."
    }
    $storedCapturedAt = [DateTimeOffset]::Parse([string]$stored[0].capturedAt)
    if ($stored[0].platformId -ne $snapshot.Platform `
      -or [int]$stored[0].collectorVersion -ne $snapshot.SchemaVersion `
      -or [int]$stored[0].rowCount -ne 300 `
      -or $storedCapturedAt.ToUnixTimeMilliseconds() -ne $snapshot.CapturedAt.ToUnixTimeMilliseconds()) {
      throw "Production $($snapshot.Server) metadata did not match the uploaded snapshot."
    }
  }
}

function Get-ProductionVariableNames {
  $output = Invoke-Checked -Description 'Listing production environment variables' -Operation {
    & vercel env ls production --project $Project --scope $Scope --json
  }
  $payload = ($output -join [Environment]::NewLine) | ConvertFrom-Json
  return @($payload.envs | ForEach-Object { [string]$_.key })
}

function Set-ProductionVariable {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value,
    [switch]$Sensitive
  )

  $exists = $variableNames -contains $Name
  $arguments = @(
    'env', $(if ($exists) { 'update' } else { 'add' }), $Name,
    '--environment', 'production',
    '--project', $Project,
    '--scope', $Scope,
    '--yes'
  )
  if ($Sensitive) {
    $arguments += '--sensitive'
  } elseif (-not $exists) {
    $arguments += '--no-sensitive'
  }

  $null = Invoke-Checked -Description "Setting production variable $Name" -Operation {
    $Value | & vercel @arguments
  }
  if (-not $exists) {
    $script:variableNames += $Name
  }
}

function Get-LatestProductionDeployment {
  $output = Invoke-Checked -Description 'Listing production deployments' -Operation {
    & vercel ls $Project `
      --scope $Scope `
      --environment production `
      --limit 1 `
      --status READY `
      --meta "githubCommitSha=$ExpectedProductionSha" `
      --json
  }
  $deploymentList = ($output -join [Environment]::NewLine) | ConvertFrom-Json
  $deployment = $deploymentList.deployments[0]
  $url = [string]$deployment.url
  if ([string]::IsNullOrWhiteSpace($url) -or $deployment.target -ne 'production') {
    throw "No READY production deployment was found for commit $ExpectedProductionSha."
  }
  return $url.Trim()
}

function New-ProductionDeployment {
  param([Parameter(Mandatory = $true)][string]$Source)

  $null = Invoke-Checked -Description 'Production redeploy' -Operation {
    & vercel redeploy $Source --environment production --scope $Scope --json
  }
  return Get-LatestProductionDeployment
}

function Get-CollectorProbe {
  param([Parameter(Mandatory = $true)][string]$Deployment)

  $baseUrl = if ($Deployment.StartsWith('http')) { $Deployment } else { "https://$Deployment" }
  $output = Invoke-Checked -Description 'Collector disabled probe' -Operation {
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
  return (($output -join [Environment]::NewLine) | ConvertFrom-Json)
}

function Assert-CollectorDisabled {
  param([Parameter(Mandatory = $true)][string]$Deployment)

  $response = Get-CollectorProbe -Deployment $Deployment
  if ($response.ok -ne $false -or $response.code -ne 'COLLECTOR_UNAVAILABLE') {
    throw 'The production deployment did not prove that the collector is disabled.'
  }
  Write-Output 'COLLECTOR_DISABLED=true'
}

function Send-Snapshot {
  param(
    [Parameter(Mandatory = $true)][string]$Deployment,
    [Parameter(Mandatory = $true)][string]$Secret,
    [Parameter(Mandatory = $true)][string]$ResolvedPath
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
      --data-binary "@$ResolvedPath"
  }
  $response = ($output -join [Environment]::NewLine) | ConvertFrom-Json
  if ($response.ok -ne $true -or [string]::IsNullOrWhiteSpace([string]$response.status)) {
    throw 'Collector returned an invalid success response.'
  }
  Write-Host "UPLOAD_STATUS=$($response.status) SERVER=$($response.server) ROWS=$($response.rows)"
  return $response
}

try {
  if (-not $ConfirmProductionWrite) {
    throw 'Production mutation was not confirmed. Re-run with -ConfirmProductionWrite after explicit authorization.'
  }
  if ($SupabaseProjectRef -notmatch '^[a-z0-9]{20}$') {
    throw 'SupabaseProjectRef must be the exact 20-character production project ref.'
  }
  foreach ($command in @('git', 'gh', 'node', 'vercel', $npxCommand)) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
      throw "Required command is unavailable: $command"
    }
  }

  Set-Location $repositoryRoot
  $currentBranch = (& git branch --show-current).Trim()
  if ($currentBranch -notin @('main', 'master')) {
    throw 'The production smoke command must run from main or master.'
  }
  if (-not [string]::IsNullOrWhiteSpace((& git status --porcelain))) {
    throw 'The production smoke command requires a clean worktree.'
  }
  $currentSha = (& git rev-parse HEAD).Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($ExpectedProductionSha)) {
    $ExpectedProductionSha = $currentSha
  }
  $ExpectedProductionSha = $ExpectedProductionSha.Trim().ToLowerInvariant()
  if ($ExpectedProductionSha -notmatch '^[0-9a-f]{40}$' -or $ExpectedProductionSha -ne $currentSha) {
    throw 'ExpectedProductionSha must exactly match the clean main checkout HEAD.'
  }

  $requestedPaths = @($InputPath | ForEach-Object { @($_ -split ',') } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($requestedPaths.Count -lt 1 -or $requestedPaths.Count -gt 2) {
    throw 'Supply one or two sanitized snapshot files.'
  }
  $temporaryRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot '.tmp'))
  $temporaryPrefix = $temporaryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $seenServers = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)

  foreach ($requestedPath in $requestedPaths) {
    $resolvedPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $requestedPath))
    if (-not $resolvedPath.StartsWith($temporaryPrefix, [StringComparison]::OrdinalIgnoreCase) `
      -or [IO.Path]::GetExtension($resolvedPath) -ne '.json' `
      -or -not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
      throw 'Every collector input must be an existing JSON file under repository .tmp.'
    }
    $file = Get-Item -LiteralPath $resolvedPath
    if ($file.Length -lt 2 -or $file.Length -gt 2MB) {
      throw 'A collector input has an invalid size.'
    }
    $snapshotText = [IO.File]::ReadAllText($resolvedPath)
    if ($snapshotText -match '"(?:puuid|summonerId|openId|openid|credentialSource)"\s*:' `
      -or $snapshotText -match 'remoting-auth-token') {
      throw 'A collector input contains a private identifier or credential marker.'
    }
    $snapshot = $snapshotText | ConvertFrom-Json
    $expectedSource = if ($snapshot.schemaVersion -eq 1) {
      'LCU_APEX_LADDER'
    } elseif ($snapshot.schemaVersion -eq 2) {
      'WEGAME_TIER_RANK'
    } else {
      ''
    }
    $server = if ($snapshot.platform -eq 'HN1') {
      'ionia'
    } elseif ($snapshot.platform -eq 'BGP2') {
      'super-server'
    } else {
      ''
    }
    $results = @($snapshot.results)
    $tiers = @($results | ForEach-Object { [string]$_.tier })
    $counts = @($results | ForEach-Object { @($_.rows).Count })
    $capturedAt = [DateTimeOffset]::MinValue
    $hasCapturedAt = [DateTimeOffset]::TryParse([string]$snapshot.capturedAt, [ref]$capturedAt)
    $captureAge = [DateTimeOffset]::UtcNow - $capturedAt.ToUniversalTime()
    if ($snapshot.connected -ne $true `
      -or $snapshot.source -ne $expectedSource `
      -or [string]::IsNullOrWhiteSpace($server) `
      -or -not $hasCapturedAt `
      -or $results.Count -ne 3 `
      -or ($tiers -join ',') -ne 'CHALLENGER,GRANDMASTER,MASTER' `
      -or ($results | Where-Object { $_.ok -ne $true -or $_.queue -ne 'RANKED_SOLO_5x5' }).Count -ne 0 `
      -or ($counts | Where-Object { $_ -ne 100 }).Count -ne 0 `
      -or (($counts | Measure-Object -Sum).Sum) -ne 300 `
      -or $captureAge.TotalMinutes -lt -5 `
      -or $captureAge.TotalHours -gt 24) {
      throw 'A collector input is not a fresh complete sanitized apex snapshot.'
    }
    if (-not $seenServers.Add($server)) {
      throw "Multiple inputs target $server."
    }
    $validatedSnapshots += [PSCustomObject]@{
      Server = $server
      Platform = [string]$snapshot.platform
      SchemaVersion = [int]$snapshot.schemaVersion
      CapturedAt = $capturedAt
      ResolvedPath = $resolvedPath
    }
    $snapshotText = $null
  }

  $releaseOutput = Invoke-Checked -Description 'Exact release status check' -Operation {
    & node scripts/release-status.mjs --sha $ExpectedProductionSha
  }
  $releaseOutput | Out-Host

  $databaseBefore = Invoke-SupabaseReadOnlyCheck
  $databaseRowBefore = Assert-DatabaseInvariants -DatabaseResult $databaseBefore
  Assert-InputsAreNotStale -DatabaseRow $databaseRowBefore -Snapshots $validatedSnapshots

  $sourceDeployment = Get-LatestProductionDeployment
  $initialProbe = Get-CollectorProbe -Deployment $sourceDeployment
  $variableNames = Get-ProductionVariableNames
  if ($initialProbe.ok -ne $false -or $initialProbe.code -ne 'COLLECTOR_UNAVAILABLE') {
    Set-ProductionVariable -Name 'CHINA_STATS_LADDER_INGEST_ENABLED' -Value 'false'
    $sourceDeployment = New-ProductionDeployment -Source $sourceDeployment
    Assert-CollectorDisabled -Deployment $sourceDeployment
  }

  $collectorSecret = New-RandomHex -Bytes 48
  Set-ProductionVariable -Name 'CHINA_STATS_COLLECTOR_SECRET' -Value $collectorSecret -Sensitive
  Set-ProductionVariable -Name 'CHINA_STATS_LADDER_INGEST_ENABLED' -Value 'true'
  $collectorMayBeEnabled = $true

  $enabledDeployment = New-ProductionDeployment -Source $sourceDeployment
  foreach ($snapshot in $validatedSnapshots) {
    $first = Send-Snapshot -Deployment $enabledDeployment -Secret $collectorSecret -ResolvedPath $snapshot.ResolvedPath
    if ($first.status -notin @('created', 'replaced', 'duplicate') `
      -or $first.server -ne $snapshot.Server `
      -or [int]$first.rows -ne 300) {
      throw "The first $($snapshot.Server) upload returned an unexpected result."
    }
    $retry = Send-Snapshot -Deployment $enabledDeployment -Secret $collectorSecret -ResolvedPath $snapshot.ResolvedPath
    if ($retry.status -ne 'duplicate' `
      -or $retry.server -ne $snapshot.Server `
      -or [int]$retry.rows -ne 300) {
      throw "The exact $($snapshot.Server) retry was not idempotent."
    }
  }
} finally {
  $collectorSecret = $null
  if ($collectorMayBeEnabled) {
    Set-ProductionVariable -Name 'CHINA_STATS_LADDER_INGEST_ENABLED' -Value 'false'
    $rollbackSource = if ($enabledDeployment) { $enabledDeployment } else { $sourceDeployment }
    $finalDisabledDeployment = New-ProductionDeployment -Source $rollbackSource
    Assert-CollectorDisabled -Deployment $finalDisabledDeployment
    Write-Output "FINAL_DISABLED_DEPLOYMENT=$finalDisabledDeployment"
  }
  Set-Location $repositoryRoot
}

$databaseAfter = Invoke-SupabaseReadOnlyCheck
$databaseRowAfter = Assert-DatabaseInvariants -DatabaseResult $databaseAfter
Assert-UploadedSnapshots -DatabaseRow $databaseRowAfter -Snapshots $validatedSnapshots
Write-Output "CHINA_STATS_PRODUCTION_SMOKE=SUCCESS SERVERS=$(@($validatedSnapshots.Server) -join ',')"
