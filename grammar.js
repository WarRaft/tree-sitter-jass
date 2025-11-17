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
}

module.exports = grammar({
    name: 'jass',

    word: $ => $.id,

    extras: $ => [/\n/, /\s/, $.comment],


    conflicts: $ => [
        [$.expr, $.function_call],
        [$.var_stmt, $.expr],
        [$.globals],
        [$.function_statement],
        [$.loop_statement],
        [$.if_statement],
    ],

    rules: {
        program: $ => repeat($._statement),

        id: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

        // STATEMENT RULES
        // ================
        // Everything is either:
        // 1. A BLOCK statement (defines scope: globals, function, if, loop)
        // 2. A KEYWORD statement (starts with keyword: return, local, set, call)
        // 3. An EXPRESSION (everything else: assignments, function calls, etc.)
        //
        // This is the key design decision: we don't create special statement types
        // for assignments or function calls. They're just expressions that can be
        // used as statements.
        _statement: $ => choice(
            // Block statements (keywords that define scope)
            $.globals,
            $.function_statement,
            $.native_statement,
            $.type_statement,
            $.if_statement,
            $.loop_statement,

            // Keyword-prefixed statements
            $.return_statement,
            $.exitwhen_statement,
            $.local_statement,
            $.var_stmt,
            $.set_statement,
            $.call_statement,

            // Expression statements (everything else is just an expression)
            // Examples: a = b, myFunc(), x++, a[5] = 10, etc.
            $.expr
        ),

        // BLOCK NESTING
        // ==============
        // Blocks can be nested ANYWHERE for maximum flexibility.
        // This is intentionally permissive to support:
        // - Incomplete code during editing
        // - Error recovery
        // - IDE autocomplete
        //
        // Real JASS doesn't allow 'function' inside 'globals', but we parse it
        // anyway so the IDE can provide good error messages and suggestions.
        _block: $ => choice(
            $.globals,
            $.function_statement,
            $.native_statement,
            $.type_statement
        ),

        // Statements allowed inside loop blocks
        // Note: includes all blocks (_block) and expressions
        _loop_statement: $ => choice(
            $._block,
            $.if_statement,
            $.loop_statement,
            $.return_statement,
            $.exitwhen_statement,
            $.local_statement,
            $.set_statement,
            $.call_statement,
            $.expr              // Any expression can be a statement
        ),

        // Statements allowed inside globals blocks
        // Note: var_stmt is only allowed here, plus everything from loops
        _globals_statement: $ => choice(
            $.var_stmt,          // Variable declarations
            $._loop_statement    // Everything else
        ),

        // BLOCK STATEMENTS
        // ================
        // All blocks require closing keywords (endloop, endglobals, etc.)
        // When missing, tree-sitter creates MISSING nodes for error recovery

        loop_statement: $ =>
            seq(
                'loop',
                repeat($._loop_statement),
                'endloop'           // Required: creates MISSING node if absent
            ),

        globals: $ => seq(
            'globals',
            repeat($._globals_statement),
            'endglobals'            // Required: creates MISSING node if absent
        ),

        var_stmt: $ =>
            seq(
                optional('constant'),
                field('type', $.id),
                optional('array'),
                $.var_decl,
                repeat(seq(',', $.var_decl))
            ),

        var_decl: $ =>
            seq(
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

        // String literals with escape sequences
        string: _ => token(seq(
            '"',
            repeat(choice(
                /[^"\\]/,
                seq('\\', /./)
            )),
            '"'
        )),

        // Helper: comma-separated list of identifiers
        _id_list: $ =>
            seq($.id, repeat(seq(',', $.id))),

        // Keyword-based statements
        return_statement: $ =>
            prec.right(seq('return', optional($.expr))),

        exitwhen_statement: $ =>
            seq('exitwhen', $.expr),

        // Variable declaration with 'local' keyword
        local_statement: $ =>
            seq(
                'local',
                optional('constant'),
                field('type', $.id),
                optional('array'),
                field('name', $.id),
                optional(seq('=', field('value', $.expr)))
            ),

        // Legacy 'set' statement for assignment
        set_statement: $ =>
            seq(
                'set',
                field('variable', $.id),
                optional(seq('[', field('index', $.expr), ']')),
                '=',
                field('value', $.expr)
            ),

        // 'call' statement for function calls
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
                repeat($._statement),
                repeat(
                    seq(
                        'elseif',
                        optional(field('condition', $.expr)),
                        'then',
                        repeat($._statement)
                    )
                ),
                optional(seq('else', repeat($._statement))),
                'endif'
            ),

        function_start: () => 'function',

        // Native function declaration
        native_statement: $ =>
            seq(
                'native',
                field('name', $.id),
                'takes',
                field('parameters', choice('nothing', $.parameter_list)),
                'returns',
                field('return_type', choice('nothing', $.id))
            ),

        // Type declaration
        type_statement: $ =>
            seq(
                'type',
                field('name', $.id),
                'extends',
                field('base', $.id)
            ),

        function_statement: $ =>
            seq(
                'function',
                field('name', $.id),
                'takes',
                field('parameters', choice('nothing', $.parameter_list)),
                'returns',
                field('return_type', choice('nothing', $.id)),
                repeat($._statement),
                'endfunction'
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

        // COMMENTS
        // ========
        // JASS only supports single-line comments starting with //
        // Multi-line /* */ comments are NOT supported (unlike C/Java)
        comment: _ => token(seq('//', /[^\r\n]*/)),
    },
})