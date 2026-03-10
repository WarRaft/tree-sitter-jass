/**
 * Tree-sitter grammar for JASS (Warcraft 3 scripting language)
 *
 * DESIGN PHILOSOPHY:
 * - Everything is an EXPRESSION except block statements
 * - No special 'assignment_statement' - assignment is just an operator in expr
 * - Very permissive: blocks can nest anywhere, expressions work everywhere
 * - Error recovery: tree-sitter creates MISSING nodes for unclosed blocks
 *
 * EXPRESSION-BASED APPROACH:
 * Instead of having separate statement types for each construct, we treat
 * most things as expressions. This matches how modern languages work.
 *
 * Examples:
 *   a = b           -> expr (with = operator, not assignment_statement)
 *   myFunc()        -> expr (function_call)
 *   x++             -> expr (postfix operator)
 *   set a = b       -> set_statement (legacy JASS keyword)
 *   call myFunc()   -> call_statement (legacy JASS keyword)
 *
 * OPERATOR PRECEDENCE:
 * Note: In JASS, 'or' has HIGHER precedence than 'and' (unusual!)
 * So: false and true or true  =  false and (true or true)  =  false
 *
 * BLOCK NESTING:
 * Blocks (globals, function, etc.) can be nested anywhere for maximum flexibility.
 * This allows parsing incomplete/malformed code for IDE support.
 *
 * ERROR RECOVERY:
 * When blocks are unclosed (e.g., 'function' without 'endfunction'),
 * tree-sitter automatically creates MISSING nodes that IDE can use for hints.
 */

// Operator precedence (higher = tighter binding)
const PREC = {
    ASSIGNMENT: 1,      // = (lowest precedence)
    LOGICAL_AND: 12,    // and
    LOGICAL_OR: 13,     // or (higher than AND in JASS - unusual!)
    EQUALITY: 14,       // == !=
    RELATIONAL: 15,     // < > <= >=
    ADDITIVE: 16,       // + -
    MULTIPLICATIVE: 17, // * /
    UNARY: 18,          // not - + ++ --
    POSTFIX: 19,        // ++ --
    CALL: 20,           // function_call: id(...)
    SUBSCRIPT: 21,      // [] (highest precedence)

    // Grammar-structural precedences (use these instead of magic numbers)
    STATEMENT: 15,      // precedence for generic statements over expr
    BLOCK: 20,          // precedence for block constructs (function/globals)
}

