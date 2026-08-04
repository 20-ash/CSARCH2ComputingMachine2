import { convert, convertFrac, convertWhole, determineSign, normalize, buildBinary, buildHex, determineExponentBits, roundingMethods, ieeeAdd, ieeeMul } from "./backend";

// Conversion
console.log(`Input 1: ${JSON.stringify(convert(1))}`);        // +1. × 2^0
console.log(`Input 2: ${JSON.stringify(convert(2))}`);        // +1. × 2^1
console.log(`Input 6: ${JSON.stringify(convert(6))}`);        // +1.10 × 2^2

// Simple fractions (clean binary)
console.log(`Input 0.5: ${JSON.stringify(convert(0.5))}`);
console.log(`Input 0.25: ${JSON.stringify(convert(0.25))}`);
console.log(`Input 6.25: ${JSON.stringify(convert(6.25))}`);

// Negative values
console.log(`Input -1: ${JSON.stringify(convert(-1))}`);
console.log(`Input -0.5: ${JSON.stringify(convert(-0.5))}`);
console.log(`Input -3.14: ${JSON.stringify(convert(-3.14))}`);

// Edge cases
console.log(`Input 0: ${JSON.stringify(convert(0))}`);
console.log(`Input -0: ${JSON.stringify(convert(-0))}`);

// Precision limit test (repeating binary)
console.log(`Input 0.1: ${JSON.stringify(convert(0.1))}`);
console.log(`Input 3.14: ${JSON.stringify(convert(3.14))}`);

// Larger values
console.log(`Input 10: ${JSON.stringify(convert(10))}`);
console.log(`Input -8.75: ${JSON.stringify(convert(-8.75))}`);


// Rounding Methods
// Binary - Whole Numbers
console.log(`Round Binary Unsigned Whole Tail>Mid (11101, target 2): ${JSON.stringify(roundingMethods("11101", "unsigned", "-1", "2", "binary"))}`);
console.log(`Round Binary Unsigned Whole Exact Tie (11101, target 2): ${JSON.stringify(roundingMethods("11101", "signed", "1", "2", "binary"))}`);

// Binary - Fractions & Tie Breaks (LSB Parity)
console.log(`Round Binary Tie to Odd LSB (1.011, target 2): ${JSON.stringify(roundingMethods("1.011", "unsigned", "-1", "2", "binary"))}`);
console.log(`Round Binary Tie to Even LSB (1.101, target 2): ${JSON.stringify(roundingMethods("1.101", "unsigned", "-1", "2", "binary"))}`);
console.log(`Round Binary Overflow Carry (1.111, target 2): ${JSON.stringify(roundingMethods("1.111", "unsigned", "-1", "2", "binary"))}`);
console.log(`Round Binary Leading Zeros (0.001101, target 2): ${JSON.stringify(roundingMethods("0.001101", "unsigned", "-1", "2", "binary"))}`);

// Binary Error
console.log(`Round Binary Unsigned Whole Exact Tie (11101, target 2): ${JSON.stringify(roundingMethods("aaa", "signed", "1", "2", "binary"))}`);

// Decimal - Positives & Tie Breaks
console.log(`Round Dec Positive Tail>5 (12.367, target 3): ${JSON.stringify(roundingMethods("12.367", "unsigned", "-1", "3", "decimal"))}`);
console.log(`Round Dec Tie to Even LSB (12.35, target 3): ${JSON.stringify(roundingMethods("12.35", "unsigned", "-1", "3", "decimal"))}`);
console.log(`Round Dec Tie to Odd LSB (12.45, target 3): ${JSON.stringify(roundingMethods("12.45", "unsigned", "-1", "3", "decimal"))}`);
console.log(`Round Dec Tie + Sticky (12.3501, target 3): ${JSON.stringify(roundingMethods("12.3501", "unsigned", "-1", "3", "decimal"))}`);

// Decimal - Negatives & Tie Breaks
console.log(`Round Dec Positive Tail>5 (12.367, target 3): ${JSON.stringify(roundingMethods("-12.367", "signed", "1", "3", "decimal"))}`);
console.log(`Round Dec Tie to Even LSB (12.35, target 3): ${JSON.stringify(roundingMethods("-12.35", "signed", "1", "3", "decimal"))}`);
console.log(`Round Dec Tie to Odd LSB (12.45, target 3): ${JSON.stringify(roundingMethods("-12.45", "signed", "1", "3", "decimal"))}`);
console.log(`Round Dec Tie + Sticky (12.3501, target 3): ${JSON.stringify(roundingMethods("-12.3501", "signed", "1", "3", "decimal"))}`);

// Decimal - Edge Cases (<1, Scientific, Large Integers)
console.log(`Round Dec Small Frac (0.00456, target 2): ${JSON.stringify(roundingMethods("0.00456", "unsigned", "-1", "2", "decimal"))}`);
console.log(`Round Dec Large Whole (123456, target 3): ${JSON.stringify(roundingMethods("123456", "unsigned", "-1", "3", "decimal"))}`);
console.log(`Round Dec Sci Notation (1.2345e2, target 3): ${JSON.stringify(roundingMethods("1.2345e2", "unsigned", "-1", "3", "decimal"))}`);

// Decimal Error
console.log(`Round Dec Sci Notation (1.2345e2, target 3): ${JSON.stringify(roundingMethods("aaa", "unsigned", "-1", "3", "decimal"))}`);

