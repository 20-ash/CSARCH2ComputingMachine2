import { convert, convertFrac, convertWhole, determineSign, normalize, buildBinary, buildHex, determineExponentBits } from "./backend";

console.log(`Input 1: ${convert(1)}`);        // +1. × 2^0
console.log(`Input 2: ${convert(2)}`);        // +1. × 2^1
console.log(`Input 6: ${convert(6)}`);        // +1.10 × 2^2

// Simple fractions (clean binary)
console.log(`Input 0.5: ${convert(0.5)}`);
console.log(`Input 0.25: ${convert(0.25)}`);
console.log(`Input 6.25: ${convert(6.25)}`);

// Negative values
console.log(`Input -1: ${convert(-1)}`);
console.log(`Input -0.5: ${convert(-0.5)}`);
console.log(`Input -3.14: ${convert(-3.14)}`);

// Edge cases
console.log(`Input 0: ${convert(0)}`);
console.log(`Input -0: ${convert(-0)}`);

// Precision limit test (repeating binary)
console.log(`Input 0.1: ${convert(0.1)}`);
console.log(`Input 3.14: ${convert(3.14)}`);

// Larger values
console.log(`Input 10: ${convert(10)}`);
console.log(`Input -8.75: ${convert(-8.75)}`);