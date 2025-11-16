# JASS Grammar Tests

This directory contains the test corpus for the JASS tree-sitter grammar.

## Running Tests

To run all tests:

```bash
tree-sitter test
```

To run tests for a specific file:

```bash
tree-sitter test -f <test-name>
```

For example:

```bash
tree-sitter test -f "Function - with parameters"
```

## Test Structure

Tests are organized into the following files:

### `statements.txt`
Tests for JASS statements and top-level constructs:
- Comments
- Globals blocks
- Native declarations
- Type declarations
- Functions
- Control flow (if, loop)
- Statements (set, call, return, exitwhen)

### `literals.txt`
Tests for literal values:
- Integer literals (decimal, hexadecimal, binary, with separators)
- Float literals (decimal, scientific notation, with suffix)
- Boolean literals (true, false)
- Null literal
- Identifiers

### `expressions.txt`
Tests for expressions and operators:
- Arithmetic operators (+, -, *, /)
- Unary operators (-, +, not)
- Comparison operators (==, !=, <, >, <=, >=)
- Logical operators (and, or, not)
- Increment/decrement operators (++, --)
- Array subscript
- Function calls in expressions
- Operator precedence

## Test Format

Each test follows this format:

```
==================
Test Name
==================

<JASS code to parse>

---

<Expected AST structure>
```

## Test Results

Current status: **54/54 tests passing** ✓

- Success rate: 100%
- Average parsing speed: ~11,411 bytes/ms

## Writing New Tests

When adding new tests:

1. Choose the appropriate file based on what you're testing
2. Follow the existing format
3. Run `tree-sitter test` to verify
4. Check the AST structure with `tree-sitter parse <file>`

Example workflow:

```bash
# Write your JASS code
echo 'function Test takes nothing returns nothing
    call MyFunction()
endfunction' > /tmp/test.jass

# Check how it parses
tree-sitter parse /tmp/test.jass

# Add the test with the correct AST structure to the corpus
```

## Notes

- JASS only supports single-line comments (`//`), not block comments
- String literals are supported but must be tested carefully
- Operator precedence: `or` has **higher** precedence than `and` in JASS
- Array subscripts in `set` statements use a special syntax
