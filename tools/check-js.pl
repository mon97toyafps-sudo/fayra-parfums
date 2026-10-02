#!/usr/bin/perl
# Verifica el balance del JS inline y de las funciones de Netlify.
use strict;
use warnings;

sub check {
    my ($label, $src) = @_;
    my $o = () = $src =~ /\{/g;
    my $c = () = $src =~ /\}/g;
    my $po = () = $src =~ /\(/g;
    my $pc = () = $src =~ /\)/g;
    my $ok = ($o == $c && $po == $pc) ? "ok" : "DESBALANCEADO";
    printf "%-34s { %4d } %4d   ( %4d ) %4d   %s\n", $label, $o, $c, $po, $pc, $ok;
    return $o == $c && $po == $pc;
}

my $html = do { local (@ARGV, $/) = ("index.html"); <> };

my $todo = 1;
$todo &= check("index.html (script inline)", $1) if $html =~ /<script>(.*?)<\/script>/s;
$todo &= check("index.html (script inline #2", $1) if $html =~ /<script>(.*?)<\/script>/s;

for my $f (qw(netlify/functions/track.js netlify/functions/online.js netlify/functions/weekly.js)) {
    my $src = do { local (@ARGV, $/) = ($f); <> };
    $todo &= check($f, $src);
}

# Objetos literales en el JS inline: cada { sin pareja suele ser fallo
my $inline = "";
$inline = $1 while $html =~ /<script>(.*?)<\/script>/gs;
my $sospechosos = () = $inline =~ /\{(?![^{}]*[\(\[])/g;
print "\nsospechosos en inline: $sospechosos (informativo)\n";

exit($todo ? 0 : 1);
