#!/usr/bin/perl
# Revisa el balance de llaves del JS y busca caracteres no-ASCII sospechosos.
use strict;
use warnings;

sub check {
    my ($label, $src) = @_;
    # Contador simple a propósito: es una primera mirada, no un parser. Ojo
    # con los falsos positivos, un archivo con expresiones regulares como
    # /Android [\\d.]+; ([^)]+?).../ tiene parentesis que no son codigo.
    my $o = () = $src =~ /\{/g;
    my $c = () = $src =~ /\}/g;
    my $po = () = $src =~ /\(/g;
    my $pc = () = $src =~ /\)/g;
    my $ok = ($o == $c && $po == $pc) ? "ok" : "revisar";
    printf "%-28s { %4d } %4d   ( %4d ) %4d   %s\n", $label, $o, $c, $po, $pc, $ok;
    return $o == $c && $po == $pc;
}

my @ARCHIVOS = @ARGV ? @ARGV : qw(
  assets/js/app.js
  assets/js/ruta.js
  assets/js/mapa-es.js
  netlify/functions/panel.js
  netlify/functions/registro.js
  netlify/functions/track.js
  netlify/functions/online.js
  netlify/functions/weekly.js
);

my $todo = 1;
my %raros;
for my $f (@ARCHIVOS) {
    next unless -e $f;
    my $src = do { local (@ARGV, $/) = ($f); <> };
    my $bien = check($f, $src);
    $todo &= 1;                       # el imbalance no corta el chequeo
    # Caracteres fuera del rango latino: indicador de texto colado por error
    my @r = ($src =~ /([\x{4E00}-\x{9FFF}\x{3000}-\x{303F}\x{FF00}-\x{FFEF}\x{FFFD}])/g);
    $raros{$f} = [ map { sprintf("U+%04X", ord($_)) } @r ] if @r;
}

if (%raros) {
    for my $f (sort keys %raros) {
        print "CARACTERES RAROS en $f: " . join(" ", @{ $raros{$f} }) . "\n";
    }
    $todo = 0;
} else {
    print "sin caracteres raros en el JS\n";
}

# Las paradas de la ruta tienen que existir en el mapa. Con una de mas se cae
# toda la animacion del carrito y en la pagina solo se ven los departamentos
# quietos, sin ninguna pista de que faltara algo.
if (-e "assets/js/ruta.js" && -e "assets/js/mapa-es.js") {
    my $mapa = do { local (@ARGV, $/) = ("assets/js/mapa-es.js"); <> };
    my $ruta = do { local (@ARGV, $/) = ("assets/js/ruta.js"); <> };
    my %existe = map { $_ => 1 } ($mapa =~ /id: "([a-z0-9-]+)"/g);
    my @paradas = ($ruta =~ /^\s*\["([a-z0-9-]+)",/gm);
    my @faltan = grep { !$existe{$_} } @paradas;
    if (@faltan) {
        print "PARADAS QUE NO ESTAN EN EL MAPA: @faltan\n";
        $todo = 0;
    } else {
        printf "las %d paradas de la ruta existen en el mapa\n", scalar @paradas;
    }
}

# El HTML no debería quedar con un solo archivo gigante de base64
for my $f (glob("*.html")) {
    my $h = do { local (@ARGV, $/) = ($f); <> };
    my $d = () = $h =~ /data:image/g;
    print "$f: $d imagenes embebidas en base64\n";
    $todo = 0 if $d;
}

exit($todo ? 0 : 1);
