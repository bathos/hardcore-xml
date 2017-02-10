import { Writable } from 'stream';
import { CR, LF } from '../data/codepoints';
import encodings, { BOMS, SIGNALS } from '../data/encodings';

import oneByte  from './decoders/one-byte';
import shiftJIS from './decoders/shift-jis';
import utf8     from './decoders/utf8';
import utf16    from './decoders/utf16';
import utf32    from './decoders/utf32';

const NON_ALPHANUM = /[^A-Z\d]/gi;

const bytesMatch = (bytes, expected) =>
  expected.every((expectedByte, index) => bytes[index] === expectedByte);

const toEncodingKey = str => str.toUpperCase().replace(NON_ALPHANUM, '');

export default
class Decoder extends Writable {
  constructor({ encoding }={}) {
    super();

    this.bomSeen        = false;     // precludes switching codepage, byte-order
    this.codepage       = undefined; // Maps for 1-byte encs and shiftJIS
    this.enc            = undefined; // Encoding name as provided
    this.endianness     = undefined; // BE or LE if applicable
    this.firstBytes     = [];        // Used for heuristic encoding sniff
    this.flipped        = false;     // For weird 32bit byte orders
    this.lastCharWasCR  = false;     // tracked for newline normalization
    this.nonASCIISeen   = false;     // precludes switching codepages
    this.noSurrogates   = undefined; // modifies UTF16 to be UCS2
    this.reserved       = undefined; // bytes held over from last trans
    this.surrogatesSeen = false;     // precludes UCS2/4
    this.type           = undefined; // ONEBYTE, SHIFTJIS, UTF8, etc

    this._decode        = undefined; // Generator that yields codepoints
    this.__codepoints__ = undefined; // paused decode() iterator during halting
    this.__halted__     = 0;         // incremented/decremented when halting
    this.__done__       = undefined; // iterator callback when halting

    if (encoding) {
      this.setXMLEncoding(encoding, 'user-specified');
    }

    const flush = () => {
      if (this.reserved) {
        this.emit('error', new Error(
          `Input ended abruptly — remaining bytes do not ` +
          `form a whole character.`
        ));
      } else if (this.firstBytes.length && this.firstBytes.length < 4) {

        // WACKY EDGE CASE
        //
        // There is no way to have a valid XML document which is fewer than four
        // bytes in any encoding (<x/> is the shortest possible valid doc), but
        // an external general or parameter entity could be fewer, and while an
        // external DTD could not have content less than 4 bytes, it could
        // nonetheless be contentless and be 0 bytes:
        //
        //  [30] extSubset     ::= TextDecl? extSubsetDecl
        //  [31] extSubsetDecl ::= (markupdecl | conditionalSect | DeclSep)*
        //
        // (note the quantifiers)
        //
        // Fortunately it is possible to say, at least, that such an entity
        // could not have an encoding declaration. So we will proceed as UTF8,
        // the default assumption in the absence of encoding declaration, BOM,
        // and the xml/text declaration based initial heuristic.

        if (!this._decode) {
          this.setXMLEncoding('UTF8');
        }

        try {
          for (const cp of this.decode(Buffer.from(this.firstBytes))) {
            this.codepoint(cp);
          }

          this.firstBytes = [];

          flush();

        } catch (err) {
          this.emit('error', err);
        }
      }
    };

    this.on('finish', flush);
  }

  // Generic barfer for use when encountering invalid bytes or byte sequences.

  badValue(num) {
    throw new Error(
      `Byte(s) 0x${ num.toString(16) } does not decode to a valid ` +
      `codepoint in encoding ${ this.enc }.`
    );
  }

  // This will be overwritten when used within the parser itself — see details
  // below (in the _write function).

  codepoint(cp) {
    this.emit('codepoint', cp);
  }

  // Wraps the actual ‘_decode’ method, applying newline normalization logic,
  // and it sets the flag that prevents switching to a different encoding if
  // non-ASCII codepoints have already been seen.

