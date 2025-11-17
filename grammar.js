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
    SUBSCRIPT: 20,      // [] (highest precedence)

    // Grammar-structural precedences (use these instead of magic numbers)
    STATEMENT: 15,      // precedence for generic statements over expr
    BLOCK: 20,          // precedence for block constructs (function/globals)
}

module.exports = grammar({
    name: 'jass',


    externals: $ => [
        $.id,
        $.comment,
        $._string_content
    ],

    extras: $ => [/\n/, /\s/, $.comment],

    conflicts: $ => [
        [$.var_stmt, $.expr],
    ],

    rules: {
        program: $ => repeat($._statement),


        _statement: $ => prec.right(PREC.STATEMENT, choice(
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
        )),

        // Use explicit block precedence for consistency
        loop_statement: $ => prec.right(PREC.BLOCK, seq(
            'loop',
            optional(repeat1($._statement)),
            'endloop'
        )),

        var_stmt: $ => seq(
            optional('constant'),
            field('type', $.id),
            optional('array'),
            $.var_decl,
            repeat(seq(',', $.var_decl))
        ),

        var_decl: $ => seq(
            field('name', $.id),
            optional(seq('=', field('value', $.expr)))
        ),

        expr: $ => choice(
            // Literals
            $.number,
            $.float,
            $.string,
            $.id,
            $.function_call,

            // Assignment operator (lowest precedence)
            prec.right(PREC.ASSIGNMENT, seq($.expr, '=', $.expr)),

            // Array subscript
            prec.left(PREC.SUBSCRIPT, seq($.expr, '[', $.expr, ']')),

            // Postfix operators
            prec.left(PREC.POSTFIX, seq($.expr, '++')),
            prec.left(PREC.POSTFIX, seq($.expr, '--')),

            // Prefix operators
            prec.right(PREC.UNARY, seq('++', $.expr)),
            prec.right(PREC.UNARY, seq('--', $.expr)),
            prec.right(PREC.UNARY, seq('not', $.expr)),
            prec.right(PREC.UNARY, seq('-', $.expr)),
            prec.right(PREC.UNARY, seq('+', $.expr)),

            // Multiplicative operators
            prec.left(PREC.MULTIPLICATIVE, seq($.expr, '*', $.expr)),
            prec.left(PREC.MULTIPLICATIVE, seq($.expr, '/', $.expr)),

            // Additive operators
            prec.left(PREC.ADDITIVE, seq($.expr, '+', $.expr)),
            prec.left(PREC.ADDITIVE, seq($.expr, '-', $.expr)),

            // Relational operators
            prec.left(PREC.RELATIONAL, seq($.expr, '<', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '>', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '<=', $.expr)),
            prec.left(PREC.RELATIONAL, seq($.expr, '>=', $.expr)),

            // Equality operators
            prec.left(PREC.EQUALITY, seq($.expr, '==', $.expr)),
            prec.left(PREC.EQUALITY, seq($.expr, '!=', $.expr)),

            // Logical operators
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
                    seq(/0[xX]/, hexDigits),
                    seq(/0[bB]/, binDigits),
                ),
                optional(/([lL]|[uU][lL]?)/),
            ))
        },

        float: _ => {
            const separator = '_'
            const decimal = /[0-9]+/
            const exponent = /[eE][+-]?[0-9]+/
            const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))))

            return token(seq(
                choice(
                    seq(decimalDigits, exponent, optional(/[fF]/)),
                    seq(optional(decimalDigits), '.', repeat1(decimalDigits), optional(exponent), optional(/[fF]/)),
                    seq(decimalDigits, /[fF]/),
                ),
            ))
        },

        // String literals with escape sequences handled by external scanner
        string: $ => seq('"', optional($._string_content), '"'),

        // Helper: comma-separated list of identifiers
        _id_list: $ =>
            seq($.id, repeat(seq(',', $.id))),

        return_statement: $ =>
            prec.right(seq('return', optional($.expr))),

        exitwhen_statement: $ =>
            seq('exitwhen', $.expr),

        local_statement: $ =>
            seq(
                'local',
                optional('constant'),
                field('type', $.id),
                optional('array'),
                field('name', $.id),
                optional(seq('=', field('value', $.expr)))
            ),

        set_statement: $ =>
            seq(
                'set',
                field('variable', $.id),
                optional(seq('[', field('index', $.expr), ']')),
                '=',
                field('value', $.expr)
            ),

        call_statement: $ =>
            seq(
                'call',
                $.function_call
            ),

        if_statement: $ =>
            seq(
                'if',
                optional(field('condition', $.expr)),
                'then',
                optional(repeat1($._statement)),
                repeat(
                    seq(
                        'elseif',
                        optional(field('condition', $.expr)),
                        'then',
                        optional(repeat1($._statement))
                    )
                ),
                optional(seq('else', optional(repeat1($._statement)))),
                'endif'
            ),

        native_statement: $ =>
            seq(
                'native',
                field('name', $.id),
                'takes',
                field('parameters', choice('nothing', $.parameter_list)),
                'returns',
                field('return_type', choice('nothing', $.id))
            ),

        type_statement: $ =>
            seq(
                'type',
                field('name', $.id),
                'extends',
                field('base', $.id)
            ),

        function_statement: $ => prec.right(PREC.BLOCK, seq(
                'function',
                field('name', $.id),
                'takes',
                field('parameters', choice('nothing', $.parameter_list)),
                'returns',
                field('return_type', choice('nothing', $.id)),
                optional(repeat1($._statement)),
                'endfunction'
            )),

        globals: $ => prec.right(PREC.BLOCK, seq(
            'globals',
            optional(repeat1($._statement)),
            'endglobals'
        )),

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

        // FUNCTION CALLS
        // ==============
        // Function call expression: name(arg1, arg2, ...)
        // This is an EXPRESSION, so it can be used anywhere expressions are allowed
        function_call: $ =>
            seq(
                field('name', $.id),
                '(',
                field('args', optional($.function_arguments)),
                ')'
            ),

        // Function arguments: expr, expr, ...
        function_arguments: $ =>
            seq($.expr, repeat(seq(',', $.expr))),
    }
});
