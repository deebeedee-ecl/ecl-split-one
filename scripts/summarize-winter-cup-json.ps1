param(
  [string]$Path = "scripts/winter-cup-xlsx-debug.json",
  [int]$Limit = 80
)

$data = Get-Content $Path -Raw | ConvertFrom-Json

foreach ($sheet in $data) {
  Write-Output "$($sheet.name): $($sheet.rows.Count) rows"

  for ($i = 0; $i -lt [Math]::Min($Limit, $sheet.rows.Count); $i++) {
    $vals = @($sheet.rows[$i]) | Where-Object { $_ -ne "" }

    if ($vals.Count -gt 0) {
      Write-Output (("{0:D3}: " -f $i) + ($vals -join " | "))
    }
  }
}
