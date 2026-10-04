#!/usr/bin/perl
# Convierte el mapa real de los 14 departamentos de El Salvador (geoBoundaries,
# geometria simplificada) en trazados SVG listos para la pagina "Como pedir".
#
#   perl tools/mapa-el-salvador.pl es.geojson assets/js/mapa-es.js
#
# Entrada : es.geojson (FeatureCollection con los 14 departamentos)
# Salida  : assets/js/mapa-es.js  ->  window.MAPA_ES = { viewBox, departamentos[] }
#
# El mapa es equirectangular. Para El Salvador eso casi no deforma: mide 2.45
# grados de este a oeste y 1.29 de norte a sur, y la correccion por latitud
# (1 grado de longitud es un 2% mas corto que uno de latitud a esta altura)
# deja el margen dentro del ruido del propio desenho.

use strict;
use warnings;

my ($entrada, $salida) = @ARGV;
die "uso: perl tools/mapa-el-salvador.pl entrada.geojson salida.js\n" unless $salida;

open my $fh, '<', $entrada or die "no abro $entrada: $!\n";
local $/;
my $geo = <$fh>;
close $fh;

# ------------------------------------------------------------ projecting ---
my @todo = ($geo =~ /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g);
my ($lons, $lats) = @todo;
die "no encontre coordenadas\n" unless @todo;

my ($xmin, $xmax, $ymin, $ymax) = ($lons, $lons, $lats, $lats);
for (my $i = 0; $i < @todo; $i += 2) {
  my ($lon, $lat) = ($todo[$i], $todo[$i + 1]);
  $xmin = $lon if $lon < $xmin;
  $xmax = $lon if $lon > $xmax;
  $ymin = $lat if $lat < $ymin;
  $ymax = $lat if $lat > $ymax;
}

my $ANCHO = 480;                      # ancho fijo del lienzo en unidades SVG
my $escala = $ANCHO / ($xmax - $xmin);
my $ALTO = sprintf("%.0f", ($ymax - $ymin) * $escala + 4);

# margen para que el contorno no quede pegado al borde
my $mx = ($ANCHO - ($xmax - $xmin) * $escala) / 2;
my $my = ($ALTO - ($ymax - $ymin) * $escala) / 2;

sub px { sprintf("%.1f", $mx + ($_[0] - $xmin) * $escala) }
sub py { sprintf("%.1f", $my + ($ymax - $_[0]) * $escala) }   # norte arriba

# --------------------------------------------------------------- features ---
# Cada departamento es un bloque que empieza con su shapeName.
my @bloques = split /"shapeName"\s*:\s*"/, $geo;
shift @bloques;                       # la cabecera no es un departamento

my @salida;
for my $bloque (@bloques) {
  my ($nombre) = $bloque =~ /^([^"]+)"/;
  next unless defined $nombre;

  # anillos: [ [lon, lat], [lon, lat], ... ]
  my @anillos;
  while ($bloque =~ /\[((?:\s*\[\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*\]\s*,?)+)\]/g) {
    my $cuerpo = $1;
    my @pares = ($cuerpo =~ /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g);
    next unless @pares >= 3;
    my @pts;
    for (my $i = 0; $i < @pares; $i += 2) {
      my ($x, $y) = (px($pares[$i]), py($pares[$i + 1]));
      push @pts, "$x $y" unless @pts && $pts[-1] eq "$x $y";   # sin repetidos
    }
    next unless @pts >= 3;
    push @anillos, join(" ", @pts);
  }
  next unless @anillos;

  my $d = join("", map { "M $_ Z " } @anillos);

  # punto medio del departamento, para colocar el nombre.
  # Cada anillo es "x y x y x y..."; se recorre de dos en dos.
  my ($sx, $sy, $n) = (0, 0, 0);
  for my $a (@anillos) {
    my @c = split / /, $a;
    for (my $k = 0; $k + 1 < @c; $k += 2) {
      $sx += $c[$k]; $sy += $c[$k + 1]; $n++;
    }
  }
  $n or next;

  # Los nombres vienen en UTF-8 (Cuscatlán). Para el id se transliteran los
  # acentos a sus letras ASCII antes de limpiar; si no, cada tilde acentuada
  # se convierte en dos guiones y el id queda como "caba-as".
  my $id = $nombre;
  $id =~ s/\xC3\xA1/a/g;   $id =~ s/\xC3\xA9/e/g;   $id =~ s/\xC3\xAD/i/g;
  $id =~ s/\xC3\xB3/o/g;   $id =~ s/\xC3\xBA/u/g;   $id =~ s/\xC3\xB1/n/g;
  $id =~ s/\xC3\x81/a/g;   $id =~ s/\xC3\x89/e/g;   $id =~ s/\xC3\x8D/i/g;
  $id =~ s/\xC3\x93/o/g;   $id =~ s/\xC3\x9A/u/g;   $id =~ s/\xC3\x91/n/g;
  $id = lc $id;
  $id =~ s/^departamento de //;
  $id =~ s/[^a-z0-9]+/-/g;
  $id =~ s/^-|-$//g;

  my $bonito = $nombre;
  $bonito =~ s/^Departamento de //;

  push @salida, {
    id     => $id,
    nombre => $bonito,
    d      => $d,
    cx     => sprintf("%.1f", $sx / $n),
    cy     => sprintf("%.1f", $sy / $n),
  };
}

die "no salio ningun departamento\n" unless @salida;

# ----------------------------------------------------------------- salida ---
open my $out, '>', $salida or die "no escribo $salida: $!\n";
print $out "/* Generado por tools/mapa-el-salvador.pl -- no editar a mano.\n";
print $out "   Fuente: geoBoundaries gbOpen SLV/ADM1 (simplificada). */\n";
print $out "window.MAPA_ES = {\n";
print $out "  viewBox: \"0 0 $ANCHO $ALTO\",\n";
print $out "  departamentos: [\n";
for my $i (0 .. $#salida) {
  my $d = $salida[$i];
  printf $out "    { id: \"%s\", nombre: \"%s\", cx: %s, cy: %s, d: \"%s\" }%s\n",
    $d->{id}, $d->{nombre}, $d->{cx}, $d->{cy}, $d->{d},
    ($i == $#salida ? "" : ",");
}
print $out "  ]\n};\n";
close $out;

printf "mapa: %d departamentos, %d KB -> %s\n",
  scalar(@salida), (-s $salida) / 1024, $salida;
