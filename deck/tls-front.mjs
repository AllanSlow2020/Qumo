/**
 * A throwaway HTTPS front for capture.mjs: listens on 443 and passes every
 * request to the app on :3000, saying it arrived over https.
 *
 * The shopper surface sets secure cookies, so the capture browser has to see
 * https. This is for a local capture only. It needs a self-signed pair in
 * this directory first, which is git-ignored:
 *
 *   openssl req -x509 -newkey rsa:2048 -nodes -keyout deck/tls-key.pem \
 *     -out deck/tls-cert.pem -days 2 -subj "/CN=*.qumo-app.com"
 *   node deck/tls-front.mjs
 */
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const tls = { key: fs.readFileSync(path.join(HERE, "tls-key.pem")), cert: fs.readFileSync(path.join(HERE, "tls-cert.pem")) };

https
  .createServer(tls, (req, res) => {
    const up = http.request(
      {
        host: "127.0.0.1",
        port: 3000,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": req.headers.host },
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    up.on("error", (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(up);
  })
  .listen(443, () => console.log("https front on 443, passing to 3000"));
