#!/usr/bin/perl
# Reemplaza, en orden de primera aparición, cada data URI de imagen
# dentro de index.html por su ruta relativa en assets/img/.
use strict;
use warnings;

my $file = shift @ARGV or die "uso: extract-images.pl index.html\n";

my @paths = qw(
  assets/img/favicon.png
  assets/img/logo-script.png
  assets/img/logo-f.png
  assets/img/perfume-1.jpg
  assets/img/logo-f.png
  assets/img/logo-f.png
  assets/img/perfume-1.jpg
  assets/img/perfume-2.webp
);

open my $fh, '<:raw', $file or die "no abro $file: $!\n";
local $/;
my $html = <$fh>;
close $fh;

my $orig = length $html;
my $i = 0;

# Cada pasada sustituye la PRIMERA data URI que quede sin resolver.
my $re = qr{(data:image/[a-z]+;base64,)[A-Za-z0-9+/=]+};
while ( $html =~ s{$re}{ take_path() }e ) {
  last if $i > $#paths;
}

sub take_path {
  my $p = $paths[ $i++ ];
  return $p;
}

die "quedaron data URIs sin resolver\n" if $html =~ /data:image\/[a-z]+;base64/;
die "se Sustituyeron mas de las esperadas\n" if $i != @paths;

open my $out, '>:raw', $file or die "no escribo $file: $!\n";
print $out $html;
close $out;

printf "index.html: %.2f MB -> %.1f KB (%d imagenes externalizadas)\n",
  $orig / 1048576, length($html) / 1024, $i;
