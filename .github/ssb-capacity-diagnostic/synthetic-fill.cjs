'use strict';
const fs = require('node:fs');
const block = Buffer.alloc(1024 * 1024, 0x53);
for (const [path, blocks] of [['/data/capacity-only.bin', 1024], ['/state/capacity-only.bin', 64]]) {
  const fd = fs.openSync(path, 'wx', 0o600);
  try {
    for (let index = 0; index < blocks; index++) {
      let offset = 0;
      while (offset < block.length) offset += fs.writeSync(fd, block, offset, block.length-offset);
    }
    fs.fsyncSync(fd);
    if (fs.fstatSync(fd).size !== blocks * block.length) throw new Error('SYNTHETIC_SIZE');
  } finally {
    fs.closeSync(fd);
  }
}
console.log(JSON.stringify({synthetic: true, dataBytes: 1073741824, stateBytes: 67108864}));
