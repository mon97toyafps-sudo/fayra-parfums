# Convierte las imagenes que se pegan en el chat a JPEG liviano.
# Uso:  powershell -File convertir-imagenes.ps1
# Lee dos originales de C:\temp-img y escribe en assets\img\.

Add-Type -AssemblyName System.Drawing

function Convertir-Imagen {
    param([string]$Entrada, [string]$Salida, [int]$LadoMaximo)

    $src = [System.Drawing.Image]::FromFile($Entrada)

    # no agrandamos: si la imagen ya es chica, se respeta su tamaño
    $ancho  = $src.Width
    $alto   = $src.Height
    $escala = [Math]::Min(1.0, $LadoMaximo / [double][Math]::Max($ancho, $alto))
    $nuevoAncho  = [int]($ancho  * $escala)
    $nuevoAlto   = [int]($alto   * $escala)

    $bmp = New-Object System.Drawing.Bitmap $nuevoAncho, $nuevoAlto
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.SmoothingMode     = 'HighQuality'
    $g.PixelOffsetMode   = 'HighQuality'
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($src, 0, 0, $nuevoAncho, $nuevoAlto)
    $g.Dispose()

    $bmp.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bytes = (Get-Item $Salida).Length
    $bmp.Dispose()
    $src.Dispose()

    Write-Output ("{0}: {1}x{2}  {3} KB  (era {4} KB)" -f `
        (Split-Path $Salida -Leaf), $nuevoAncho, $nuevoAlto,
        [Math]::Round($bytes/1KB), [Math]::Round((Get-Item $Entrada).Length/1KB))
}

Convertir-Imagen -Entrada "C:\temp-img\ficha2.png"   -Salida "C:\temp-img\odyssey-ficha.jpg" -LadoMaximo 1000
Convertir-Imagen -Entrada "C:\temp-img\ingredientes.png" -Salida "C:\temp-img\odyssey-ingredientes.jpg" -LadoMaximo 900
Write-Output "LISTO"
