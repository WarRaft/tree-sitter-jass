#include "tree_sitter/parser.h"
#include <wctype.h>

enum TokenType {
    BLOCK_COMMENT_START,
    BLOCK_COMMENT_CONTENT,
    BLOCK_COMMENT_END,
    STRING_START,
    STRING_CONTENT,
    STRING_END,
};

void *tree_sitter_jass_external_scanner_create() { return NULL; }
void tree_sitter_jass_external_scanner_destroy(void *p) {}
void tree_sitter_jass_external_scanner_reset(void *p) {}
unsigned tree_sitter_jass_external_scanner_serialize(void *p, char *buffer) { return 0; }
void tree_sitter_jass_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

static void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

bool tree_sitter_jass_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
    
    // Block comment handling
    if (valid_symbols[BLOCK_COMMENT_START]) {
        if (lexer->lookahead == '/') {
            advance(lexer);
            if (lexer->lookahead == '*') {
                advance(lexer);
                lexer->result_symbol = BLOCK_COMMENT_START;
                return true;
            }
        }
    }

    if (valid_symbols[BLOCK_COMMENT_CONTENT]) {
        lexer->result_symbol = BLOCK_COMMENT_CONTENT;
        while (true) {
            if (lexer->lookahead == '*') {
                advance(lexer);
                if (lexer->lookahead == '/') {
                    return true;
                }
            } else if (lexer->lookahead == 0) {
                return true;
            } else {
                advance(lexer);
            }
        }
    }

    if (valid_symbols[BLOCK_COMMENT_END]) {
        if (lexer->lookahead == '*') {
            advance(lexer);
            if (lexer->lookahead == '/') {
                advance(lexer);
                lexer->result_symbol = BLOCK_COMMENT_END;
                return true;
            }
        }
    }

    // String handling
    if (valid_symbols[STRING_START]) {
        if (lexer->lookahead == '"') {
            advance(lexer);
            lexer->result_symbol = STRING_START;
            return true;
        }
    }

    if (valid_symbols[STRING_CONTENT]) {
        lexer->result_symbol = STRING_CONTENT;
        bool has_content = false;
        while (true) {
            if (lexer->lookahead == '"' || lexer->lookahead == 0) {
                return has_content;
            } else if (lexer->lookahead == '\\') {
                advance(lexer);
                if (lexer->lookahead != 0) {
                    advance(lexer);
                }
                has_content = true;
            } else {
                advance(lexer);
                has_content = true;
            }
        }
    }

    if (valid_symbols[STRING_END]) {
        if (lexer->lookahead == '"') {
            advance(lexer);
            lexer->result_symbol = STRING_END;
            return true;
        }
    }

    return false;
}
