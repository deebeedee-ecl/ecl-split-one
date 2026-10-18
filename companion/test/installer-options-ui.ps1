param(
  [Parameter(Mandatory = $true)][string]$FixtureDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public static class EclInstallerWindowProbe {
  public delegate bool Visit(IntPtr hwnd, IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumWindows(Visit callback, IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, Visit callback, IntPtr data);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr hwnd, int id);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect bounds);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  public static IntPtr WindowFor(uint wanted) {
    IntPtr result = IntPtr.Zero;
    EnumWindows((hwnd, data) => { uint pid; GetWindowThreadProcessId(hwnd, out pid); if(pid == wanted && Text(hwnd).StartsWith("ECL permissions test")) {result=hwnd; return false;} return true; }, IntPtr.Zero);
    return result;
  }
  public static IntPtr[] Children(IntPtr parent) {
    var handles = new List<IntPtr>();
    EnumChildWindows(parent, (hwnd, data) => {handles.Add(hwnd); return true;}, IntPtr.Zero);
    return handles.ToArray();
  }
  public static string Text(IntPtr hwnd) { var text = new StringBuilder(4096); GetWindowText(hwnd,text,text.Capacity); return text.ToString(); }
}
'@

$fixtureRoot = [IO.Path]::GetFullPath($FixtureDirectory)
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.test-data\installer-options-'))
if (-not $fixtureRoot.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Only an isolated installer fixture may be opened.' }
$fixtureExe = Join-Path $fixtureRoot 'fixture.exe'
$results = @()
foreach ($fixtureLanguage in @(1033, 2052)) {
  $fixtureProcess = Start-Process -FilePath $fixtureExe -ArgumentList "/language=$fixtureLanguage" -WindowStyle Hidden -PassThru
  try {
    $dialogHandle = [IntPtr]::Zero
    for ($attempt = 0; $attempt -lt 60 -and $dialogHandle -eq [IntPtr]::Zero; $attempt++) {
      Start-Sleep -Milliseconds 100
      $dialogHandle = [EclInstallerWindowProbe]::WindowFor($fixtureProcess.Id)
    }
    if ($dialogHandle -eq [IntPtr]::Zero) { throw 'Fixture dialog did not appear.' }
    $nextButton = [EclInstallerWindowProbe]::GetDlgItem($dialogHandle, 1)
    [void][EclInstallerWindowProbe]::PostMessage($dialogHandle, 0x111, [IntPtr]1, $nextButton)
    $checkboxHandle = [IntPtr]::Zero
    for ($attempt = 0; $attempt -lt 60 -and $checkboxHandle -eq [IntPtr]::Zero; $attempt++) {
      Start-Sleep -Milliseconds 100
      foreach ($control in [EclInstallerWindowProbe]::Children($dialogHandle)) {
        $controlText = [EclInstallerWindowProbe]::Text($control)
        if ($controlText -eq 'Run ECL Hub as administrator when it starts' -or $controlText -eq '启动 ECL Hub 时以管理员身份运行') { $checkboxHandle = $control; break }
      }
    }
    if ($checkboxHandle -eq [IntPtr]::Zero) { throw 'Administrator option was not present on the native page.' }
    if ([EclInstallerWindowProbe]::SendMessage($checkboxHandle, 0xF0, [IntPtr]::Zero, [IntPtr]::Zero).ToInt32() -ne 1) { throw 'Interactive default should be checked.' }
    [void][EclInstallerWindowProbe]::SendMessage($checkboxHandle, 0xF1, [IntPtr]::Zero, [IntPtr]::Zero)
    if ([EclInstallerWindowProbe]::SendMessage($checkboxHandle, 0xF0, [IntPtr]::Zero, [IntPtr]::Zero).ToInt32() -ne 0) { throw 'Checkbox could not be unchecked.' }
    [void][EclInstallerWindowProbe]::SendMessage($checkboxHandle, 0xF1, [IntPtr]1, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 300
    $bounds = New-Object EclInstallerWindowProbe+Rect
    [void][EclInstallerWindowProbe]::GetWindowRect($dialogHandle, [ref]$bounds)
    $bitmap = New-Object Drawing.Bitmap(($bounds.Right - $bounds.Left), ($bounds.Bottom - $bounds.Top))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $dc = $graphics.GetHdc()
    try { [void][EclInstallerWindowProbe]::SendMessage($dialogHandle, 0x317, $dc, [IntPtr]30) }
    finally { $graphics.ReleaseHdc($dc) }
    $imagePath = Join-Path $fixtureRoot "options-$fixtureLanguage.png"
    # Hidden windows can decline painting; do not label a blank bitmap a visual pass.
    $hasPaint = $false
    for ($pixelY = 0; $pixelY -lt $bitmap.Height -and -not $hasPaint; $pixelY += 12) {
      for ($pixelX = 0; $pixelX -lt $bitmap.Width; $pixelX += 12) {
        if ($bitmap.GetPixel($pixelX, $pixelY).ToArgb() -ne [Drawing.Color]::Black.ToArgb()) { $hasPaint = $true; break }
      }
    }
    if ($hasPaint) { $bitmap.Save($imagePath, [Drawing.Imaging.ImageFormat]::Png) }
    $graphics.Dispose()
    $bitmap.Dispose()
    $results += [PSCustomObject]@{Language=$fixtureLanguage;DefaultChecked=$true;CanUncheck=$true;Screenshot=$(if ($hasPaint) { $imagePath } else { $null })}
  } finally {
    # Only the process returned by Start-Process for this known test executable.
    if (-not $fixtureProcess.HasExited) { Stop-Process -Id $fixtureProcess.Id -Force }
  }
}
$results | ConvertTo-Json -Compress
