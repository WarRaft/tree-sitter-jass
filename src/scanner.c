#include "tree_sitter/parser.h"
#include <string.h>

// External token types — must match grammar.js externals order exactly
enum TokenType {
    COMMENT,
    STRING_CONTENT,
    ESCAPE_SEQUENCE,
    RAWCODE,
    VIRTUAL_ENDLOOP,
    VIRTUAL_ENDGLOBALS,
    VIRTUAL_ENDFUNCTION,
    VIRTUAL_ENDIF,
};

// --- Character helpers ---

static bool is_id_start(int32_t c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

static bool is_id_cont(int32_t c) {
    return is_id_start(c) || (c >= '0' && c <= '9');
}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static void skip_ws(TSLexer *lexer) { lexer->advance(lexer, true); }

static bool word_eq(const char *buf, size_t len, const char *target) {
    return len == strlen(target) && strncmp(buf, target, len) == 0;
}

// Check if the word is ANY block-closing keyword
static bool is_any_close_keyword(const char *buf, size_t len) {
    return word_eq(buf, len, "endloop") ||
           word_eq(buf, len, "endglobals") ||
           word_eq(buf, len, "endfunction") ||
           word_eq(buf, len, "endif");
}

// --- Scanner lifecycle (no state needed) ---

void *tree_sitter_jass_external_scanner_create() { return NULL; }
void tree_sitter_jass_external_scanner_destroy(void *p) {}
void tree_sitter_jass_external_scanner_reset(void *p) {}
unsigned tree_sitter_jass_external_scanner_serialize(void *p, char *buf) { return 0; }
void tree_sitter_jass_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

// --- Main scan ---

bool tree_sitter_jass_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

    // During error recovery, tree-sitter sets ALL valid_symbols to true.
    // We must not blindly match STRING_CONTENT or virtual tokens in that state.
    bool error_recovery =
        valid_symbols[COMMENT] &&
        valid_symbols[STRING_CONTENT] &&
        valid_symbols[ESCAPE_SEQUENCE] &&
        valid_symbols[RAWCODE] &&
        valid_symbols[VIRTUAL_ENDLOOP] &&
        valid_symbols[VIRTUAL_ENDGLOBALS] &&
        valid_symbols[VIRTUAL_ENDFUNCTION] &&
        valid_symbols[VIRTUAL_ENDIF];

    // Escape sequence inside double-quoted string: \\, \", \n, \r
    if (valid_symbols[ESCAPE_SEQUENCE] && !error_recovery && lexer->lookahead == '\\') {
        advance(lexer);
        if (lexer->lookahead == '\\' || lexer->lookahead == '"' || lexer->lookahead == 'n' || lexer->lookahead == 'r') {
            advance(lexer);
            lexer->mark_end(lexer);
            lexer->result_symbol = ESCAPE_SEQUENCE;
            return true;
        }
        // Not a valid escape — treat backslash as string content
        // Fall through; mark_end was not called so nothing consumed
        return false;
    }

    // String content — everything except closing quote, backslash, and EOF
    if (valid_symbols[STRING_CONTENT] && !error_recovery) {
        lexer->result_symbol = STRING_CONTENT;
        bool has_content = false;
        while (true) {
            if (lexer->lookahead == '"' || lexer->lookahead == '\\' || lexer->lookahead == 0) {
                return has_content;
            }
            advance(lexer);
            has_content = true;
        }
    }

    // Skip whitespace
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\r' || lexer->lookahead == '\n') {
        skip_ws(lexer);
    }

    // Rawcode (FourCC) literal: 'xxxx' — no escapes, newlines allowed
    if (valid_symbols[RAWCODE] && !error_recovery && lexer->lookahead == '\'') {
        advance(lexer);
        while (lexer->lookahead != '\'' && lexer->lookahead != 0) {
            advance(lexer);
        }
        if (lexer->lookahead == '\'') {
            advance(lexer);
            lexer->mark_end(lexer);
            lexer->result_symbol = RAWCODE;
            return true;
        }
        return false;
    }


    // --- Emit virtual close at EOF (before peeking at identifiers) ---
    //
    // Must check BEFORE the identifier-peek block, because the peek block
    // advances past the word and corrupts lookahead. If we're truly at EOF,
    // emit the virtual close now.
    if (lexer->lookahead == 0 && !error_recovery) {
        if (valid_symbols[VIRTUAL_ENDLOOP]) {
            lexer->mark_end(lexer);
            lexer->result_symbol = VIRTUAL_ENDLOOP;
            return true;
        }
        if (valid_symbols[VIRTUAL_ENDIF]) {
            lexer->mark_end(lexer);
            lexer->result_symbol = VIRTUAL_ENDIF;
            return true;
        }
        if (valid_symbols[VIRTUAL_ENDFUNCTION]) {
            lexer->mark_end(lexer);
            lexer->result_symbol = VIRTUAL_ENDFUNCTION;
            return true;
        }
        if (valid_symbols[VIRTUAL_ENDGLOBALS]) {
            lexer->mark_end(lexer);
            lexer->result_symbol = VIRTUAL_ENDGLOBALS;
            return true;
        }
    }

    // --- Virtual closing tokens ---
    //
    // Logic: when the grammar expects a virtual close (meaning we're at the
    // end-position of some inner block), peek at the upcoming word. If it's
    // a closing keyword but NOT the one for this block, emit the virtual close
    // so tree-sitter can properly terminate the inner block.
    //
    // Example:  globals / a=2 / loop / endglobals
    //   Inside loop_statement, grammar expects 'endloop' or _virtual_endloop.
    //   Scanner peeks "endglobals" → it's a closer but not "endloop"
    //   → emit _virtual_endloop (zero-width) → loop closes
    //   → next step, grammar sees "endglobals" and closes globals normally
    //
    // IMPORTANT: The peek advances past the word, so after this block
    // lexer->lookahead may be 0 (EOF) even though we're not at real EOF.
    // We must NOT fall through to an EOF check after this.
    if (is_id_start(lexer->lookahead) && !error_recovery) {
        // Which virtual tokens does the grammar currently accept?
        bool want_endloop = valid_symbols[VIRTUAL_ENDLOOP];
        bool want_endglobals = valid_symbols[VIRTUAL_ENDGLOBALS];
        bool want_endfunction = valid_symbols[VIRTUAL_ENDFUNCTION];
        bool want_endif = valid_symbols[VIRTUAL_ENDIF];

        if (want_endloop || want_endglobals || want_endfunction || want_endif) {
            // Peek at the upcoming word without consuming (mark_end before peek)
            lexer->mark_end(lexer);

            char buf[64];
            size_t len = 0;
            while (is_id_cont(lexer->lookahead) && len < sizeof(buf) - 1) {
                buf[len++] = (char)lexer->lookahead;
                advance(lexer);
            }
            buf[len] = '\0';

            // If this word is a closing keyword, check if it matches what we want
            if (is_any_close_keyword(buf, len)) {
                // Emit virtual close if the keyword does NOT match our block
                if (want_endloop && !word_eq(buf, len, "endloop")) {
                    lexer->result_symbol = VIRTUAL_ENDLOOP;
                    return true;
                }
                if (want_endglobals && !word_eq(buf, len, "endglobals")) {
                    lexer->result_symbol = VIRTUAL_ENDGLOBALS;
                    return true;
                }
                if (want_endfunction && !word_eq(buf, len, "endfunction")) {
                    lexer->result_symbol = VIRTUAL_ENDFUNCTION;
                    return true;
                }
                if (want_endif && !word_eq(buf, len, "endif")) {
                    lexer->result_symbol = VIRTUAL_ENDIF;
                    return true;
                }
            }

            // The peek consumed the word — lookahead is now past it.
            // Do NOT continue; return false so tree-sitter resets to mark_end
            // and re-lexes the keyword via the internal lexer.
            return false;
        }
    }

    // Single-line comment: // ...
    if (valid_symbols[COMMENT] && lexer->lookahead == '/') {
        advance(lexer);
        if (lexer->lookahead == '/') {
            advance(lexer);
            while (lexer->lookahead != '\n' && lexer->lookahead != '\r' && lexer->lookahead != 0) {
                advance(lexer);
            }
            lexer->result_symbol = COMMENT;
            return true;
        }
        return false;
    }

    return false;
}
