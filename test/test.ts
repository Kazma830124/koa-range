'use strict';

import etag from 'etag'
import fs from 'fs'
import request from 'supertest'
import * as should from 'should'
import route from 'koa-route'
import range from '../src';
import Koa, { Context } from 'koa'
import Readable from 'stream'

const app = new Koa();

const rawbody = Buffer.alloc(1024);
const rawFileBuffer = fs.readFileSync('./README.md') + '';

const readmeStat = fs.statSync('./README.md');
const readmeEtag = etag(readmeStat);
const bufferEtag = etag(rawFileBuffer);
const lastModifiedReadme = readmeStat.mtime.toUTCString();
app.use(range);
app.use(route.get('/', async function (ctx:Context) {
  ctx.body = rawbody;
}));
app.use(route.put('/', async function (ctx:Context) {
  ctx.status = 200;
}));
app.use(route.post('/', async function (ctx:Context) {
  ctx.status = 200;
}));
app.use(route.get('/json', async function (ctx:Context) {
  ctx.body = {foo: 'bar'};
}));
app.use(route.get('/string', async function (ctx:Context) {
  ctx.body = 'koa-range';
}));
app.use(route.get('/stream', async function (ctx:Context) {
  ctx.body = fs.createReadStream('./README.md');
}));

app.use(route.get('/buffer', async function (ctx:Context) {
  ctx.body = Buffer.from(rawFileBuffer);
}));

app.use(route.get('/empty', async function (ctx:Context) {
  ctx.body = undefined;
  ctx.status = 304;
}));

app.on('error', function (err) {
  throw err;
});

describe('normal requests', function () {
  it('should return 200 without range', function (done) {
    request(app.listen())
      .get('/')
      .expect('Accept-Ranges', 'bytes')
      .expect(200)
      .end(done)
  });

  it('should ignore range headers when method not GET', function (done) {
    request(app.listen())
      .post('/')
      .set('range', 'bytes=0-300')
      .expect('Accept-Ranges', 'bytes')
      .expect(200)
      .end((err,res)=>{
        if(err) throw err
      })
    
      done()
  });

  it('should ignore range headers with PUT', function (done) {
    request(app.listen())
      .put('/')
      .set('range', 'bytes=0-299')
      .expect('Accept-Ranges', 'bytes')
      .expect(200)
      .end((err,res)=>{
        if(err) throw err
      })
    
      done()
  });
});

describe('range requests', function () {
  it('should return 206 with partial content', function (done) {
    request(app.listen())
      .get('/')
      .set('range', 'bytes=0-299')
      .expect('Content-Length', '300')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 0-299/1024')
      .expect(206)
      .end((err,res)=>{
        if(err) throw err
      })
    
      done()
  });

  it('should return 416 with invalid range (1)', function (done) {
    request(app.listen())
      .get('/')
      .set('range', 'bytes=400-300')
      .expect('Accept-Ranges', 'bytes')
      .expect(416)
      .end(done)
  });

  it('should return 416 with invalid range (2)', async function (done) {
    request(app.listen())
      .get('/')
      .set('range', 'bytes=x-300')
      .expect('Accept-Ranges', 'bytes')
      .expect(416)
      .end((err,res)=>{
        if(err) throw err
      })
    
      done()
  });

  it('should return 416 with invalid range (3)', function (done) {
    request(app.listen())
      .get('/')
      .set('range', 'bytes=400-x')
      .expect('Accept-Ranges', 'bytes')
      .expect(416)
      .end((err,res)=>{
        if(err) throw err
      })
    
      done()
  });

  it('should return 416 with invalid range (4)', function (done) {
    request(app.listen())
      .get('/')
      .set('range', 'bytes')
      .expect('Accept-Ranges', 'bytes')
      .expect(416)
      .end((err,res)=>{
        if(err) throw err
      })
    
      done()
  });
});

describe('range requests with stream', function () {
  it('should return 206 with partial content', function (done) {
    request(app.listen())
      .get('/stream')
      .set('range', 'bytes=0-99')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 0-99/' + rawFileBuffer.length)
      .expect('Last-Modified', lastModifiedReadme)
      .expect('Etag', readmeEtag)
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
        const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal(rawFileBuffer.slice(0, 100));
        return done(err);
      });
  });

  it('should return 206 with open ended range', function (done) {
    request(app.listen())
      .get('/stream')
      .set('range', 'bytes=0-')
      .expect(206)
      .expect('Content-Range', 'bytes 0-1903/' + rawFileBuffer.length)
      .end(function (err, res) {
        should.not.exist(err);
        const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.startWith(rawFileBuffer.slice(0, 300));
        return done(err);
      });
  });
});

