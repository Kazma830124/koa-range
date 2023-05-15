import {Readable} from 'stream';
export default function readableBufferStream(srcBuf: Buffer) {
  let bytesRead = 0;

  return new Readable({
    read(size) {
      const remaining = srcBuf.length - bytesRead;
      if (remaining > 0) {
        const toRead = Math.min(size, remaining);
        this.push(srcBuf.subarray(bytesRead, bytesRead + toRead));
        bytesRead += toRead;
      } else {
        this.push(null);
      }
    },
  });
}
