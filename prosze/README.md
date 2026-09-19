# Rynek Shop Bot — Sticky v4

Node.js 18, bez zewnętrznych paczek.

Komendy:
- `/panel-tickety` — panel ticketów
- `/panel-produkty` — panel produktów
- `/sticky-legit kanal:<#...>` — ustawia sticky legit na wskazanym kanale
- `/sticky-usun kanal:<#...>` — usuwa sticky legit z kanału

Sticky automatycznie wraca na dół po każdej nowej wiadomości na wskazanym kanale.

Startup ACLClouds:
`exec /usr/local/bin/node --expose-gc --max-old-space-size=64 --max-semi-space-size=1 /home/container/index.js`