module.exports = grammar({
    name: 'jass',

    externals: $ => [
        $.comment,
        $._string_content,
        $.escape_sequence,
        $.rawcode,
        $._id_token,
        // Virtual closing tokens emitted by scanner when a closing keyword
        // for an outer block is seen while an inner block is still open.
        // Zero-width tokens that let tree-sitter close inner blocks first.
        $._virtual_endloop,
        $._virtual_endglobals,
        $._virtual_endfunction,
        $._virtual_endif,
    ],

    extras: $ => [/\n/, /\s/, $.comment],


    conflicts: $ => [
        [$.var_stmt, $.expr],
    ],

    rules: {
        program: $ => repeat($._statement),


        // Identifier: defined in external scanner to exclude keywords.
        // External scanner returns ID_TOKEN only for non-keyword words.
        // Keywords are rejected, forcing tree-sitter to match them as keyword tokens.
        id: $ => $._id_token,

        _statement: $ => choice(
            $.globals,
            $.function_statement,
            $.native_statement,
            $.type_statement,
            $.if_statement,
            $.loop_statement,
            $.return_statement,
            $.exitwhen_statement,
            $.local_statement,
            $.var_stmt,
            $.set_statement,
            $.call_statement,
            $.expr
        ),

        loop_statement: $ => seq(
            'loop',
            repeat($._statement),
            choice('endloop', $._virtual_endloop)
        ),

        var_stmt: $ => prec.dynamic(1, seq(
            optional('constant'),
            field('type', $.id),
            optional('array'),
            $.var_decl,
            repeat(seq(',', $.var_decl))
        )),

        var_decl: $ => seq(
            field('name', $.id),
            optional(seq('=', field('value', $.expr)))
        ),

        expr: $ => choice(
            $.number,
            $.rawcode,
            $.float,
            $.string,
            $.id,
            $.function_ref,
            // Parenthesized expression for grouping: (a + b)
            $.parens,
            // Function call: expr(args) — like subscript, call is a postfix operator
            $.function_call,
            prec.right(PREC.ASSIGNMENT, seq($.expr, '=', $.expr)),
            prec.left(PREC.CALL, seq($.expr, '[', $.expr, ']')),
            prec.left(PREC.POSTFIX, seq($.expr, '++')),
            prec.left(PREC.POSTFIX, seq($.expr, '--')),
            prec.right(PREC.UNARY, seq('++', $.expr)),
            prec.right(PREC.UNARY, seq('--', $.expr)),
            prec.right(PREC.UNARY, seq('not', $.expr)),
            prec.right(PREC.UNARY, seq('-', $.expr)),
            prec.right(PREC.UNARY, seq('+', $.expr)),
            prec.left(PREC.MULTIPLICATIVE, seq($.expr, '*', $.expr)),
            prec.left(PREC.MULTIPLICATIVE, seq($.expr, '/', $.expr)),
            prec.left(PREC.ADDITIVE, seq($.expr, '+', $.expr)),
            prec.left(PREC.ADDITIVE, seq($.expr, '-', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '<', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '>', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '<=', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '>=', $.expr)),
            prec.left(PREC.EQUALITY, seq($.expr, '==', $.expr)),
            prec.left(PREC.EQUALITY, seq($.expr, '!=', $.expr)),
            prec.left(PREC.LOGICAL_AND, seq($.expr, 'and', $.expr)),
            prec.left(PREC.LOGICAL_OR, seq($.expr, 'or', $.expr))
        ),

        number: _ => {
            const separator = '_'
            const decimal = /[0-9]+/
            const hex = /[0-9a-fA-F]/
            const bin = /[01]/
            const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))))
            const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))))
            const binDigits = seq(repeat1(bin), repeat(seq(separator, repeat1(bin))))

            return token(seq(
                choice(
                    decimalDigits,
                    // $ is a JASS synonym for 0x: $AABBCCDD === 0xAABBCCDD
                    seq(choice(/0[xX]/, '$'), hexDigits),
                    seq(/0[bB]/, binDigits),
                ),
                optional(/([lL]|[uU][lL]?)/),
            ))
        },

        // Floating-point literals: 1.2, .3, 4., 1e5, 1.2e-3
        // All three dot forms are valid: digits.digits, .digits, digits.
        float: _ => {
            const separator = '_'
            const decimal = /[0-9]+/
            const exponent = /[eE][+-]?[0-9]+/
            const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))))

            return token(seq(
                choice(
                    // 1e5, 1E-3 (integer with exponent)
                    seq(decimalDigits, exponent, optional(/[fF]/)),
                    // .3, .3e5 (leading dot, digits required after)
                    seq('.', decimalDigits, optional(exponent), optional(/[fF]/)),
                    // 1.2, 1.2e5 (digits, dot, digits)
                    seq(decimalDigits, '.', decimalDigits, optional(exponent), optional(/[fF]/)),
                    // 4. (trailing dot, no digits after)
                    seq(decimalDigits, '.'),
                    // 1f (integer with float suffix)
                    seq(decimalDigits, /[fF]/),
                ),
            ))
        },

        // FourCC / rawcode integer literal: 'xxxx' (4 chars packed into 32-bit int)
        // No escape sequences, newlines allowed — handled by external scanner

        // String literal in double quotes with \\, \", \n and \r escape sequences
        string: $ => seq('"', repeat(choice($._string_content, $.escape_sequence)), '"'),

        // Helper: comma-separated list of identifiers
        _id_list: $ =>
            seq($.id, repeat(seq(',', $.id))),

        return_statement: $ => prec.right(seq('return', optional($.expr))),

        exitwhen_statement: $ => seq('exitwhen', $.expr),

        local_statement: $ => seq(
            'local',
            optional('constant'),
            field('type', $.id),
            optional('array'),
            field('name', $.id),
            optional(seq('=', field('value', $.expr)))
        ),

        set_statement: $ => seq(
            'set',
            field('variable', $.id),
            optional(seq('[', field('index', $.expr), ']')),
            '=',
            field('value', $.expr)
        ),

        call_statement: $ => prec(PREC.STATEMENT, seq('call', $.function_call)),

        if_statement: $ => seq(
            'if',
            optional(field('condition', $.expr)),
            'then',
            repeat($._statement),
            repeat(seq(
                'elseif',
                optional(field('condition', $.expr)),
                'then',
                repeat($._statement)
            )),
            optional(seq('else', repeat($._statement))),
            choice('endif', $._virtual_endif)
        ),

        native_statement: $ => seq(
            optional('constant'),
            'native',
            field('name', $.id),
            'takes',
            field('parameters', choice('nothing', $.parameter_list)),
            'returns',
            field('return_type', choice('nothing', $.id))
        ),

        type_statement: $ => seq(
            'type',
            field('name', $.id),
            'extends',
            field('base', $.id)
        ),

        function_statement: $ => seq(
            'function',
            field('name', $.id),
            'takes',
            field('parameters', choice('nothing', $.parameter_list)),
            'returns',
            field('return_type', choice('nothing', $.id)),
            repeat($._statement),
            choice('endfunction', $._virtual_endfunction)
        ),

        globals: $ => seq(
            'globals',
            repeat($._statement),
            choice('endglobals', $._virtual_endglobals)
        ),

        parameter_list: $ =>
            seq(
                $.parameter,
                repeat(seq(',', $.parameter))
            ),

        parameter: $ =>
            seq(
                field('type', $.id),
                field('name', $.id)
            ),

        // FUNCTION REFERENCE
        // ==================
        // 'function Name' expression — passes a function as a value (code type)
        // Example: call TimerStart(t, 0.035, true, function MyCallback)
        function_ref: $ => seq('function', field('name', $.id)),

        // PARENTHESIZED EXPRESSION
        // ========================
        // Grouping: (expr) — NOT a function call, just precedence grouping
        parens: $ => seq('(', $.expr, ')'),

        // FUNCTION CALLS
        // ==============
        // Function call expression: expr(arg1, arg2, ...)
        // This is a postfix operator on expr, like subscript expr[i]
        function_call: $ =>
            prec.left(PREC.CALL, seq(
                field('name', $.expr),
                '(',
                field('args', optional($.function_arguments)),
                ')'
            )),

        // Function arguments: expr, expr, ...
        function_arguments: $ =>
            seq($.expr, repeat(seq(',', $.expr))),
    }
});
