# tree-sitter-jass

[![npm](https://img.shields.io/npm/v/tree-sitter-jass.svg)](https://www.npmjs.com/package/tree-sitter-jass)
[![crates.io](https://img.shields.io/crates/v/tree-sitter-jass.svg)](https://crates.io/crates/tree-sitter-jass)

A Tree-sitter grammar for the JASS programming language.

JASS (Just Another Scripting Syntax) is a scripting language used in Warcraft III for creating custom maps and
modifications. This grammar provides full syntax analysis and incremental parsing capabilities for pure JASS code (
without vJASS extensions).

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [JASS Language Reference](#jass-language-reference)
    - [Comments](#comments)
    - [Types](#types)
    - [Variables](#variables)
    - [Literals](#literals)
    - [Operators](#operators)
    - [Control Flow](#control-flow)
    - [Functions](#functions)
    - [Globals](#globals)
- [Development](#development)
- [License](#license)

## Features

- 🌳 Complete syntax parsing for JASS code
- 🚀 Incremental parsing for fast change processing
- 🔍 Syntax highlighting support
- 📦 Available for Node.js and Rust
- 🎯 Accurate scope and structure detection
- ⚡ High-performance parsing with Tree-sitter

## Installation

### Node.js

```bash
npm install tree-sitter-jass
```

### Rust

```toml
[dependencies]
tree-sitter-jass = "0.1.0"
```

## Usage

### Node.js

```javascript
const Parser = require('tree-sitter');
const JASS = require('tree-sitter-jass');

const parser = new Parser();
parser.setLanguage(JASS);

const sourceCode = `
globals
    integer myVar = 0
endglobals

function HelloWorld takes nothing returns nothing
    call BJDebugMsg("Hello, World!")
endfunction
`;

const tree = parser.parse(sourceCode);
console.log(tree.rootNode.toString());
```

### Rust

```rust
use tree_sitter::Parser;
use tree_sitter_jass::language;

fn main() {
    let mut parser = Parser::new();
    parser.set_language(&language()).expect("Error loading JASS grammar");

    let source_code = r#"
    globals
        integer myVar = 0
    endglobals
    "#;

    let tree = parser.parse(source_code, None).unwrap();
    println!("{}", tree.root_node().to_sexp());
}
```

## JASS Language Reference

This section provides a complete description of the JASS programming language syntax and features.

### Comments

JASS supports two types of comments:

#### Single-line Comments

```jass
// This is a single-line comment
```

### Types

JASS has several built-in primitive types:

- `integer` - 32-bit signed integer
- `real` - floating-point number
- `boolean` - true/false value
- `string` - text string
- `code` - function reference
- `handle` - base type for game objects

#### Handle Types

Handle types represent game objects and extend from the base `handle` type:

- `unit` - game unit
- `player` - player reference
- `location` - map location
- `trigger` - event trigger
- `timer` - timer object
- `group` - unit group
- And many more...

#### Array Types

Arrays in JASS are declared with the `array` keyword:

```jass
integer array myNumbers
unit array myUnits
```

Arrays are 1-dimensional and 0-indexed with a fixed size of 8192 elements.

### Variables

#### Variable Declaration

```jass
integer count
real distance
boolean isAlive
string message
unit myUnit
```

#### Variable Modifiers

- `local` - declares a local variable inside a function
- `constant` - declares a constant (read-only) variable
- `array` - declares an array variable

```jass
local integer i = 0
constant real PI = 3.14159
integer array myData
constant integer MAX_UNITS = 100
```

#### Variable Assignment

```jass
set count = 10
set distance = 150.5
set isAlive = true
set message = "Hello"
```

### Literals

#### Integer Literals

```jass
42              // Decimal
0x2A            // Hexadecimal
0b101010        // Binary
1_000_000       // With separators
```

Integer literals can have suffixes:

- `l` or `L` - long integer
- `u` or `U` - unsigned integer
- `ul` or `UL` - unsigned long

#### Real (Float) Literals

```jass
3.14            // Decimal point
2.5e10          // Scientific notation
1.0f            // Float suffix
.5              // Leading decimal point
```

#### Boolean Literals

```jass
true
false
```

#### String Literals

```jass
"Hello, World!"
"Escape sequences: \n \t \\ \""
```

#### Special Literals

```jass
null            // Null handle reference
nothing         // Used in function signatures
```

### Operators

#### Arithmetic Operators

```jass
a + b           // Addition
a - b           // Subtraction
a * b           // Multiplication
a / b           // Division
-a              // Unary negation
+a              // Unary plus
```

#### Comparison Operators

```jass
a == b          // Equal
a != b          // Not equal
a < b           // Less than
a > b           // Greater than
a <= b          // Less than or equal
a >= b          // Greater than or equal
```

#### Logical Operators

```jass
a and b         // Logical AND
a or b          // Logical OR
not a           // Logical NOT
```

#### Assignment Operators

```jass
set a = b       // Simple assignment
```

#### Increment/Decrement Operators

```jass
a++             // Postfix increment
a--             // Postfix decrement
++a             // Prefix increment
--a             // Prefix decrement
```

#### Member Access Operators

```jass
array[index]    // Array subscript
```

#### Function Call Operator

```jass
call FunctionName(arg1, arg2)
```

#### Operator Precedence

From highest to lowest precedence:

1. Postfix: `++`, `--`, `.`, `[]`, `()`
2. Prefix: `++`, `--`, `not`, `-`, `+`
3. Multiplicative: `*`, `/`
4. Additive: `+`, `-`
5. Relational: `<`, `>`, `<=`, `>=`
6. Equality: `==`, `!=`
7. Logical OR: `or`
8. Logical AND: `and`
9. Assignment: `=`
10. Comma: `,`

**Important note:** In JASS, `or` has higher precedence than `and`. This means:
```jass
// false and true or true evaluates as: false and (true or true) = false
// NOT as: (false and true) or true = true
```

### Control Flow

#### If Statement

```jass
if condition then
    // code
endif

if condition then
    // code
else
    // code
endif

if condition1 then
    // code
elseif condition2 then
    // code
else
    // code
endif
```

#### Loop Statement

```jass
loop
    // code
    exitwhen condition
endloop
```

#### Loop Control

```jass
exitwhen condition  // Exit loop when condition is true
return              // Return from function
```

### Functions

#### Function Declaration

```jass
function FunctionName takes ParameterType paramName returns ReturnType
    // function body
endfunction
```

#### Function with No Parameters

```jass
function HelloWorld takes nothing returns nothing
    call BJDebugMsg("Hello, World!")
endfunction
```

#### Function with Parameters

```jass
function Add takes integer a, integer b returns integer
    return a + b
endfunction
```

#### Function with Multiple Return Types (not supported in standard JASS)

Standard JASS supports only single return values.

#### Function Calls

```jass
call FunctionName(arg1, arg2)
set result = FunctionName(arg1, arg2)
```

#### Native Functions

Native functions are declared but not defined (implemented in game engine):

```jass
native FunctionName takes ParameterTypes returns ReturnType
```

Example:

```jass
native CreateUnit takes player id, integer unitid, real x, real y, real face returns unit
```

### Globals

Global variables are declared in a globals block:

```jass
globals
    integer count = 0
    real PI = 3.14159
    constant integer MAX_PLAYERS = 12
    unit array playerUnits
    boolean gameStarted = false
endglobals
```

Features of globals:

- Can be declared with or without initialization
- Support `constant` modifier for read-only values
- Support `array` modifier for array declarations
- Accessible from any function in the script

### Types and Type Extensions

#### Type Declarations

JASS allows creating type aliases for existing types:

```jass
type mytype extends handle
type unitcode extends integer
```

Type extensions create new type names that inherit from base types. This is mainly used for type safety and code
organization.

### Complete Example

Here's a complete JASS script demonstrating various language features:

```jass
//============================================================================
// Complete JASS Example
//============================================================================

globals
    // Constants
    constant real PI = 3.14159
    constant integer MAX_UNITS = 100
    
    // Variables
    integer unitCount = 0
    unit array playerUnits
    boolean gameStarted = false
endglobals

//============================================================================
// Native function declarations
//============================================================================
native CreateUnit takes player id, integer unitid, real x, real y, real face returns unit
native BJDebugMsg takes string msg returns nothing

//============================================================================
// Helper function to calculate distance
//============================================================================
function GetDistance takes real x1, real y1, real x2, real y2 returns real
    local real dx = x2 - x1
    local real dy = y2 - y1
    return SquareRoot(dx * dx + dy * dy)
endfunction

//============================================================================
// Function with control flow
//============================================================================
function ProcessUnits takes nothing returns nothing
    local integer i = 0
    
    loop
        exitwhen i >= unitCount
        
        if playerUnits[i] != null then
            // Process unit
            call BJDebugMsg("Processing unit: " + I2S(i))
        endif
        
        set i = i + 1
    endloop
endfunction

//============================================================================
// Type extensions
//============================================================================
type unitcode extends integer
type destructablecode extends integer

//============================================================================
// Function using custom types
//============================================================================
function CreateUnitAtLoc takes player whichPlayer, unitcode unitId, location loc returns unit
    return CreateUnit(whichPlayer, unitId, GetLocationX(loc), GetLocationY(loc), 0.0)
endfunction

//============================================================================
// Main initialization
//============================================================================
function InitGame takes nothing returns nothing
    set gameStarted = true
    set unitCount = 0
    call BJDebugMsg("Game initialized!")
endfunction
```

## Development

### Requirements

- Node.js >= 14
- Rust >= 1.70 (optional, for Rust bindings)
- tree-sitter-cli

### Setup

```bash
npm install
```

### Generate Parser

```bash
npm run generate
# or
./generate.sh
```

### Run Playground

```bash
npm start
```

This opens an interactive playground for testing the grammar in your browser.

### Testing

```bash
npm test
```

### Project Structure

```
tree-sitter-jass/
├── grammar.js          # Grammar definition
├── src/
│   ├── parser.c        # Generated parser (C)
│   ├── grammar.json    # Intermediate grammar representation
│   └── node-types.json # AST node types
├── bindings/
│   ├── node/           # Node.js bindings
│   └── rust/           # Rust bindings
├── queries/            # Syntax highlighting queries
├── package.json        # npm package metadata
└── Cargo.toml          # Rust crate metadata
```

## License

MIT

## Author

nazarpunk <<nazarpunk@gmail.com>>

## Links

- [Tree-sitter](https://tree-sitter.github.io/)
- [Warcraft III Modding](https://www.hiveworkshop.com/)
- [JASS Manual](https://www.wc3c.net/)