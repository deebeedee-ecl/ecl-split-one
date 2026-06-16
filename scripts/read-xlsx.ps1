param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryText($zip, [string]$name) {
  $entry = $zip.GetEntry($name)
  if (-not $entry) {
    return $null
  }

  $stream = $entry.Open()
  try {
    $reader = [System.IO.StreamReader]::new($stream)
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-CellColumn([string]$ref) {
  return ($ref -replace '\d', '')
}

function Get-ColumnIndex([string]$column) {
  $index = 0
  foreach ($char in $column.ToUpperInvariant().ToCharArray()) {
    $index = ($index * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $index - 1
}

function Get-CellValue($cell, $sharedStrings) {
  $type = [string]$cell.t

  if ($type -eq "s") {
    $idx = [int]$cell.v
    return $sharedStrings[$idx]
  }

  if ($type -eq "inlineStr") {
    return [string]$cell.is.t
  }

  return [string]$cell.v
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($Path)

try {
  [xml]$sharedXml = Read-ZipEntryText $zip "xl/sharedStrings.xml"
  $sharedStrings = @()
  foreach ($si in $sharedXml.sst.si) {
    if ($si.t) {
      $sharedStrings += [string]$si.t
    } else {
      $sharedStrings += (($si.r | ForEach-Object { [string]$_.t }) -join "")
    }
  }

  [xml]$workbookXml = Read-ZipEntryText $zip "xl/workbook.xml"
  [xml]$relsXml = Read-ZipEntryText $zip "xl/_rels/workbook.xml.rels"
  $rels = @{}
  foreach ($rel in $relsXml.Relationships.Relationship) {
    $rels[[string]$rel.Id] = "xl/$($rel.Target)"
  }

  $result = @()
  foreach ($sheet in $workbookXml.workbook.sheets.sheet) {
    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $sheetPath = $rels[$rid]
    [xml]$sheetXml = Read-ZipEntryText $zip $sheetPath

    $rows = @()
    foreach ($row in $sheetXml.worksheet.sheetData.row) {
      $values = @{}
      foreach ($cell in $row.c) {
        $col = Get-CellColumn ([string]$cell.r)
        $values[$col] = Get-CellValue $cell $sharedStrings
      }

      $maxIndex = -1
      foreach ($key in $values.Keys) {
        $maxIndex = [Math]::Max($maxIndex, (Get-ColumnIndex $key))
      }

      $ordered = New-Object System.Collections.Generic.List[string]
      for ($i = 0; $i -le $maxIndex; $i++) {
        $col = ""
        $n = $i + 1
        while ($n -gt 0) {
          $rem = ($n - 1) % 26
          $col = [string]([char]([int]([int][char]'A' + $rem))) + $col
          $n = [Math]::Floor(($n - 1) / 26)
        }
        $ordered.Add([string]($values[$col]))
      }

      $rows += ,$ordered.ToArray()
    }

    $result += [pscustomobject]@{
      name = [string]$sheet.name
      path = $sheetPath
      rows = $rows
    }
  }

  $result | ConvertTo-Json -Depth 8
} finally {
  $zip.Dispose()
}
