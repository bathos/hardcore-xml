// The ExpansionTicket class represents a single active entity expansion (both
// general and parameter). It helps us manage these tricky shits a little more
// safely: entity expansion is potentially recursive, but the content of each
// must obey specific contextual constraints. The ‘ticket’ is used by tokenizer
// state methods to manage constraints and special behaviors the apply while an
// expansion remains active.
//
// For example, within an element’s content, an entity expansion may not include
// the sequence that would terminate that same element, and also must terminate
// in the same state where it began, such that any expansion including an
// element’s open tag must include, also, that element’s close tag.
//
// Another example is that in attribute values, if an expansion includes the
// characters '"' or '\'', they are not errors, but they are cast as chardata
// rather than markup.
//
// > [regarding markup declarations]:
//
// > The markup declarations may be made up in whole or in part of the
// > replacement text of parameter entities. The productions later in this
// > specification for individual nonterminals (elementdecl, AttlistDecl, and so
// > on) describe the declarations after all the parameter entities have been
// > included.
//
// Note the last bit: it is saying, in effect, that the EBNF for these items is
// actually kind of a lie, at the initial lexing level, when these productions
// are processed in the context of an external entity of external entity
// reference expansion. Stay with me here...
//
// In internal subsets, parameter expansions are no more complex than in CONTENT
// or ATTRIBUTE VALUE contexts: they can only occur at one ‘level’ and must exit
// at that same level. But when resolving external entities (including external
// DTDs), the rules go into a sort of bizzarro mode. Rather than mapping neatly
// to a rule like ‘must amount to a valid CONTENT production’, in these cases it
// becomes possible to use parameter references to represent arbitrary spans of
// markup, with just the following notable constraints and behaviors:
//
// - VC: Proper Conditional Section/PE Nesting
//   "If any of the "<![", "[", or "]]>" of a conditional section is contained
//    in the replacement text for a parameter-entity reference, all of them must
//    be contained in the same replacement text."
// - VC: Proper Group/PE Nesting
//   "[...] if either of the opening or closing parentheses in a choice, seq, or
//    Mixed construct is contained in the replacement text for a parameter
//    entity, both must be contained in the same replacement text."
// - 4.4.8 Included as PE
//   "[...] When a parameter-entity reference is recognized in the DTD and
//    included, its replacement text must be enlarged by the attachment of one
//    leading and one following space (#x20) character; the intent is to
//    constrain the replacement text of parameter entities to contain an
//    integral number of grammatical tokens in the DTD. This behavior must not
//    apply to parameter entity references within entity values [...]"
//
// It’s surprisingly little said about a matter so complex.
//
// But it is that last item which is so important — it took me forever to
// discover it for some reason, and I was so confused until then! It completely
// unravels the riddle: this space padding is what permits the other rules to be
// seemingly so absurdly permissive (<> and () pairings must always occur within
// one expansion is essentially what it boils down to) without actually
// permitting a total zalgo trainwreck.
//
// Another thing that threw me off the scent for a while was that the one XML
// DTD validator I could find online, http://www.validome.org/grammar/validate/,
// which I had been using to test the accuracy of my understanding, is not
// conformant! It considers some malformed references to be well-formed and vice
// versa; I am certain of that now. I must rely on the spec alone, the one true
// guiding light...

export default
class ExpansionTicket {
  constructor(name, tokenizer) {
    if (++tokenizer.expansionCount > tokenizer.maxExpansionCount) {
      tokenizer.emit('error', new Error(
        `Hit maximum entity expansion count (${ name }).`
      ));
    }

    if (tokenizer.activeExpansions.some(ticket => ticket.name === name)) {
      tokenizer.emit('error', new Error(
        `Recursive entity expansion, explode! (${ name })`
      ));
    }

    this.name = name;
    this.active = true;
    this.external = false; // May be set to true later.

    this.__length__           = 0;
    this.__maxExpansionSize__ = tokenizer.maxExpansionSize;
    this.__parents__          = tokenizer.activeExpansions.slice();
    this.__tokenizer__        = tokenizer;

    tokenizer.activeExpansions.unshift(this);
  }

  close() {
    this.active = false;
    this.__tokenizer__.activeExpansions.shift();
  }

  increment() {
    this.length++;

    if (this.length > this.__maxExpansionSize__) {
      this.__tokenizer__.emit('error', new Error(
        `Exceeded maximum expansion size limit (${ this.name }).`
      ));
    }

    this.__parents__.forEach(ticket => ticket.increment());
  }
}
