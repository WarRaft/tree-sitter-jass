#include "tree_sitter/parser.h"
#include <wctype.h>

enum TokenType {
    COMMENT,
    STRING_CONTENT,
};

void *tree_sitter_jass_external_scanner_create() { return NULL; }
void tree_sitter_jass_external_scanner_destroy(void *p) {}
void tree_sitter_jass_external_scanner_reset(void *p) {}
unsigned tree_sitter_jass_external_scanner_serialize(void *p, char *buffer) { return 0; }
void tree_sitter_jass_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

bool tree_sitter_jass_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
    // Single-line comment: // ...
    if (valid_symbols[COMMENT]) {
        if (lexer->lookahead == '/') {
            advance(lexer);
            if (lexer->lookahead == '/') {
                advance(lexer);
                while (lexer->lookahead != '\n' && lexer->lookahead != '\r' && lexer->lookahead != 0) {
                    advance(lexer);
                }
                lexer->result_symbol = COMMENT;
                return true;
            }
        }
    }

    // String content between quotes
    if (valid_symbols[STRING_CONTENT]) {
        lexer->result_symbol = STRING_CONTENT;
        bool has_content = false;
        while (true) {
            if (lexer->lookahead == '"' || lexer->lookahead == 0) {
                return has_content;
            } else if (lexer->lookahead == '\\') {
                advance(lexer);
                if (lexer->lookahead != 0) advance(lexer);
                has_content = true;
            } else {
                advance(lexer);
                has_content = true;
            }
        }
    }

    return false;
}

