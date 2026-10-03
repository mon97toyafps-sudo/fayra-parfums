#!/usr/bin/perl
# Revisa el balance de llaves del JS y busca caracteres no-ASCII sospechosos.
use strict;
use warnings;

sub check {
    my ($label, $src) = @_;
    my $o = () = $src =~ /\{/g;
    my $c = () = $src =~ /\}/g;
    my $po = () = $src =~ /\(/g;
    my $pc = () = $src =~ /\)/g;
    my $ok = ($o == $c && $po == $pc) ? "ok" : "DESBALANCEADO";
    printf "%-28s { %4d } %4d   ( %4d ) %4d   %s\n", $label, $o, $c, $po, $pc, $ok;
    return $o == $c && $po == $pc;
}

my $todo = 1;
for my $f (qw(assets/js/app.js netlify/functions/track.js netlify/functions/online.js netlify/functions/weekly.js)) {
    my $src = do { local (@ARGV, $/) = ($f); <> };
    $todo &= check($f, $src);
}

# Caracteres fuera del rango latino (indicador de texto colado por error)
my $src = do { local (@ARGV, $/) = ("assets/js/app.js"); <> };
my @raros = ($src =~ /([\x{4E00}-\x{9FFF}\x{3000}-\x{303F}\x{FF00}-\x{FFEF}])/g);
if (@raros) {
    print "CARACTERES RAROS: " . join(" ", map { sprintf("U+%04X", ord($_)) } @raros) . "\n";
    $todo = 0;
} else {
    print "sin caracteres raros en el JS\n";
}

# El HTML no debería quedar con un solo archivo gigante de base64
for my $f (glob("*.html")) {
    my $h = do { local (@ARGV, $/) = ($f); <> };
    my $d = () = $h =~ /data:image/g;
    print "$f: $d imagenes embebidas en base64\n";
    $todo = 0 if $d;
}

exit($todo ? 0 : 1);
