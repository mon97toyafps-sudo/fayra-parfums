# Arma la imagen que se ve al compartir el link en WhatsApp, Instagram o Facebook.
# Es solo el logo de la F, como escudo circular sobre el fondo de la marca.
# Sin aros dorados, sin halo y sin marco: nada mas la F.
#
#   powershell -ExecutionPolicy Bypass -File crear-imagen-social.ps1

Add-Type -AssemblyName System.Drawing

$ancho = 1200
$alto  = 630
$fondo = [System.Drawing.Color]::FromArgb(12, 10, 8)     # #0c0a08

$destino = "C:\temp-img\social.jpg"
$logo    = [System.Drawing.Image]::FromFile("C:\temp-img\logo-f.png")

$bmp = New-Object System.Drawing.Bitmap $ancho, $alto
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$g.Clear($fondo)

# el logo centrado, ni un pelo mas grande que la F
$lado = 380
$x = [int](($ancho - $lado) / 2)
$y = [int](($alto  - $lado) / 2)
$g.DrawImage($logo, $x, $y, $lado, $lado)

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
