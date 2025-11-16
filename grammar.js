const PREC = {
    COMMA: -1,
    FUNCTION: 1,
    DEFAULT: 1,
    PRIORITY: 2,

    BIT_OR: 6, // => |
    BIT_NOT: 7, // => ~
    BIT_AND: 8, // => &
    SHIFT: 9, // => << >>
    CONCAT: 10, // => ..
    PLUS: 11, // => + -
    MULTI: 12, // => * /             // %
    UNARY: 13, // => not # - ~
    POWER: 14, // => ^

    STATEMENT: 15,
    PROGRAM: 16,
}

module.exports = grammar({
    name: 'jass',

    externals: $ => [
        $._block_comment_start,
        $._block_comment_content,
        $._block_comment_end,

        $._string_start,
        $._string_content,
        $._string_end,
    ],
    extras: $ => [/\n/, /\s/, $.comment],

    inline: $ => [
        //$.expr,
        //$.field_separator,
        //$.prefix_exp,
        //$.function_impl,
        $.comment,
    ],

    conflicts: $ => [
        [$.id, $.keywords],
        [$.expr, $.function_call]
    ],

    rules: {
        program: $ => repeat($._block),

        id: _ => token(prec(-1, /[a-zA-Z_][a-zA-Z0-9_]*/)),
        keywords: _ => choice(
            'globals', 'endglobals',
            'function', 'endfunction',
            'native',
            'type', 'extends',
            'if', 'then', 'else', 'elseif', 'endif',
            'loop', 'endloop',
            'set', 'call', 'return', 'exitwhen',
            'local', 'constant', 'array',
            'takes', 'returns', 'nothing',
            'and', 'or', 'not'
        ),

        _block: $ => choice(
            $.globals,
            $.function_statement,
            $.native_statement,
            $.type_statement,
        ),

        globals: $ => seq(
            'globals',
            repeat($.var_stmt),
            'endglobals'
        ),

        expr: $ => choice(
            $.id,
            $.number,
            $.float,
            $.string,
            $.function_call,

            // https://learn.microsoft.com/en-us/cpp/cpp/cpp-built-in-operators-precedence-and-associativity?view=msvc-170
            // Group 1 precedence, no associativity
            // Scope resolution	::

            // Group 2 precedence, left to right associativity
            prec.left(2, seq($.expr, '[', $.expr, ']')), // Array subscript	[]
            prec.left(2, seq('(', repeat($.expr), ')')), // Function call	()
            prec.left(2, seq($.expr, '++')), // Postfix increment	++
            prec.left(2, seq($.expr, '++')), // Postfix decrement	--
            // Type name	typeid
            // Constant type conversion	const_cast
            // Dynamic type conversion	dynamic_cast
            // Reinterpreted type conversion	reinterpret_cast
            // Static type conversion	static_cast

            // Group 3 precedence, right to left associativity
            // Size of object or type	sizeof
            prec.right(3, seq('++', $.expr)), // Prefix increment	++
            prec.right(3, seq('--', $.expr)),  // Prefix decrement	--
            // One's complement	~	compl
            prec.right(3, seq('not', $.expr)), // Logical not	!	not
            prec.right(3, seq('-', $.expr)),  // Unary negation	-
            prec.right(3, seq('+', $.expr)), // Unary plus	+
            // Address-of	&
            // Indirection	*
            // Create object	new
            // Destroy object	delete
            // Cast	()

            // Group 4 precedence, left to right associativity
            // Pointer-to-member (objects or pointers)	.* or ->*

            // Group 5 precedence, left to right associativity (HIGHER precedence in tree-sitter)
            prec.left(6, seq($.expr, '*', $.expr)), // Multiplication	*
            prec.left(6, seq($.expr, '/', $.expr)), // Division	/
            // Modulus	%

            // Group 6 precedence, left to right associativity (LOWER precedence in tree-sitter)
            prec.left(5, seq($.expr, '+', $.expr)), // Addition	+
            prec.left(5, seq($.expr, '-', $.expr)), // Subtraction	-

            // Group 7 precedence, left to right associativity
            // Left shift	<<
            // Right shift	>>

            // Group 8 precedence, left to right associativity
            prec.left(8, seq($.expr, '<', $.expr)), // Less than	<
            prec.left(8, seq($.expr, '>', $.expr)), // Greater than	>
            prec.left(8, seq($.expr, '<=', $.expr)), // Less than or equal to	<=
            prec.left(8, seq($.expr, '>=', $.expr)), // Greater than or equal to	>=

            // Group 9 precedence, left to right associativity
            prec.left(9, seq($.expr, '==', $.expr)), // Equality	==
            prec.left(9, seq($.expr, '!=', $.expr)), // Inequality	!=	not_eq

            // Group 10 precedence left to right associativity
            // Bitwise AND	&	bitand

            // Group 11 precedence, left to right associativity
            // Bitwise exclusive OR	^	xor

            // Group 12 precedence, left to right associativity
            // Bitwise inclusive OR	|	bitor

            // Group 13 precedence, left to right associativity
            prec.left(14 /* in JASS */, seq($.expr, 'and', $.expr)), // Logical AND	&&	and

            // Group 14 precedence, left to right associativity
            prec.left(13 /* in JASS */, seq($.expr, 'or', $.expr)), // Logical OR	||	or

            // Group 15 precedence, right to left associativity
            // Conditional	? :
            prec.right(15, seq($.expr, '=', $.expr)), // Assignment	=
            // Multiplication assignment	*=
            // Division assignment	/=
            // Modulus assignment	%=
            // Addition assignment	+=
            // Subtraction assignment	-=
            // Left-shift assignment	<<=
            // Right-shift assignment	>>=
            // Bitwise AND assignment	&=	and_eq
            // Bitwise inclusive OR assignment	|=	or_eq
            // Bitwise exclusive OR assignment	^=	xor_eq
            // throw expression	throw

            // Group 16 precedence, left to right associativity
            prec.left(16, seq($.expr, ',', $.expr)), // Comma

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

        var_stmt: $ =>
            seq(
                repeat(choice('local', 'constant')),
                field('type', $.id),
                optional('array'),
                $.var_decl,
                repeat(seq(',', $.var_decl))
            ),

        var_decl: $ => seq(
            field('name', $.id),
            optional(seq('=', $.expr))
        ),

        _var: $ =>
            choice(
                $.id,
                seq($.id, '[', $.expr, ']')
            ),

        string: $ =>
            seq(
                field('start', alias($._string_start, 'string_start')),
                field('content', optional(alias($._string_content, 'string_content'))),
                field('end', alias($._string_end, 'string_end'))
            ),

        _statement: $ =>
            choice(
                $.var_stmt,
                $.set_statement,
                $.call_statement,
                $.if_statement,
                $.loop_statement,
                $.return_statement,
                $.exitwhen_statement,
            ),

        unary_operation: $ =>
            prec.left(PREC.UNARY, seq(choice('not', '#', '-', '~'), $.expr)),

        _id_list: $ =>
            prec.right(PREC.COMMA, seq($.id, repeat(seq(/,\s*/, $.id)))),

        return_statement: $ =>
            prec.right(seq('return', optional($.expr))),

        exitwhen_statement: $ =>
            seq('exitwhen', $.expr),

        set_statement: $ =>
            seq(
                'set',
                field('variable', $.id),
                optional(seq('[', field('index', $.expr), ']')),
                '=',
                field('value', $.expr)
            ),

        call_statement: $ =>
            seq('call', $.function_call),

        // Blocks {{{
        loop_statement: $ =>
            seq(
                'loop',
                repeat($._statement),
                'endloop'
            ),

        if_statement: $ =>
            seq(
                'if',
                field('condition', $.expr),
                'then',
                repeat($._statement),
                repeat(
                    seq(
                        'elseif',
                        field('condition', $.expr),
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


        // Comments {{{
        // comment: ($) => choice(seq("--", /[^-].*\r?\n/), $._multi_comment),
        comment: $ =>
            choice(
                seq(
                    field('start', alias('//', 'comment_start')),
                    field('content', alias(/[^\r\n]*/, 'comment_content'))
                ),
                seq(
                    field('start', alias($._block_comment_start, 'comment_start')),
                    field(
                        'content',
                        optional(alias($._block_comment_content, 'comment_content'))
                    ),
                    field('end', alias($._block_comment_end, 'comment_end'))
                )
            ),
        // }}}
    },
})