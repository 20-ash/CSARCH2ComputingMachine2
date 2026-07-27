import { convert, convertFrac, convertWhole, determineSign, normalize, buildBinary, buildHex, determineExponentBits } from "./backend";

console.log(convert(1));        // +1. × 2^0
console.log(convert(2));        // +1. × 2^1
console.log(convert(6));        // +1.10 × 2^2

// Simple fractions (clean binary)
console.log(convert(0.5));      // +1. × 2^-1
console.log(convert(0.25));     // +1. × 2^-2
console.log(convert(6.25));     // +1.1001 × 2^2

// Negative values
console.log(convert(-1));       // -1. × 2^0
console.log(convert(-0.5));     // -1. × 2^-1
console.log(convert(-3.14));    // -1.10010 × 2^1

// Edge cases
console.log(convert(0));        // +1.0 × 2^0
console.log(convert(-0));       // +1.0 × 2^0

// Precision limit test (repeating binary)
console.log(convert(0.1));      // will be truncated at 4 bits of frac
console.log(convert(3.14));     // +1.10010 × 2^1

// Larger values
console.log(convert(10));       // +1.01 × 2^3
console.log(convert(-8.75));    // -1.00011 × 2^3

console.log(determineExponentBits(0, true));