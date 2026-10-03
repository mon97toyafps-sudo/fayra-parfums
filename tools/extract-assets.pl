#!/usr/bin/perl
# Saca el bloque <style> y el bloque <script> de index.html a archivos sueltos,
# para que varias paginas puedan compartirlos.
use strict;
use warnings;

my $file = shift @ARGV or die "uso: extract-assets.pl index.html\n";
my $html = do { local (@ARGV, $/) = ($file); <> };

my ($css) = $html =~ m{<style>(.*?)</style>}s  or die "no hay <style>\n";
my ($js)  = $html =~ m{<script>(.*?)</script>}s or die "no hay <script>\n";

mkdir "assets/css";
mkdir "assets/js";

open my $c, '>:raw', "assets/css/estilos.css" or die $!;
print $c $css;
close $c;

open my $j, '>:raw', "assets/js/app.js" or die $!;
print $j $js;
close $j;

# Deja los <link>/<script> en el lugar de los bloques originales.
$html =~ s{<style>.*?</style>}{<link rel="stylesheet" href="assets/css/estilos.css" />}s;
$html =~ s{<script>.*?</script>}{<script src="assets/js/app.js" defer></script>}s;

open my $o, '>:raw', $file or die $!;
print $o $html;
close $o;

printf "CSS: %.1f KB   JS: %.1f KB\n", length($css)/1024, length($js)/1024;
