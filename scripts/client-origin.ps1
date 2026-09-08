param([int]$targetPid)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class ClientOrigin {
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
}
'@
$p = Get-Process -Id $targetPid
$pt = New-Object ClientOrigin+POINT
$pt.X = 0; $pt.Y = 0
[ClientOrigin]::ClientToScreen($p.MainWindowHandle, [ref]$pt) | Out-Null
Write-Host "$($pt.X) $($pt.Y)"
