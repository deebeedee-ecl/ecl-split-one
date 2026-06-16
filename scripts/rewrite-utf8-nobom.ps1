param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$text = [System.IO.File]::ReadAllText($Path)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
