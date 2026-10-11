#!/usr/bin/perl
# ============================================================
# Servidor estático para mirar la tienda en la computadora.
# No usa Node ni Python: esta máquina no los tiene.
#
#   perl tools/servidor.pl [puerto]
#
# Sirve la carpeta del proyecto en http://127.0.0.1:PUERTO
# ============================================================
use strict;
use warnings;
use HTTP::Daemon;
use HTTP::Status qw(:constants);
use HTTP::Response;
use IO::Select;
use File::Spec;
use Cwd qw(abs_path);

my $PUERTO = shift(@ARGV) || 8777;
my $RAIZ   = abs_path(File::Spec->curdir());

my %TIPO = (
    html  => 'text/html; charset=utf-8',
    css   => 'text/css; charset=utf-8',
    js    => 'application/javascript; charset=utf-8',
    json  => 'application/json; charset=utf-8',
    svg   => 'image/svg+xml',
    png   => 'image/png',
    jpg   => 'image/jpeg',
    jpeg  => 'image/jpeg',
    webp  => 'image/webp',
    ico   => 'image/x-icon',
    woff2 => 'font/woff2',
    txt   => 'text/plain; charset=utf-8',
);

my $d = HTTP::Daemon->new(LocalAddr => '127.0.0.1', LocalPort => $PUERTO, ReuseAddr => 1)
    or die "no pude abrir el puerto $PUERTO: $!\n";

print "escuchando en http://127.0.0.1:", $d->sockport, "\n";
print "sirviendo $RAIZ\n";
$| = 1;

sub archivo_de {
    my ($ruta) = @_;
    my $pedido = abs_path(File::Spec->catfile($RAIZ, $ruta));
    return undef if !$pedido || index($pedido, $RAIZ) != 0;   # no salirse de la carpeta
    $pedido = abs_path(File::Spec->catfile($pedido, 'index.html')) if -d $pedido;
    return undef if !$pedido || !-f $pedido;
    return $pedido;
}

while (1) {
    # accept() devuelve vacío cuando pasa un rato sin que nadie pida nada
    # (tiene su propio tiempo de espera). Con "while (my $c = ...)" eso
    # terminaba el bucle y el servidor se moría solo al minuto de inactividad.
    my $c = $d->accept;
    next if !$c;

    # Una sola petición por conexión, y se cierra enseguida. Si se deja la
    # conexión abierta (keep-alive), el navegador ocupa el único hilo del
    # servidor esperando recursos y la página se queda cargando siempre.
    # El navegador deja conexiones abiertas sin pedir nada (preconnect). Si
    # se espera ahí para siempre, el único hilo del servidor se traba y la
    # página no termina de cargar. Se descarta al cliente mudo.
    if (!IO::Select->new($c)->can_read(2)) {
        $c->close;
        undef($c);
        next;
    }

    my $r = $c->get_request;
    if (!$r) {
        $c->close;
        undef($c);
        next;
    }

    my $ruta = $r->uri->path;
    $ruta =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
    $ruta =~ s{^/}{};
    $ruta = 'index.html' if $ruta eq '';

    my $archivo = archivo_de($ruta);
    if (!$archivo) {
        $c->send_error(HTTP_NOT_FOUND, "no existe: $ruta");
        $c->close;
        undef($c);
        next;
    }

    open my $fh, '<:raw', $archivo or do {
        $c->send_error(HTTP_INTERNAL_SERVER_ERROR, "no pude leer $ruta");
        $c->close;
        undef($c);
        next;
    };
    local $/;
    my $cuerpo = <$fh>;
    close $fh;

    my ($ext) = $archivo =~ /\.([A-Za-z0-9]+)$/;
    my $tipo = $TIPO{lc($ext || '')} || 'application/octet-stream';

    my $res = HTTP::Response->new(HTTP_OK);
    $res->header('Content-Type'   => $tipo);
    $res->header('Content-Length' => length($cuerpo));
    $res->header('Cache-Control'  => 'no-store');
    $res->header('Connection'     => 'close');
    $res->content($cuerpo);
    $c->send_response($res);

    $c->close;
    undef($c);
}
