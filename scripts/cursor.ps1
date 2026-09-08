param([int]$x, [int]$y, [switch]$click)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class CurDrv {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  public static void MoveTo(int x, int y, int steps) {
    POINT p; GetCursorPos(out p);
    for (int i = 1; i <= steps; i++) {
      double t = i / (double)steps;
      double ease = 0.5 - 0.5 * Math.Cos(t * Math.PI);
      SetCursorPos((int)Math.Round(p.X + (x - p.X) * ease), (int)Math.Round(p.Y + (y - p.Y) * ease));
      System.Threading.Thread.Sleep(14);
    }
  }
  public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
}
'@
[CurDrv]::MoveTo($x, $y, 45)
if ($click) {
  Start-Sleep -Milliseconds 250
  [CurDrv]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [CurDrv]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
}