  * decode(buffer) {
    // 2.11 End-of-Line Handling
    //
    // XML parsed entities are often stored in computer files which, for editing
    // convenience, are organized into lines. These lines are typically
    // separated by some combination of the characters CARRIAGE RETURN (#xD) and
    // LINE FEED (#xA).
    //
    // To simplify the tasks of applications, the XML processor must behave as
    // if it normalized all line breaks in external parsed entities (including
    // the document entity) on input, before parsing, by translating both the
    // two-character sequence #xD #xA and any #xD that is not followed by #xA to
    // a single #xA character.

    for (const cp of this._decode(buffer)) {
      if (cp > 0x7F) {
        this.nonASCIISeen = true;
      }

      if (cp === CR) {
        yield LF;
      } else if (!this.lastCharWasCR || cp !== LF) {
        yield cp;
      }

      this.lastCharWasCR = cp === CR;
    }
  }

  // Pauses the stream. But for real; it actually pauses all processing of
  // additional codepoints, RIGHT NOW, exactly where we are, regardless of what
  // was in flight.

  haltAndCatchFire() {
    this.cork();
    this.__halted__++;
  }

  // Called at three possible junctures:
  // 1. The user provided an explicit encoding during configuration.
  // 2. The encoding was ‘sniffed’ successfully (perhaps) by either BOM or the
  //    prescribed "<?" algorithm.
  // 3. An encoding was discovered in an xml or text declaration.
  //
  // Note that ‘setEncoding’ is a native streams method, hence the naming.

  setXMLEncoding(enc, sourceMsg) {
    const {
      codepage,
      endianness,
      noSurrogates,
      type
    } = encodings[toEncodingKey(enc)] || {};

    if (!type) {
      throw new Error(
        `The ${ sourceMsg } encoding ${ enc } is not recognized. ` +
        `You may need to pass your input through a dedicated decoding stream ` +
        `before passing it to hardcore.`
      );
    }

    const invalidCodepage =
      (this.codepage && this.codepage !== codepage) ||
      (codepage && (this.nonASCIISeen || this.bomSeen));

    const invalidEndianness =
      endianness && this.endianness && (endianness !== this.endianness);

    const invalidUCS =
      noSurrogates && this.surrogatesSeen;

    const invalidLength =
      (this.type !== type) && (
        this.type === 'UTF16' ||
        this.type === 'UTF32' ||
        this.type && (type === 'UTF16' || type === 'UTF32')
      );

    if (invalidCodepage || invalidEndianness || invalidUCS || invalidLength) {
      throw new Error(
        `The ${ sourceMsg } encoding ${ enc } differs from what was ` +
        `initially specified or what had been detected (currently: ` +
        `${ this.enc }) in such a way that switching is not possible.`
      );
    }

    // If the declared encoding is utf16le, utf32be, etc — that is, a unicode
    // encoding whose designation defines its byte-order — it should not
    // technically have had a BOM. But we do not enforce this, since it’s hard
    // to imagine it being anything but unhelpful, and only expect that if the
    // byte order has already been established (whether by BOM, user-specified
    // value, or sniffing), it cannot thereafter change, and discard the BOM in
    // every case. An actual ZWNBSP as the first character of a document would
    // be illegal anyway, so the contrived worst case would be that we parse a
    // non-document that just happened to look like XML in every way except for
    // this one character successfully.

    this.codepage     = codepage;
    this.enc          = enc;
    this.endianness   = endianness;
    this.noSurrogates = this.noSurrogates || noSurrogates;
    this.type         = type;

    switch (type) {
      case 'ONEBYTE':  this._decode = oneByte;  break;
      case 'SHIFTJIS': this._decode = shiftJIS; break;
      case 'UTF8':     this._decode = utf8;     break;
      case 'UTF16':    this._decode = utf16;    break;
      case 'UTF32':    this._decode = utf32;    break;
    }
  }