describe('range requests with json', function () {
  it('should return 206 with partial content', function (done) {
    request(app.listen())
      .get('/json')
      .set('range', 'bytes=0-5')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 0-5/13')
      .expect('Content-Length', '6')
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('{"foo"');
        return done(err);
      });
  });

  it('should return 206 with single byte range', function (done) {
    request(app.listen())
      .get('/json')
      .set('range', 'bytes=2-2')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 2-2/13')
      .expect('Content-Length', '1')
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('f');
        return done(err);
      });
  });
});

describe('range requests with buffer', function () {
  it('should return 206 with partial content', function (done) {
    request(app.listen())
      .get('/buffer')
      .set('range', 'bytes=0-99')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 0-99/' + rawFileBuffer.length)
      .expect('Etag', bufferEtag)
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
        should.not.exist(res.headers['last-modified']);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal(rawFileBuffer.slice(0, 100));
        return done(err);
      });
  });
});

describe('range requests with string', function () {
  it('should return 206 with partial content', function (done) {
    request(app.listen())
      .get('/string')
      .set('range', 'bytes=0-5')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 0-5/9')
      .expect('Content-Length', '6')
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('koa-ra');
        return done(err);
      });
  });

  it('should return 206 with open ended range', function (done) {
    request(app.listen())
      .get('/string')
      .set('range', 'bytes=3-')
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 3-8/9')
      .expect('Content-Length', '6')
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('-range');
        return done(err);
      });
  });
});

describe('range requests with empty body', function () {
  it('should return 304', function (done) {
    request(app.listen())
      .get('/empty')
      .set('range', 'bytes=1-')
      .expect(304)
      .end(function (err, res) {
        should.not.exist(err);
        return done(err);
      });
  });
});

describe('range requests with conditional GET', function () {
  it('should return 412 with mismatching etag (precondition failure)', function (done) {
    request(app.listen())
      .get('/buffer')
      .set('range', 'bytes=0-5')
      .set('if-match', 'fake_etag_value_that_doesnt_match')
      .expect('Accept-Ranges', 'bytes')
      .expect(412)
      .end(function (err, res) {
        should.not.exist(err);
        should.not.exist(res.headers['content-range']);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('');
        if(err) throw err
      });
      done()
  });

  it('should return 206 with partial content', function (done) {
    request(app.listen())
      .get('/buffer')
      .set('range', 'bytes=0-5')
      .set('if-match', bufferEtag)
      .expect('Accept-Ranges', 'bytes')
      .expect('Content-Range', 'bytes 0-5/1904')
      .expect('Content-Length', '6')
      .expect(206)
      .end(function (err, res) {
        should.not.exist(err);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal(rawFileBuffer.slice(0, 6));

        return done(err);
      });
  });

  it('should return 304 for cached content (if-none-match precondition)', function (done) {
    request(app.listen())
      .get('/stream')
      .set('range', 'bytes=0-5')
      .set('if-none-match', readmeEtag)
      .expect('Accept-Ranges', 'bytes')
      .expect(304)
      .end(function (err, res) {
        should.not.exist(err);
        should.not.exist(res.headers['content-range']);
        should.not.exist(res.headers['content-length']);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('');
        return done(err);
      });
  });

  it('should return 304 for cached content (if-modified-since precondition)', function (done) {
    request(app.listen())
      .get('/stream')
      .set('range', 'bytes=0-5')
      .set('if-modified-since', new Date().toUTCString())
      .expect('Accept-Ranges', 'bytes')
      .expect(304)
      .end(function (err, res) {
        should.not.exist(err);
        should.not.exist(res.headers['content-range']);
        should.not.exist(res.headers['content-length']);
         const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('');
        return done(err);
      });
  });

  it('should return 404 for not found resource', function (done) {
    request(app.listen())
      .get('/does_not_exist')
      .set('range', 'bytes=0-5')
      .set('if-modified-since', new Date().toUTCString())
      .expect('Accept-Ranges', 'bytes')
      .expect(404)
      .end(function (err, res) {
        should.not.exist(err);
        should.not.exist(res.headers['content-range']);
        const body = Buffer.isBuffer(res.body) ? res.body.toString() : typeof res.body === 'string' ? res.body : null
        should.notEqual(body,null)
        body!.should.equal('Not Found');
        res.headers['content-length'].should.equal('9');
        return done(err);
      });
  });
});
