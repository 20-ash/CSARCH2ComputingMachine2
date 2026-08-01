'use server'
// --------------------------------------------------
// 1. Convert decimal to binary single-precision
// --------------------------------------------------

// determines the sign of the number
// returns 1 if negative and 0 if positive
export function determineSign(input: number) {
    return Object.is(input, -0) || input < 0 ? 1 : 0;
}

// converts the number to binary
// returns only the whole number part of the number
export function convertWhole(input: number) {
    input = Math.trunc(input);      // removes fractional part of the number
    input = Math.abs(input);

    const convertedInt = [];
    if (input === 0) {
        convertedInt.push(0);
    }
    while (input !== 0) {
        convertedInt.push(input % 2);       // pushes LSB to MSB
        input = Math.trunc(input / 2);
    }

    // returns reverse so that number is in correct order (MSB to LSB)
    return convertedInt.reverse();
}

// converts the fractional part of the number to binary
export function convertFrac(input: number, precision: number) {
    input = Math.abs(input);
    input = input % 1;          // extracts fractional part of number

    const convertedFrac = [];

    // performs decimal to binary conversion for fractional part
    while (input !== 0 && convertedFrac.length < precision + 8) {
        input *= 2;
        convertedFrac.push(Math.floor(input));
        input -= Math.trunc(input);
    }

    // returns converted fractional part in binary
    return convertedFrac;
}

// normalize to standard form
export function normalize(whole: number[], frac: number[]) {
    // if starts with 1, then shift left -> drop the 1 at the start (since this is implicit 
    // in standard form) -> append fractional bits -> return
    if (whole[0] !== 0) 
        return { exponent: whole.length - 1, mantissa: whole.slice(1).concat(frac) };
    
    const first = frac.indexOf(1);      // finds first 1 bit in the fraction

    // shift right -> drop the 1 at the start (since this is implicit 
    // in standard form) -> append fractional bits -> return
    return { exponent: -(first + 1), mantissa: frac.slice(first + 1) };
}

export function convert(input: number) {
    const precision = 23;
    const signBit = determineSign(input);
    let convertedWhole = new Array(precision).fill(0).slice(0, precision);
    let convertedFrac = new Array(precision).fill(0).slice(0, precision);
    let exponent = 0;
    let mantissa: number[] = new Array(precision).fill(0).slice(0, precision);
    const signString = signBit === 1 ? `-` : `+`;
    let leadDigit = `0`;
    let edgeFlag = true;

    if (input !== 0) {
        edgeFlag = false;
        convertedWhole = convertWhole(input);
        convertedFrac = convertFrac(input, precision);
        const res = normalize(convertedWhole, convertedFrac);
        exponent = res.exponent;
        mantissa = res.mantissa;

        if (exponent > 127) {
            mantissa = new Array(precision).fill(0).slice(0, precision);
        }      
        else if (exponent < -126) {
            mantissa.unshift(1);
            const shift = -(exponent + 126);
            const padded = new Array(shift).fill(0).concat(mantissa);
            const rounded = roundMantissa(padded);
            mantissa = rounded.mantissa;
            if (rounded.overflow) {
                exponent = -126;
            }
        }
        else {
            const padded = mantissa.concat(new Array(precision).fill(0));
            const rounded = roundMantissa(padded);
            mantissa = rounded.mantissa;
            if (rounded.overflow) {
                exponent++;
            }
        }
        leadDigit = `1`;
    }

    const binarybits = buildBinary(signBit, determineExponentBits(exponent, edgeFlag), mantissa);

    return {
        normalized: `${signString}${leadDigit}.${mantissa.join("")} X 2^${exponent}`,
        binary: binarybits,
        hex: buildHex(binarybits)
    };
}

export function determineExponentBits(exponent: number, flag: boolean) {
    if (exponent > 127) 
        return [1, 1, 1, 1, 1, 1, 1, 1];

    if (exponent < -126 || flag) 
        return [0, 0, 0, 0, 0, 0, 0, 0];

    const ePrime = exponent + 127;
    const bits = convertWhole(ePrime);

    return new Array(8 - bits.length).fill(0).concat(bits);
}

export function buildBinary(signBit: number, exponent: number[], mantissa: number[]) {
    const full = [String(signBit), ...exponent.map(String), ...mantissa.map(String)].join("");
    return full.match(/.{1,4}/g)?.join(" ") ?? "";
}

export function buildHex(binary: string) {
    const bits = binary.replaceAll(" ", "");
    const nibbles = bits.match(/.{1,4}/g) ?? [];
    return nibbles.map(n => parseInt(n, 2).toString(16).toUpperCase()).join("");
}

