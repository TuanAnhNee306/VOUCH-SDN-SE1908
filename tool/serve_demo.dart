import 'dart:io';

// Local-only static server for the compiled frontend. No backend or persistence.
Future<void> main(List<String> args) async {
  final root = Directory(args.isEmpty ? 'build/web' : args.first).absolute;
  if (!File('${root.path}/index.html').existsSync()) {
    stderr.writeln(
      'Build the web demo first, or pass the extracted web folder.',
    );
    exitCode = 1;
    return;
  }
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8765);
  stdout.writeln('TaskLy Customer demo: http://127.0.0.1:8765');
  const mime = {
    'html': 'text/html; charset=utf-8',
    'js': 'text/javascript; charset=utf-8',
    'json': 'application/json',
    'wasm': 'application/wasm',
    'png': 'image/png',
    'svg': 'image/svg+xml',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'woff2': 'font/woff2',
  };
  await for (final request in server) {
    try {
      final segments = request.uri.pathSegments;
      if (segments.any(
        (s) => s == '..' || s.contains('\\') || s.contains(':'),
      )) {
        request.response.statusCode = HttpStatus.forbidden;
      } else {
        final relative = segments.where((s) => s.isNotEmpty).join('/');
        final file = File(
          '${root.path}/${relative.isEmpty ? 'index.html' : relative}',
        );
        if (await file.exists()) {
          request.response.headers.set(
            HttpHeaders.contentTypeHeader,
            mime[file.path.split('.').last] ?? 'application/octet-stream',
          );
          request.response.headers.set(
            HttpHeaders.cacheControlHeader,
            'no-store',
          );
          await request.response.addStream(file.openRead());
        } else {
          request.response.statusCode = HttpStatus.notFound;
        }
      }
    } catch (_) {
      request.response.statusCode = HttpStatus.internalServerError;
    }
    await request.response.close();
  }
}
