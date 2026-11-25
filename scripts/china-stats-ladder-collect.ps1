$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDirectory = Join-Path $repositoryRoot '.tmp'
$outputPath = Join-Path $outputDirectory 'china-stats-ladder-snapshot.json'
$nodeCollector = Join-Path $PSScriptRoot 'china-stats-ladder-collect.cjs'

try {
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'LeagueClientUx.exe' OR Name = 'LeagueClient.exe'")
  $candidates = @()
  foreach ($process in $processes) {
    $commandLine = [string]$process.CommandLine
    $portMatch = [regex]::Match($commandLine, '--app-port=(\d+)')
    $tokenMatch = [regex]::Match($commandLine, '--remoting-auth-token=([^"\s]+)')
    if ($portMatch.Success -and $tokenMatch.Success) {
      $candidates += [PSCustomObject]@{
        Port = [int]$portMatch.Groups[1].Value
        Token = $tokenMatch.Groups[1].Value
      }
    }
  }
  if ($candidates.Count -eq 0) {
    throw 'No League client connection was available. Run this command in an Administrator PowerShell while the China client is open.'
  }

  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  foreach ($candidate in $candidates) {
    try {
      $env:ECL_CHINA_STATS_LCU_PORT = [string]$candidate.Port
      $env:ECL_CHINA_STATS_LCU_TOKEN = $candidate.Token
      $env:ECL_CHINA_STATS_SNAPSHOT_PATH = $outputPath
      & node $nodeCollector
      if ($LASTEXITCODE -eq 0) {
        Write-Output "Sanitized ladder snapshot: $outputPath"
        exit 0
      }
    } finally {
      Remove-Item Env:ECL_CHINA_STATS_LCU_PORT -ErrorAction SilentlyContinue
      Remove-Item Env:ECL_CHINA_STATS_LCU_TOKEN -ErrorAction SilentlyContinue
      Remove-Item Env:ECL_CHINA_STATS_SNAPSHOT_PATH -ErrorAction SilentlyContinue
    }
  }
  throw 'No detected League client connection returned a valid ladder snapshot.'
} catch {
  Write-Error ([string]$_.Exception.Message)
  exit 1
}