// takes in a binary number
// performs round to nearest, ties to even
export function roundMantissa(raw: number[]) {
    // if has less than 23 bits, pad with 0 then return
    if (raw.length <= 23) 
        return { mantissa: raw.concat(new Array(23).fill(0)).slice(0, 23), overflow: false };
    
    const guard = raw[23];
    if (guard === 0) 
        return {  mantissa: raw.slice(0, 23), overflow: false };

    if (raw.length <= 24) 
        return { mantissa: raw.concat(new Array(23).fill(0)).slice(0, 23), overflow: false };

    const round = raw[24];
    if (round === 1) {
        const mantissa = raw.slice(0, 23);
        let carry = 1;
        for (let i = 22; i >= 0; i--) {
            const sum = mantissa[i] + carry;
            mantissa[i] = sum % 2;
            carry = Math.floor(sum / 2);
            if (carry === 0) break;
        }
        return { mantissa, overflow: carry === 1 };
    } 

    const sticky = raw.slice(25).some(b => b === 1);
    const shouldRoundUp = sticky || raw[22] === 1;
    if (!shouldRoundUp) {
        return { mantissa: raw.slice(0, 23), overflow: false };
    }
    const mantissa = raw.slice(0, 23);
    let carry = 1;
    for (let i = 22; i >= 0; i--) {
        const sum = mantissa[i] + carry;
        mantissa[i] = sum % 2;
        carry = Math.floor(sum / 2);
        if (carry === 0) break;
    }
    return { mantissa, overflow: carry === 1 };
}

// --------------------------------------------------
// 2. Demonstrate rounding methods
// --------------------------------------------------
export type FormattedBinaryInput = {
    signed: boolean;            // true if signed binary and false if unsigned binary
    signBit: number;            // 0 is positive and 1 is negative (useless if unsigned)
    input: number[];            // input
    decimalPointIndex: number;  // indicates at which index does the fractional part start in input
                                // -1 if input is whole number
};

// returns index of first significant figure of the number
// returns -1 if number (whole array) is 0
function findFirstSigFig(input: number[]) {
    return input.findIndex(d => d !== 0);   // finds first index that is not 0
}

// --------------------------------------------------
// TRUNCATION - cuts off until target number of bits

// handles the truncation for binary numbers
function truncateBinary(binaryInput: FormattedBinaryInput, targetBits: number) {
    // get index of first significant bit
    let firstSigBit = -1;
    if (binaryInput.signed)
        firstSigBit = 0;    // if signed binary, first significant bit is always the sign bit
    else
        firstSigBit = findFirstSigFig(binaryInput.input);     // if unsigned binary, first significant bit is the first 1 bit

    // if input is 0, return 0
    if (firstSigBit === -1)
        return {
            ...binaryInput,
            input: [...binaryInput.input]
        };

    // if there are more target bits, then just return the original input since there is nothing to cut
    const output = binaryInput.input.slice(0, targetBits + firstSigBit);

    // adds trailing 0 if input has less bits as the target number of bits
    while (output.length < (targetBits + firstSigBit)) {
        output.push(0);
    }

    // return truncated binary
    return {
        ...binaryInput,
        input: output,
        decimalPointIndex: binaryInput.decimalPointIndex
    };
}

// handles the truncation for decimal numbers (including whole numbers and floats)
export function truncateDec(input: number, targetDigits: number) {
    // return 0 if input is 0
    if (input == 0)
        return 0;

    const sign = input < 0 ? '-' : '';                // stores sign
    const absoluteInput = Math.abs(input);            // gets absolute value of input
    let formattedInput = absoluteInput.toString();    // convert to string

    // prevents conversion to exponential notation
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '');
    }

    // splits integer and fractional part using decimal point
    // if input has no decimal, fracPart is default empty string
    const [intPart, fracPart = ''] = formattedInput.split('.');

    // if there are more digits in the whole number part than or equal to the target number of digits 
    // and is greater than or equal to 1
    if (intPart.length >= targetDigits && absoluteInput >= 1) {
        const keep = intPart.slice(0, targetDigits);                    // digits to keep, the rest is disregarded since truncation
        const zeroPadding = '0'.repeat(intPart.length - targetDigits);  // add zero padding if needed
        
        return Number(sign + keep + zeroPadding);   // convert back to number then return
    }

    // if output will have decimal
    let truncatedFrac = '';

    if (absoluteInput < 1 && absoluteInput > 0) {
        const firstSigFig = fracPart.search(/[1-9]/);   // finds first non zero index

        // return 0 if underflow / no sig figs
        if (firstSigFig === -1) 
            return 0;

        truncatedFrac = fracPart.slice(0, targetDigits + firstSigFig);      // fractional digits to keep
    } else {
        truncatedFrac = fracPart.slice(0, targetDigits - intPart.length);   // fractional digits to keep
    }

    const resultStr = `${sign}${intPart}.${truncatedFrac}`;     // builds output

    return Number(resultStr);   // convert back to number then return
}

// --------------------------------------------------
// ROUND UP - rounds towards positive infinity

