# Arma la imagen que se ve al compartir el link en WhatsApp, Instagram o Facebook.
# Muestra el logo de Fayra junto con el perfume, el nombre y el precio.
#
#   powershell -ExecutionPolicy Bypass -File crear-imagen-social.ps1
#
# Los textos se arman con codigos de caracter para que el acento de "í"
# no se rompa al leer el archivo.

Add-Type -AssemblyName System.Drawing

$ancho = 1200
$alto  = 630
$fondo = [System.Drawing.Color]::FromArgb(12, 10, 8)     # #0c0a08
$oro   = [System.Drawing.Color]::FromArgb(201, 163, 92)   # #c9a35c
$marfil= [System.Drawing.Color]::FromArgb(244, 239, 230)  # #f4efe6
$apagado=[System.Drawing.Color]::FromArgb(168, 156, 138)  # #a89c8a

# "í" sin escribirlo directo, para que no se dane al guardar el .ps1
$i = [char]0x00ED
$middle = [char]0x00B7   # punto medio

$destino = "C:\temp-img\social.jpg"
$foto    = [System.Drawing.Image]::FromFile("C:\temp-img\producto.jpg")
$logo    = [System.Drawing.Image]::FromFile("C:\temp-img\logo.png")

$bmp = New-Object System.Drawing.Bitmap $ancho, $alto
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# fondo oscuro
$g.Clear($fondo)

# la foto del perfume, recortada para cubrir todo el lienzo
$escala = [Math]::Max($ancho / $foto.Width, $alto / $foto.Height)
$fw = [int]($foto.Width * $escala)
$fh = [int]($foto.Height * $escala)
$g.DrawImage($foto, [int](($ancho - $fw) / 2), [int](($alto - $fh) / 2), $fw, $fh)

# velo oscuro para que se lea el texto
$velo = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205, 12, 10, 8))
$g.FillRectangle($velo, 0, 0, $ancho, $alto)
$velo.Dispose()

# degradado: oscuro a la izquierda, transparente a la derecha
$degradado = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point 0, 0),
    (New-Object System.Drawing.Point 980, 0),
    [System.Drawing.Color]::FromArgb(255, 12, 10, 8),
    [System.Drawing.Color]::FromArgb(0, 12, 10, 8))
$g.FillRectangle($degradado, 0, 0, $ancho, $alto)
$degradado.Dispose()

# filete dorado
$oroLapiz = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 201, 163, 92), 1)
$g.DrawRectangle($oroLapiz, 26, 26, $ancho - 52, $alto - 52)
$oroLapiz.Dispose()

# logo de Fayra
$anchoLogo = 300
$altoLogo  = [int]($logo.Height * ($anchoLogo / [double]$logo.Width))
$g.DrawImage($logo, 78, 78, $anchoLogo, $altoLogo)

# tipografias
$serif  = New-Object System.Drawing.Font("Georgia", 21, [System.Drawing.FontStyle]::Regular)
$sansEy = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Regular)
$sans   = New-Object System.Drawing.Font("Segoe UI", 17, [System.Drawing.FontStyle]::Regular)
$precio = New-Object System.Drawing.Font("Georgia", 30, [System.Drawing.FontStyle]::Regular)

$oroLapiz2 = New-Object System.Drawing.SolidBrush $oro
$marfilL   = New-Object System.Drawing.SolidBrush $marfil
$apagadoL  = New-Object System.Drawing.SolidBrush $apagado

$g.DrawString("PERFUMER" + $i + "A " + $middle + " EL SALVADOR", $sansEy, $oroLapiz2, 80, 196)
$g.DrawString("Odyssey Aqua", $serif, $marfilL, 78, 240)
$g.DrawString("Armaf " + $middle + " 100 ml EDP", $sans, $apagadoL, 80, 296)

# precio y envio
$g.DrawString('$64.99', $precio, $oroLapiz2, 78, 356)
$g.DrawString("Env" + $i + "o incluido en todo El Salvador", $sans, $apagadoL, 80, 412)

# linea dorada bajo el precio
$linea = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 201, 163, 92), 2)
$g.DrawLine($linea, 80, 400, 210, 400)
$linea.Dispose()

# ---- guardar ----
$codigos = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()
$jpeg = $codigos | Where-Object { $_.MimeType -eq 'image/jpeg' }
$parametros = New-Object System.Drawing.Imaging.EncoderParameters 1
$parametros.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]90)
$bmp.Save($destino, $jpeg, $parametros)

$linea.Dispose(); $apagadoL.Dispose(); $marfilL.Dispose(); $oroLapiz2.Dispose()
$precio.Dispose(); $sans.Dispose(); $sansEy.Dispose(); $serif.Dispose()
$g.Dispose(); $bmp.Dispose(); $foto.Dispose(); $logo.Dispose()

Write-Output ("imagen social: {0} KB" -f [Math]::Round((Get-Item $destino).Length/1KB))
Write-Output "LISTO"
