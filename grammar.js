const PREC = {
    ASSIGNMENT: 1,      // = (lowest)
    LOGICAL_AND: 12,    // and (lower in JASS)
    LOGICAL_OR: 13,     // or (higher in JASS)
    EQUALITY: 14,       // == !=
    RELATIONAL: 15,     // < > <= >=
    ADDITIVE: 16,       // + -
    MULTIPLICATIVE: 17, // * /
    UNARY: 18,          // not - + ++ --
    POSTFIX: 19,        // ++ --
    SUBSCRIPT: 20,      // []
}

module.exports = grammar({
    name: 'jass',

    word: $ => $.id,

    extras: $ => [/\n/, /\s/, $.comment],


    conflicts: $ => [
        [$.expr, $.function_call],
        [$.loop_statement],
        [$.if_statement],
    ],

    rules: {
        program: $ => repeat($._block),

        id: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

        _block: $ => choice(
            $.globals,
            $.function_statement,
            $.native_statement,
            $.type_statement,
        ),

        _statement: $ => choice(
            $.if_statement,
            $.loop_statement,
            $.return_statement,
            $.exitwhen_statement,
            $.local_statement,
            $.expr
        ),

        loop_statement: $ =>
            seq(
                'loop',
                repeat($._statement),
                optional('endloop')
            ),

        globals: $ => seq(
            'globals',
            repeat($.var_stmt),
            optional('endglobals')
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
            prec.left(PREC.LOGICAL_OR, seq($.expr, 'or', $.expr)),

            // Assignment operator (lowest precedence)
            prec.right(PREC.ASSIGNMENT, seq($.expr, '=', $.expr))
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

        string: _ => token(seq(
            '"',
            repeat(choice(
                /[^"\\]/,
                seq('\\', /./)
            )),
            '"'
        )),

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
                optional('endif')
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
                optional('endfunction')
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

        // }}}

        // Function {{{
        function_call: $ =>
            seq(
                field('name', $.id),
                '(',
                field('args', optional($.function_arguments)),
                ')'
            ),

        function_arguments: $ =>
            seq($.expr, repeat(seq(',', $.expr))),

        // }}}


        // Comments
        comment: _ => token(choice(
            seq('//', /[^\r\n]*/),
            seq('/*', /[^*]*\*+(?:[^/*][^*]*\*+)*/, '/')
        )),
        // }}}
    },
})