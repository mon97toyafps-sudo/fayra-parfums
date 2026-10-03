# Arma la imagen que se ve al compartir el link en WhatsApp, Instagram o Facebook.
# Es solo marca: el logo de Fayra y datos de la tienda que no dependen de que
# perfume se este vendiendo. Asi la tarjeta no se envejece al meter mas productos.
#
#   powershell -ExecutionPolicy Bypass -File crear-imagen-social.ps1

Add-Type -AssemblyName System.Drawing

$ancho = 1200
$alto  = 630
$fondo = [System.Drawing.Color]::FromArgb(12, 10, 8)     # #0c0a08
$oro   = [System.Drawing.Color]::FromArgb(201, 163, 92)   # #c9a35c
$marfil= [System.Drawing.Color]::FromArgb(244, 239, 230)  # #f4efe6
$apagado=[System.Drawing.Color]::FromArgb(150, 140, 124)

# "í" y "ó" por codigo, para que no se dane al guardar el .ps1
$i = [char]0x00ED
$o = [char]0x00F3
$middle = [char]0x00B7

$destino = "C:\temp-img\social.jpg"
$logo    = [System.Drawing.Image]::FromFile("C:\temp-img\logo.png")

$bmp = New-Object System.Drawing.Bitmap $ancho, $alto
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$g.Clear($fondo)

# halo dorado suave en el centro, para que el fondo no quede plano
for ($r = 520; $r -gt 0; $r -= 26) {
    $alfa = [int](3 * (1 - ($r / 520)))
    if ($alfa -lt 1) { continue }
    $pincel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alfa, 201, 163, 92))
    $g.FillEllipse($pincel, (600 - $r), (200 - $r), ($r * 2), ($r * 2))
    $pincel.Dispose()
}

# filete dorado
$oroLapiz = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 201, 163, 92), 1)
$g.DrawRectangle($oroLapiz, 24, 24, $ancho - 48, $alto - 48)
$oroLapiz.Dispose()

# ---- logo centrado ----
$anchoLogo = 430
$altoLogo  = [int]($logo.Height * ($anchoLogo / [double]$logo.Width))
$xLogo     = [int](($ancho - $anchoLogo) / 2)
$g.DrawImage($logo, $xLogo, 168, $anchoLogo, $altoLogo)

# ---- linea dorada bajo el logo ----
$yLinea = 168 + $altoLogo + 52
$linea = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, 201, 163, 92), 2)
$g.DrawLine($linea, [int](($ancho - 120) / 2), $yLinea, [int](($ancho + 120) / 2), $yLinea)
$linea.Dispose()

# ---- textos (centrados midiendo el ancho antes de dibujar) ----
$sansEy  = New-Object System.Drawing.Font("Segoe UI", 17, [System.Drawing.FontStyle]::Regular)
$sans    = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Regular)

$oroL    = New-Object System.Drawing.SolidBrush $oro
$apagadoL= New-Object System.Drawing.SolidBrush $apagado

function Centrar([string]$texto, $fuente, $pincel, [int]$y) {
    $anchoTexto = $g1.MeasureString($texto, $fuente).Width
    $x = [int](($anchoGlobal - $anchoTexto) / 2)
    $g1.DrawString($texto, $fuente, $pincel, $x, $y)
}

$g1 = $g
$anchoGlobal = $ancho

Centrar ("PERFUMER" + $i + "A " + $middle + " EL SALVADOR") $sansEy $oroL ($yLinea + 34)
Centrar ("Env" + $i + "o incluido en todo El Salvador")    $sans  $apagadoL ($yLinea + 76)

$apagadoL.Dispose(); $oroL.Dispose()
$sans.Dispose(); $sansEy.Dispose()
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
