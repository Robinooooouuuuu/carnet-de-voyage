param([string]$out)
Add-Type -AssemblyName System.Drawing
function C($h){ [System.Drawing.ColorTranslator]::FromHtml($h) }
function Draw([int]$size, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.ScaleTransform($size/512, $size/512)
  $g.Clear((C '#f7f1e8'))
  # globe
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (C '#2E86C1')), 106, 140, 300, 300)
  $round = { param($w,$col) $p = New-Object System.Drawing.Pen (C $col), $w; $p.StartCap='Round'; $p.EndCap='Round'; $p.LineJoin='Round'; $p }
  $green = & $round 30 '#7DCEA0'
  $g.DrawBeziers($green, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(180,210), [System.Drawing.PointF]::new(220,240), [System.Drawing.PointF]::new(200,280), [System.Drawing.PointF]::new(195,300),
    [System.Drawing.PointF]::new(190,320), [System.Drawing.PointF]::new(240,340), [System.Drawing.PointF]::new(225,385)))
  $green2 = & $round 26 '#7DCEA0'
  $g.DrawBeziers($green2, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(300,190), [System.Drawing.PointF]::new(330,230), [System.Drawing.PointF]::new(290,260), [System.Drawing.PointF]::new(330,285)))
  $g.DrawEllipse((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90,255,255,255)), 4), 191, 140, 130, 300)
  $g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90,255,255,255)), 4), 106, 290, 406, 290)
  # trail
  $trail = & $round 9 '#F5B041'
  $trail.DashPattern = @(1.6, 1.8)
  $g.DrawBezier($trail, 80, 210, 150, 90, 280, 70, 350, 110)
  # plane
  $pts = @(@(0,-14),@(3,-4),@(14,2),@(14,5),@(3,2),@(2,10),@(6,13),@(6,15),@(0,13),@(-6,15),@(-6,13),@(-2,10),@(-3,2),@(-14,5),@(-14,2),@(-3,-4)) | ForEach-Object { [System.Drawing.PointF]::new($_[0], $_[1]) }
  $st = $g.Save()
  $g.TranslateTransform(395, 130); $g.RotateTransform(65); $g.ScaleTransform(5, 5)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush (C '#E74C3C')), [System.Drawing.PointF[]]$pts)
  $g.Restore($st)
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Draw 512 "$out\icone-512.png"
Draw 192 "$out\icone-192.png"
Draw 180 "$out\apple-touch-icon.png"
Draw 32 "$out\favicon-32.png"
