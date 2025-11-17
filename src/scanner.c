#include "tree_sitter/parser.h"
#include <wctype.h>
#include <string.h>

// O(1) keyword check using first char + length + switch
static bool is_keyword(const char *str, size_t len) {
    if (len < 2 || len > 11) return false;

    switch (str[0]) {
        case 'a':
            if (len == 3 && str[1] == 'n' && str[2] == 'd') return true; // and
            if (len == 5 && memcmp(str, "array", 5) == 0) return true;
            break;
        case 'c':
            if (len == 4 && memcmp(str, "call", 4) == 0) return true;
            if (len == 8 && memcmp(str, "constant", 8) == 0) return true;
            break;
        case 'e':
            if (len == 4 && memcmp(str, "else", 4) == 0) return true;
            if (len == 5 && memcmp(str, "endif", 5) == 0) return true;
            if (len == 6 && memcmp(str, "elseif", 6) == 0) return true;
            if (len == 7 && memcmp(str, "extends", 7) == 0) return true;
            if (len == 7 && memcmp(str, "endloop", 7) == 0) return true;
            if (len == 8 && memcmp(str, "exitwhen", 8) == 0) return true;
            if (len == 10 && memcmp(str, "endglobals", 10) == 0) return true;
            if (len == 11 && memcmp(str, "endfunction", 11) == 0) return true;
            break;
        case 'f':
            if (len == 8 && memcmp(str, "function", 8) == 0) return true;
            break;
        case 'g':
            if (len == 7 && memcmp(str, "globals", 7) == 0) return true;
            break;
        case 'i':
            if (len == 2 && str[1] == 'f') return true; // if
            break;
        case 'l':
            if (len == 4 && memcmp(str, "loop", 4) == 0) return true;
            if (len == 5 && memcmp(str, "local", 5) == 0) return true;
            break;
        case 'n':
            if (len == 3 && memcmp(str, "not", 3) == 0) return true;
            if (len == 6 && memcmp(str, "native", 6) == 0) return true;
            if (len == 7 && memcmp(str, "nothing", 7) == 0) return true;
            break;
        case 'o':
            if (len == 2 && str[1] == 'r') return true; // or
            break;
        case 'r':
            if (len == 6 && memcmp(str, "return", 6) == 0) return true;
            if (len == 7 && memcmp(str, "returns", 7) == 0) return true;
            break;
        case 's':
            if (len == 3 && memcmp(str, "set", 3) == 0) return true;
            break;
        case 't':
            if (len == 4) {
                if (memcmp(str, "then", 4) == 0) return true;
                if (memcmp(str, "type", 4) == 0) return true;
            }
            if (len == 5 && memcmp(str, "takes", 5) == 0) return true;
            break;
    }
    return false;
}

enum TokenType {
    ID,               // Identifier with keyword exclusion
    COMMENT,          // Single-line // comment
    STRING_CONTENT,   // String content with escape sequences
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
                return has_content; // only succeed if we consumed at least one char
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

    // Identifier: exclude reserved keywords
    if (valid_symbols[ID]) {
        if (iswalpha(lexer->lookahead) || lexer->lookahead == '_') {
            char buf[256]; size_t len = 0;
            while ((iswalnum(lexer->lookahead) || lexer->lookahead == '_') && len < 255) {
                buf[len++] = lexer->lookahead;
                advance(lexer);
            }
            buf[len] = '\0';
            if (is_keyword(buf, len)) {
                return false; // let grammar match literal keyword instead
            }
            lexer->result_symbol = ID;
            return true;
        }
    }
    return false;
}
