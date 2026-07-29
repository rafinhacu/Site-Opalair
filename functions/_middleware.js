// Safari/iOS recusa tocar <video> se o servidor não responder corretamente
// a requisições "Range". O asset serving padrão do Cloudflare Pages ignora
// o header Range e sempre devolve o arquivo inteiro (200), o que quebra a
// reprodução em iPhone/iPad. Esta função intercepta pedidos de .mp4 e
// implementa o suporte a Range manualmente (206 Partial Content).
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!url.pathname.endsWith(".mp4")) {
    return context.next();
  }

  const assetResponse = await env.ASSETS.fetch(new Request(url, request));
  if (!assetResponse.ok) return assetResponse;

  const buffer = await assetResponse.arrayBuffer();
  const size = buffer.byteLength;
  const contentType = assetResponse.headers.get("Content-Type") || "video/mp4";

  const rangeHeader = request.headers.get("Range");
  if (!rangeHeader) {
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = match && match[1] ? parseInt(match[1], 10) : 0;
  let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start)) start = 0;
  if (Number.isNaN(end) || end >= size) end = size - 1;
  if (start > end) start = 0;

  const chunk = buffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(chunk.byteLength),
      "Accept-Ranges": "bytes",
    },
  });
}