// insert code here

// --------------------------------------------------
// ROUND DOWN - rounds towards negative infinity

// insert code here


// --------------------------------------------------
// 3. Perform arithmetic operations (addition and multiplication) using rounding method
// --------------------------------------------------

// Unpack IEEE binary string (sign, exponent, mantissa)
function unpackIEEE(binStr: string) {
    const bits = binStr.replaceAll(" ", "");
    return {
        sign: parseInt(bits[0]),
        exp: parseInt(bits.slice(1, 9), 2),
        mant: [1, ...bits.slice(9).split("").map(Number)] // implicit leading 1 restored
    };
}

// Pack back to IEEE 754 
function packIEEE(sign: number, exp: number, mant: number[]) {
    // drop implicit leading 1, round to 23 bits
    const rounded = roundMantissa(mant.slice(1));
    if (rounded.overflow) exp++;
    const expBits = determineExponentBits(exp - 127, false);
    return {
        binary: buildBinary(sign, expBits, rounded.mantissa),
        hex: buildHex(buildBinary(sign, expBits, rounded.mantissa))
    };
}

// Perform addition
export function ieeeAdd(a: number, b: number) {
    // special cases first
    if (isNaN(a) || isNaN(b)) return { result: NaN, binary: "NaN", hex: "NaN" };
    if (!isFinite(a) || !isFinite(b)) {
        if (Object.is(a, -Infinity) && Object.is(b, Infinity)) 
            return { result: NaN, binary: "NaN", hex: "NaN" };
        if (Object.is(a, Infinity) && Object.is(b, -Infinity)) 
            return { result: NaN, binary: "NaN", hex: "NaN" };
        return { result: a + b, binary: a > 0 ? "0 11111111 00000000000000000000000" : "1 11111111 00000000000000000000000", hex: a > 0 ? "7F800000" : "FF800000" };
    }

    const A = convert(a);
    const B = convert(b);
    const uA = unpackIEEE(A.binary);
    const uB = unpackIEEE(B.binary);
    let eA = uA.exp - 127, eB = uB.exp - 127;
    let mA = [...uA.mant], mB = [...uB.mant];

    // align exponents
    if (eA > eB) {
        mB = [0, ...mB.slice(0, - (eA - eB))];
        eB = eA;
    } else {
        mA = [0, ...mA.slice(0, - (eB - eA))];
        eA = eB;
    }

    // add/subtract mantissas based on sign
    let signR = uA.sign;
    let mantR: number[];
    if (uA.sign === uB.sign) {
        signR = uA.sign;
        mantR = mA.map((v, i) => v + mB[i]);
    } else {
        signR = a > b ? uA.sign : uB.sign;
        mantR = mA.map((v, i) => Math.abs(v - mB[i]));
    }

    // normalize
    let first1 = mantR.findIndex(b => b === 1);
    let expR = eA - first1;
    mantR = mantR.slice(first1);
    while (mantR.length < 24) mantR.push(0);

    const packed = packIEEE(signR, expR + 127, mantR);
    const dec = parseInt(packed.binary.replaceAll(" ", ""), 2);
    return {
        operands: { a: A, b: B },
        stepByStep: "Unpack → align exponents → add mantissas → normalize → round → pack",
        ...packed,
        decimal: new Float32Array([dec])[0]
    };
}

// Perform multiplication
export function ieeeMul(a: number, b: number) {
    if (isNaN(a) || isNaN(b)) 
        return { result: NaN, binary: "NaN", hex: "NaN" };
    if (a === 0 || b === 0) 
        return { result: 0, binary: "0 00000000 00000000000000000000000", hex: "00000000" };
    if (!isFinite(a) || !isFinite(b)) {
        return { result: a * b, binary: (a*b > 0 ? "0" : "1") + " 11111111 00000000000000000000000", hex: (a*b > 0 ? "7F800000" : "FF800000") };
    }

    const A = convert(a);
    const B = convert(b);
    const uA = unpackIEEE(A.binary);
    const uB = unpackIEEE(B.binary);
    const signR = uA.sign ^ uB.sign;
    const expR = (uA.exp - 127) + (uB.exp - 127) + 1;

    // multiply mantissas (simplified bit product)
    let mantissaR: number[] = [];
    for (let i = 0; i < uA.mant.length; i++) {
        if (uA.mant[i]) mantissaR = mantissaR.map((v,j) => v + (uB.mant[j]||0));
    }
    while (mantissaR.length < 24) mantissaR.push(0);

    const packed = packIEEE(signR, expR + 127, mantissaR);
    const dec = parseInt(packed.binary.replaceAll(" ", ""), 2);
    return {
        operands: { a: A, b: B },
        stepByStep: "Unpack → XOR sign → debias exponents → multiply mantissas → normalize → round → pack",
        ...packed,
        decimal: new Float32Array([dec])[0]
    };
}