// IEEE-754 Inputs
console.log(`Round IEEE Hex (3DCCCCCD, target 2): ${JSON.stringify(roundingMethods("3DCCCCCD", "unsigned", "-1", "2", "ieee"))}`);
console.log(`Round IEEE 32-bit Binary (00111111110000000000000000000000, target 2): ${JSON.stringify(roundingMethods("00111111110000000000000000000000", "unsigned", "-1", "2", "ieee"))}`);
console.log(`Round IEEE Neg Hex (C0200000, target 2): ${JSON.stringify(roundingMethods("C0200000", "signed", "1", "2", "ieee"))}`);

// IEEE-754 Error
console.log(`Round IEEE Neg Hex (C0200000, target 2): ${JSON.stringify(roundingMethods("HHHHHHHH", "signed", "1", "2", "ieee"))}`);

// Edge / Zero Cases
console.log(`Round Binary Zero (0, target 2): ${JSON.stringify(roundingMethods("0", "unsigned", "-1", "2", "binary"))}`);
console.log(`Round Dec Zero (0, target 2): ${JSON.stringify(roundingMethods("0", "unsigned", "-1", "2", "decimal"))}`);

// Arithmetic
// Addition
console.log(`Add 1 + 1: ${JSON.stringify(ieeeAdd(1, 1))}`);
console.log(`Add 1.5 + 2.5: ${JSON.stringify(ieeeAdd(1.5, 2.5))}`);
console.log(`Add 0.5 + 0.25: ${JSON.stringify(ieeeAdd(0.5, 0.25))}`);
console.log(`Add 6.25 + 3.75: ${JSON.stringify(ieeeAdd(6.25, 3.75))}`);
console.log(`Add -1 + -1: ${JSON.stringify(ieeeAdd(-1, -1))}`);
console.log(`Add 5 + -2.5: ${JSON.stringify(ieeeAdd(5, -2.5))}`);
console.log(`Add 0.1 + 0.2: ${JSON.stringify(ieeeAdd(0.1, 0.2))}`);
console.log(`Add 0 + 0: ${JSON.stringify(ieeeAdd(0, 0))}`);
console.log(`Add -0 + 0: ${JSON.stringify(ieeeAdd(-0, 0))}`);
console.log(`Add Infinity + 5: ${JSON.stringify(ieeeAdd(Infinity, 5))}`);
console.log(`Add Infinity + -Infinity: ${JSON.stringify(ieeeAdd(Infinity, -Infinity))}`);

// Additional stress/edge cases
console.log(`Add 1e38 + 1e38: ${JSON.stringify(ieeeAdd(1e38, 1e38))}`);          // Overflow to Infinity
console.log(`Add 1e-45 + 1e-45: ${JSON.stringify(ieeeAdd(1e-45, 1e-45))}`);      // Subnormal / minimum value
console.log(`Add 16777215 + 1: ${JSON.stringify(ieeeAdd(16777215, 1))}`);        // Max integer before precision loss
console.log(`Add 1000000 + 0.125: ${JSON.stringify(ieeeAdd(1000000, 0.125))}`);  // Large + extremely small num
console.log(`Add 0.12345678 + 0.87654321: ${JSON.stringify(ieeeAdd(0.12345678, 0.87654321))}`); // Rounding near 1.0
console.log(`Add 3.4028235e38 + 1: ${JSON.stringify(ieeeAdd(3.4028235e38, 1))}`); // Max float + extremely small num (round/overflow)
console.log(`Add -Infinity + -Infinity: ${JSON.stringify(ieeeAdd(-Infinity, -Infinity))}`); // -Inf + -Inf
console.log(`Add NaN + 100: ${JSON.stringify(ieeeAdd(NaN, 100))}`);              // NaN propagation

// Multiplication
console.log(`Mul 2 × 5: ${JSON.stringify(ieeeMul(2, 5))}`);
console.log(`Mul 1.5 × 4: ${JSON.stringify(ieeeMul(1.5, 4))}`);
console.log(`Mul 0.5 × 0.5: ${JSON.stringify(ieeeMul(0.5, 0.5))}`);
console.log(`Mul -2 × -24: ${JSON.stringify(ieeeMul(-2, -24))}`);
console.log(`Mul -3 × 2.25: ${JSON.stringify(ieeeMul(-3, 2.25))}`);
console.log(`Mul 0 × 123.4567: ${JSON.stringify(ieeeMul(0, 123.4567))}`);
console.log(`Mul Infinity × 2: ${JSON.stringify(ieeeMul(Infinity, 2))}`);
console.log(`Mul 0 × Infinity: ${JSON.stringify(ieeeMul(0, Infinity))}`);

// Additional stress/edge cases
console.log(`Mul 1e20 × 1e20: ${JSON.stringify(ieeeMul(1e20, 1e20))}`);          // Overflow
console.log(`Mul 1e-20 × 1e-20: ${JSON.stringify(ieeeMul(1e-20, 1e-20))}`);      // Underflow
console.log(`Mul 3.4028235e38 × 2: ${JSON.stringify(ieeeMul(3.4028235e38, 2))}`); // Max float × 2 → overflow
console.log(`Mul 1.0000001 × 2: ${JSON.stringify(ieeeMul(1.0000001, 2))}`);      // Extremely small fractional × integer
console.log(`Mul -Infinity × -5: ${JSON.stringify(ieeeMul(-Infinity, -5))}`);    // Sign × Infinity
console.log(`Mul Infinity × -0: ${JSON.stringify(ieeeMul(Infinity, -0))}`);      // Infinity × -0 → -Infinity
console.log(`Mul NaN × 0: ${JSON.stringify(ieeeMul(NaN, 0))}`);                  // NaN propagation
console.log(`Mul 16777216 × 0.5: ${JSON.stringify(ieeeMul(16777216, 0.5))}`);    // Exact power-of-two boundary