  // See non-normative section F, "Autodetection of Character Encodings" for
  // details. Ensuring this behavior was one of the reasons I chose to bother
  // with this rather than using iconv-lite here (another is that the parser
  // must be able to *synchronously* set a more specific encoding for all
  // further processing as soon as the the xml/text declaration is read).
  //
  // This runs regardless of whether the user set an explicit encoding because
  // (a) a contradictory BOM should be an error and (b) the BOMs need to be
  // eliminated from the output either way.

  sniff() {
    for (const { bytes, enc, flipped } of BOMS) {
      if (bytesMatch(this.firstBytes, bytes)) {
        this.setXMLEncoding(enc, 'BOM-indicated');
        this.bomSeen = true;
        this.flipped = flipped;
        return Buffer.from(this.firstBytes.slice(bytes.length));
      }
    }

    if (!this.enc) {
      for (const { bytes, enc, flipped } of SIGNALS) {
        if (bytesMatch(this.firstBytes, bytes)) {
          this.flipped = flipped;
          this.setXMLEncoding(enc);
          return Buffer.from(this.firstBytes);
        }
      }

      this.setXMLEncoding('UTF8');
    }

    return Buffer.from(this.firstBytes);
  }

  // Resume from where we were last.

  unhalt() {
    this.uncork();
    this.__halted__--;

    if (this.__codepoints__ && this.__halted__ === 0) {
      let cp;

      while (cp = this.__codepoints__.next().value) {
        this.codepoint(cp);

        if (this.__halted__) {
          return;
        }
      }

      this.__done__();
      this.__codepoints__ = undefined;
      this.__done__       = undefined;
    }
  }

  // Writable write implementation: buffers only, has special behavior for first
  // four bytes (BOM & content sniffing); calls this.decode and poops
  // codepoints.

  _write(chunk, enc, done) {
    try {
      let buffer = chunk;

      if (this.firstBytes.length < 4) {
        this.firstBytes.push(...buffer);

        if (this.firstBytes.length >= 4) {
          buffer = this.sniff();
        } else {
          done();
          return;
        }
      }

      // It may seem odd that this is a writable stream and not a transform
      // stream. Originally it was a transform stream. But I ran into some
      // problems owing to peculiar needs of XML parsing. The short version is
      // just that we need to be able to get immediate ‘feedback’ at from the
      // parser upon hitting an encoding declaration. We also need to be able to
      // halt flow entirely, also at the codepoint level.
      //
      // The default implementation of ‘codepoint’ is to emit a ‘codepoint’
      // event. This is just for the sake of standalone usage, e.g., during
      // tests. In practice, Decoder will be subclassed by Processor, which will
      // provide its own ‘codepoint’ method. This ends up sparing us from having
      // a bunch of intermediary buffers.

      const codepoints = this.decode(buffer);

      // This first check is needed because cork() is like, ‘cork, please,
      // unless you don’t feel like it ... on second thought just do whatever
      // you think is best for me, it was just a suggestion, I’m so silly to be
      // bothing you, apologies.’

      if (this.__halted__) {
        this.__codepoints__ = codepoints;
        this.__done__ = done;
        return;
      }

      // We cannot use a for-of loop here because automatic iterator closing
      // breaks it. I’m not sure if this is maybe a V8 implementation bug or
      // correct behavior. IIRC, automatic iterator closing was only supposed
      // to happen if there weren’t other references to the iterator, but maybe
      // that was ultimately changed. Amazingly enough, it’s not simply a matter
      // of ‘the loop was exited, so the iterator was closed’. *Synchronously*,
      // I can still get more values. It is only when the continuation is
      // attempted asynchronously that the generator, by virtue of having once
      // been used in a for loop that was exited, becomes closed! Unintuitive
      // and really zalgo-y — I hope this is a bug and not a new Bad Part?

      let cp;

      while (cp = codepoints.next().value) {
        this.codepoint(cp);

        // If we get halted ... wait to continue! This way the parser can truly
        // halt the stream and not just like, kind of. Follow up is above in
        // local wrapper for uncork().

        if (this.__halted__) {
          this.__codepoints__ = codepoints;
          this.__done__ = done;
          return;
        }
      }

      done();
    } catch (err) {
      done(err);
    }
  }
}
