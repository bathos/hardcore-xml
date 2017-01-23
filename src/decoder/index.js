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
  constructor({ encoding }) {
    super();

    this._decode        = undefined; // Generator that yields codepoints
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

        try {
          for (const cp of this.decode(Buffer.from(this.firstBytes))) {
            this.emit('codepoint', cp);
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

  // Used in messaging.

  get encString() {
    if (this.type === 'UTF16' || this.type === 'UTF32') {
      return `${ this.enc } (${ this.endianness })`;
    }

    return this.enc;
  }

  // Generic barfer for use when encountering invalid bytes or byte sequences.

  badValue(num) {
    throw new Error(
      `Byte(s) 0x${ num.toString(16) } does not decode to a valid ` +
      `codepoint in encoding ${ this.encStr }.`
    );
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
      codepage && this.nonASCIISeen;

    const invalidEndianness =
      endianness && this.endianness && (endianness !== this.endianness);

    const invalidUCS =
      noSurrogates && this.surrogatesSeen;

    const invalidLength =
      (this.type !== type) &&
      (this.type === 'UTF16' || this.type === 'UTF32');

    if (invalidCodepage || invalidEndianness || invalidUCS || invalidLength) {
      throw new Error(
        `The declared encoding ${ enc } contradicts the nature of the ` +
        `input thus far seen. The document appears to be encoded in ` +
        `${ this.encString } or something similar.`
      );
    }

    this.codepage     = codepage;
    this.enc          = enc;
    this.endianness   = endianness;
    this.noSurrogates = noSurrogates;
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
        this.flipped = flipped;
        this.setXMLEncoding(enc);
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

  _write(chunk, enc, done) {
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

    try {
      // Note that, though it probably costs us a good deal on performance, this
      // is not a transform stream, and codepoints are emitted individually. My
      // original approach was to bake-in a mini-lexer right in the decoder
      // (just enough to capture encoding declarations) so that it would not
      // need any synchronous backtalk from consumers. In this earlier model, it
      // was streams all the way down. But I discovered as I continued that
      // there is actually an abiding need to have synchronous communication at
      // the character level when handling XML in general, at least if you are
      // squeamish about violating separation of concerns (e.g., lexing vs
      // parsing). So this module, the input entrypoint, is modeled as a stream
      // (to meet general expectations of interoperability in nodeland if for no
      // other reason), but beyond that outward interface it’s all nice clean
      // (happily synchronous) event emitters. This siloing saves us from a lot
      // of potential code clarity problems during operations at a higher level
      // that need to halt execution at a lower level (e.g. when dereferencing
      // external entities).
      //
      // (Less important, but when it was a transform stream, it also felt very
      // silly to me that I could not push a Uint32Array instead of a node
      // Buffer unless I was willing to switch to readable object mode.)

      for (const cp of this.decode(buffer)) {
        this.emit('codepoint', cp);
      }

      done();
    } catch (err) {
      done(err);
    }
  }
}
