import * as WebTorrentPkg from 'webtorrent';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

const WebTorrent = WebTorrentPkg.default || WebTorrentPkg;
const client = new WebTorrent();

// Use the Super Mario torrent infohash from the logs
const hash = 'ffe3d01cd92f1d0020bba357f382bbdcb0d8c9f2';
const magnet = `magnet:?xt=urn:btih:${hash}`;

console.log('Adding torrent...');
client.add(magnet, (torrent) => {
  console.log('Torrent ready! Getting largest file...');
  const file = torrent.files.reduce((a, b) => a.length > b.length ? a : b);
  console.log('File:', file.name);

  const probeStream = file.createReadStream({ start: 0, end: 3 * 1024 * 1024 });
  const pass = new PassThrough();
  probeStream.pipe(pass);

  console.log('Running ffprobe...');
  ffmpeg.ffprobe(pass, (err, metadata) => {
    console.log('ffprobe callback triggered!');
    if (err) {
      console.error('ffprobe error:', err.message);
    } else {
      console.log('Metadata streams:', metadata.streams.map(s => s.codec_type));
    }
    probeStream.destroy();
    pass.destroy();
    client.destroy(() => {
      console.log('Client destroyed');
      process.exit(0);
    });
  });
});

setTimeout(() => {
  console.log('Timeout - destroying client');
  client.destroy(() => {
    process.exit(0);
  });
}, 10000);
