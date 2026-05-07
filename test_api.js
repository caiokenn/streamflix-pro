import * as WebTorrentPkg from 'webtorrent';
const WebTorrent = WebTorrentPkg.default || WebTorrentPkg;

const client = new WebTorrent();
const magnet = 'magnet:?xt=urn:btih:664621f976ad8ca7d77057bf8893b11fe3e168be';

const torrent = client.add(magnet, (t) => {
  console.log('--- ONTORRENT CALLBACK ---');
  console.log('t.ready:', t.ready);
  console.log('t.metadata:', !!t.metadata);
  console.log('t.infoHash:', t.infoHash);
  console.log('torrent keys:', Object.keys(t));
  console.log('torrent proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(t)));
  client.destroy(() => {
    console.log('Destroyed');
    process.exit(0);
  });
});

console.log('--- AFTER ADD ---');
console.log('torrent.ready:', torrent.ready);
console.log('torrent.metadata:', !!torrent.metadata);
console.log('torrent.on:', typeof torrent.on);

// Give it a few seconds to trigger if needed, or destroy if nothing happens
setTimeout(() => {
  console.log('Timeout');
  client.destroy(() => {
    process.exit(0);
  });
}, 5000);
