# Arma la imagen que se ve al compartir el link en WhatsApp, Instagram o Facebook.
# Es solo el logo de la F, como escudo circular sobre el fondo de la marca.
#
#   powershell -ExecutionPolicy Bypass -File crear-imagen-social.ps1

Add-Type -AssemblyName System.Drawing

$ancho = 1200
$alto  = 630
$fondo = [System.Drawing.Color]::FromArgb(12, 10, 8)     # #0c0a08
$oro   = [System.Drawing.Color]::FromArgb(201, 163, 92)   # #c9a35c

$destino = "C:\temp-img\social.jpg"
$logo    = [System.Drawing.Image]::FromFile("C:\temp-img\logo-f.png")

$bmp = New-Object System.Drawing.Bitmap $ancho, $alto
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$g.Clear($fondo)

$centroX = 600
$centroY = 315
$lado    = 300
$x = $centroX - [int]($lado / 2)
$y = $centroY - [int]($lado / 2)
$radio = [int]($lado / 2)

# halo dorado detras del escudo
for ($r = 470; $r -gt 0; $r -= 22) {
    $alfa = [int](2.4 * (1 - ($r / 470)))
    if ($alfa -lt 1) { continue }
    $pincel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alfa, 201, 163, 92))
    $g.FillEllipse($pincel, ($centroX - $r), ($centroY - $r), ($r * 2), ($r * 2))
    $pincel.Dispose()
}

# el logo recortado en circulo
$recorte = New-Object System.Drawing.Drawing2D.GraphicsPath
$recorte.AddEllipse($x, $y, $lado, $lado)
$g.SetClip($recorte)
$g.DrawImage($logo, $x, $y, $lado, $lado)
$g.ResetClip()
$recorte.Dispose()

# aro dorado alrededor del escudo
$aro = New-Object System.Drawing.Pen $oro, 2
$g.DrawEllipse($aro, ($x - 16), ($y - 16), ($lado + 32), ($lado + 32))
$aro.Dispose()

# segundo aro, mas fino y por fuera
$aro2 = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 201, 163, 92)), 1
$g.DrawEllipse($aro2, ($x - 34), ($y - 34), ($lado + 68), ($lado + 68))
$aro2.Dispose()

# filete dorado de la tarjeta
$marco = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 201, 163, 92), 1)
$g.DrawRectangle($marco, 24, 24, $ancho - 48, $alto - 48)
$marco.Dispose()

$g.Dispose(); $logo.Dispose()

# ---- guardar ----
$codigos = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()
$jpeg = $codigos | Where-Object { $_.MimeType -eq 'image/jpeg' }
$parametros = New-Object System.Drawing.Imaging.EncoderParameters 1
$parametros.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]92)
$bmp.Save($destino, $jpeg, $parametros)
$bmp.Dispose()

Write-Output ("imagen social: {0} KB" -f [Math]::Round((Get-Item $destino).Length/1KB))
Write-Output "LISTO"
