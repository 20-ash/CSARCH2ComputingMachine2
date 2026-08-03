# CSARCH2 Computing Machine 2 - IEEE 754 Binary Single-precision

## 1. Project Overview

### A web-based simulator that implements IEEE 754 binary single-precision floating-point conversion that does the following:

* Accepts a decimal input and converts it into its 32-bit IEEE 754 binary and hexadecimal representation.  rounding methods (truncation and round-up) and IEEE 754 arithmetic (addition and multiplication).
* Accept a decimal or a binary input along with the target number of bits for rounding. App outputs the various rounding operations via truncation, round-up, round-down, and round-to-nearest ties-to-even.
* Accept two operands, either both decimal or  both IEEE hexadecimal then another input indicating the operation. App outputs the step-by-step solution in binary, hexadecimal, and decimal representations.

### Implementation found in `backend.ts`

## 2. Analysis Write-Up

### 2.1. Conversion Methods

| Stage | Function | Responsibility |
|---|---|---|
| Sign | `determineSign` | Returns 1 if negative or `-0`, else 0 |
| Integer part | `convertWhole` | Repeatedly divides by 2, collecting remainders (LSB first), then reverses |
| Fraction part | `convertFrac` | Repeatedly multiplies by 2, extracting the integer bit (with extra guard/round/sticky bits) |
| Normalize | `normalize` | Shifts the binary point so one significant digit precedes it; computes unbiased exponent and mantissa |
| Round | `roundMantissa` | Round-to-nearest, ties-to-even; propagates carry and signals overflow |
| Exponent encode | `determineExponentBits` | Adds bias 127; handles subnormal (all 0s) and infinity (all 1s) |
| Assemble | `buildBinary` / `buildHex` | Concatenates 1+8+23 bits, formats in nibbles, converts to hex |

### 2.2. Rounding Methods

The backend implements two rounding modes for both binary and decimal inputs:
- **Truncation** (`truncateBinary` / `truncateDec`): drops all bits/digits beyond the target precision, toward zero.
- **Round up** (`roundUpBinary` / `roundUpDec`): rounds toward positive infinity; negative values follow truncation rules for rounding toward positive infinity.

### 2.3. Arithmetic Methods

`ieeeAdd` and `ieeeMul` implement IEEE 754 addition and multiplication by unpacking the 32-bit operands, performing the operation on mantissas and exponents, then rounding and repacking.
**Addition pipeline:** unpack → align exponents (shift smaller mantissa right) → add/subtract mantissas → normalize → round → pack.
**Multiplication pipeline:** unpack → XOR sign bits → add (debias) exponents → multiply mantissas → normalize → round → pack.

## 3. Screenshots

WE APPEND OUR SCREENSHOTS.

## 4. Video Walkthrough

WE APPEND OUR VIDEO.
