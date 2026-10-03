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

# La foto se pone solo en la mitad derecha, con esquinas redondeadas,
# para que el logo y el texto queden sobre el fondo limpio y no se mezclen.
$ladoFoto   = 420
$marco      = 3
$margen     = 66
$xFoto      = $ancho - $margen - $ladoFoto - $marco
$yFoto      = [int](($alto - $ladoFoto) / 2)

$escala = [Math]::Max($ladoFoto / $foto.Width, $ladoFoto / $foto.Height)
$fw = [int]($foto.Width * $escala)
$fh = [int]($foto.Height * $escala)

# sombra suave detras de la foto
$sombra = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
$g.FillEllipse($sombra, $xFoto - 10, $yFoto + $ladoFoto - 6, $ladoFoto + 20, 26)
$sombra.Dispose()

# borde dorado de la foto
$marcoLapiz = New-Object System.Drawing.Pen $oro, $marco
$g.DrawRectangle($marcoLapiz, $xFoto, $yFoto, $ladoFoto, $ladoFoto)
$marcoLapiz.Dispose()

$clip = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 18
$clip.AddArc($xFoto, $yFoto, $r, $r, 180, 90)
$clip.AddArc($xFoto + $ladoFoto - $r, $yFoto, $r, $r, 270, 90)
$clip.AddArc($xFoto + $ladoFoto - $r, $yFoto + $ladoFoto - $r, $r, $r, 0, 90)
$clip.AddArc($xFoto, $yFoto + $ladoFoto - $r, $r, $r, 90, 90)
$clip.CloseFigure()
$g.SetClip($clip)
$g.DrawImage($foto, $xFoto + [int](($ladoFoto - $fw) / 2), $yFoto + [int](($ladoFoto - $fh) / 2), $fw, $fh)
$g.ResetClip()
$clip.Dispose()

# filete dorado alrededor de toda la tarjeta
$oroLapiz = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 201, 163, 92), 1)
$g.DrawRectangle($oroLapiz, 24, 24, $ancho - 48, $alto - 48)
$oroLapiz.Dispose()

# logo de Fayra
$anchoLogo = 264
$altoLogo  = [int]($logo.Height * ($anchoLogo / [double]$logo.Width))
$g.DrawImage($logo, 76, 74, $anchoLogo, $altoLogo)

# tipografias
$serif  = New-Object System.Drawing.Font("Georgia", 25, [System.Drawing.FontStyle]::Regular)
$sansEy = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Regular)
$sans   = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Regular)
$precio = New-Object System.Drawing.Font("Georgia", 40, [System.Drawing.FontStyle]::Regular)

$oroLapiz2 = New-Object System.Drawing.SolidBrush $oro
$marfilL   = New-Object System.Drawing.SolidBrush $marfil
$apagadoL  = New-Object System.Drawing.SolidBrush $apagado

$g.DrawString("PERFUMER" + $i + "A " + $middle + " EL SALVADOR", $sansEy, $oroLapiz2, 78, 236)
$g.DrawString("Odyssey Aqua", $serif, $marfilL, 76, 274)
$g.DrawString("Armaf " + $middle + " 100 ml EDP", $sans, $apagadoL, 78, 322)

# linea dorada antes del precio
$linea = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 201, 163, 92), 2)
$g.DrawLine($linea, 78, 372, 168, 372)
$linea.Dispose()

$g.DrawString('$64.99', $precio, $oroLapiz2, 76, 388)
$g.DrawString("Env" + $i + "o incluido en todo El Salvador", $sans, $apagadoL, 78, 460)

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
