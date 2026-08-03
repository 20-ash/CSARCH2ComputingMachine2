'use server'

import { sign } from "crypto";
import { format } from "util";

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


// orchestrator function that assembles all of the individual function pieces to perform the conversion.
// returns the normalized (was used for debugging), IEEE binary, and IEEE hexadecimal representation of the input decimal.
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

// custom data type for binary inputs
type FormattedBinaryInput = {
    signed: boolean;            // true if signed binary and false if unsigned binary
    signBit: number;            // 0 is positive and 1 is negative (-1 if unsigned)
    magnitude: number[];        // magnitude
    decimalPointIndex: number;  // indicates at which index does the fractional part start in input
                                // -1 if input is whole number
};

type ArithmeticBinaryResult = {
    arithmeticMagnitude: number[];      // magnitude
    arithmeticPointIndex: number;       // indicates at which index does the fractional part start in input
                                        // -1 if input is whole number
}

// --------------------------------------------------
// MAIN ENTRANCE FOR ROUNDING METHODS

// properly formats and converts user input depending on the input (binary or decimal)
export function roundingMethods(inputStr: string, signedStr: string, signBitStr: string, method: string, target: string, type: string) {
    const targetNum = Number(target);   // convert to number

    // if number is in binary then it uses the binary rounding functions
    // if number is in decimal then it uses the decimal rounding functions
    // if number is in ieee then it uses the binary rounding functions (adjust input to only include magnitude)
    if (type === "binary") {
        const inputBinary = formatBinaryInput(inputStr, signedStr, signBitStr);
        return roundBinary(inputBinary, targetNum, method);
    } else if (type === "decimal") {
        const inputDec = Number(inputStr);
        return roundDec(inputDec, targetNum, method);
    } else if (type === "ieee") {
        // only pass the magnitude part of the ieee number
        let inputIEEE = formatBinaryInput(inputStr.slice(9), signedStr, signBitStr);
        return roundBinary(inputIEEE, targetNum, method);
    }
}

// directs to rounding method chosen by user (for binary inputs)
function roundBinary(binaryInput: FormattedBinaryInput, targetBits: number, method: string) {
    switch (method) {
        case "truncation":
            return truncateBinary(binaryInput, targetBits);
        case "roundUp":
            return roundUpBinary(binaryInput, targetBits);
        case "roundDown":
            return roundDownBinary(binaryInput, targetBits);
        case "roundNearest":
            return roundNearBinary(binaryInput, targetBits);
    }
}

// directs to rounding method chosen by user (for decimal inputs)
function roundDec(decInput: number, targetDigits: number, method: string) {
    switch (method) {
        case "truncation":
            return truncateDec(decInput, targetDigits);
        case "roundUp":
            return roundUpDec(decInput, targetDigits);
        case "roundDown":
            return roundDownDec(decInput, targetDigits);
        case "roundNearest":
            return roundNearDec(decInput, targetDigits);
    }
}

// formats input to object type FormattedBinaryInput and returns object
function formatBinaryInput(inputStr: string, signedStr: string, signbitStr: string) {
    // indicate whether input is signed (true) or unsigned (false) binary
    let signed = false;
    if (signedStr === "signed")
        signed = true;

    // stores only the magnitude
    let magnitude = inputStr;

    // converts sign bit to number, defaults to -1 if unsigned
    let signBit = signed ? Number(signbitStr) : -1;
    
    // determine the index of the decimal point
    let decimalPointIndex = magnitude.indexOf(".");

    // converts input to array of numbers for correct formatting
    let result = [];
    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] !== ".") {
            if (magnitude[i] === "0")
                result.push(0);
            else if (magnitude[i] === "1")
                result.push(1);
        }
    }

    // return object type FormattedBinaryInput
    return {
        signed: signed,
        signBit: signBit,
        magnitude: result,
        decimalPointIndex: decimalPointIndex
    };
}

// --------------------------------------------------
// ROUNDING METHODS FUNCTIONS

// HELPER FUNCTIONS for rounding methods

// returns index of first significant figure of the number
// returns -1 if number (whole array) is 0
function findFirstSigFig(input: number[]) {
    return input.findIndex(b => b !== 0);   // finds first index that is not 0
}

// adds trailing 0 to retain original place values
function addTrailZero(output: number[], len: number) {
    while (output.length < len)
        output.push(0);

    return output;
}

// return incremented binary number
function incrementBinary(binaryNum: number[], pointIndex: number) {
    let result = [...binaryNum];    // create a copy of the number
    let carry = 1;                  // initialize to 1

    // increments binary number
    for (let i = binaryNum.length - 1; i >= 0; i--) {
        let sumBit = result[i] + carry;
        result[i] = sumBit % 2;
        carry = Math.floor(sumBit / 2);
    }

    if (carry) {
        result.unshift(1);
        return {
            arithmeticMagnitude: result,
            arithmeticPointIndex: pointIndex === -1 ? -1 : pointIndex + 1
        };
    }

    return {
        arithmeticMagnitude: result,
        arithmeticPointIndex: pointIndex
    };
}

// helper function for dealing with round to nearest logic
function roundNearJudge(input: number, targetDigits: number, disregard: number, half: number, lastKeepDigit: number) {
    if (disregard > half) {
        return roundUpDec(input, targetDigits);         // if higher than half, then round up
    } else if (disregard < half) {
        return roundDownDec(input, targetDigits);       // if lower than half, then round down
    } else {
        // if exactly half
        if (lastKeepDigit % 2 !== 0) {
            return roundUpDec(input, targetDigits);     // if odd, then round up to even
        } else {
            return truncateDec(input, targetDigits);    // if already even, then truncate
        }
    }
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
        firstSigBit = findFirstSigFig(binaryInput.magnitude);     // if unsigned binary, first significant bit is the first 1 bit

    // if input is 0, return 0
    if (firstSigBit === -1)
        return {
            ...binaryInput,
            magnitude: [...binaryInput.magnitude]
        };

    // if there are more target bits, then just return the original input since there is nothing to cut
    let output = binaryInput.magnitude.slice(0, targetBits + firstSigBit);

    const origfracBitsCount = binaryInput.decimalPointIndex === -1 ? 0 : binaryInput.magnitude.length - binaryInput.decimalPointIndex;
    const newLen = binaryInput.decimalPointIndex === -1 ? Math.max(output.length, binaryInput.magnitude.length) : binaryInput.decimalPointIndex + origfracBitsCount;

    // adds trailing 0 to retain original place values
    output = addTrailZero(output, newLen);

    // return truncated binary
    return {
        ...binaryInput,
        magnitude: output,
        decimalPointIndex: binaryInput.decimalPointIndex
    };
}

// handles the truncation for decimal numbers (including whole numbers and floats)
function truncateDec(input: number, targetDigits: number) {
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

        // return 0 if no sig figs
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

// handles rounding up for binary numbers
function roundUpBinary(binaryInput: FormattedBinaryInput, targetBits: number) {
    // if input is 0, return 0
    if (findFirstSigFig(binaryInput.magnitude) === -1)
        return {
            ...binaryInput,
            magnitude: [...binaryInput.magnitude]
        };

    // get index of first significant bit
    let firstSigBit = -1;
    if (binaryInput.signed)
        firstSigBit = 0;    // if signed binary, first significant bit is always the sign bit
    else
        firstSigBit = findFirstSigFig(binaryInput.magnitude);     // if unsigned binary, first significant bit is the first 1 bit

    // bits after the target number of bits
    const afterTarget = binaryInput.magnitude.slice(targetBits + firstSigBit, binaryInput.magnitude.length);

    // checks if there are any 1 bits in the bits after the target
    const hasOne = afterTarget.some(b => b === 1);

    // if it does not have any 1 bits after the target, then do nothing
    if (!hasOne) 
        return {
            ...binaryInput,
            magnitude: [...binaryInput.magnitude]
        };

    // stores target bits
    let output = [...binaryInput.magnitude];
    output = output.slice(0, targetBits + firstSigBit);
    let outputDecimalPoint = binaryInput.decimalPointIndex;

    // increments for positive numbers since round up means towards positive infinity
    if (binaryInput.signed || binaryInput.signBit === 0) {
        let incrementedObj = incrementBinary(output, binaryInput.decimalPointIndex);
        output = incrementedObj.arithmeticMagnitude;
        outputDecimalPoint = incrementedObj.arithmeticPointIndex;
    }

    // computes new length if it was unshifted during incrementation
    const origfracBitsCount = binaryInput.decimalPointIndex === -1 ? 0 : binaryInput.magnitude.length - binaryInput.decimalPointIndex;
    const newLen = outputDecimalPoint === -1 ? output.length : outputDecimalPoint + origfracBitsCount;

    // adds trailing 0 to retain original place values
    output = addTrailZero(output, newLen);

    // return rounded up binary
    return {
        ...binaryInput,
        magnitude: output,
        decimalPointIndex: outputDecimalPoint
    };
}

// handles rounding up for decimal numbers
function roundUpDec(input: number, targetDigits: number) {
    // return 0 if input is 0
    if (input == 0)
        return 0;

    // since negative numbers round to positive infinity, then that also follows truncation rules
    if (input < 0) {
        return truncateDec(input, targetDigits);
    }

    const absoluteInput = Math.abs(input);            // gets absolute value of input
    let formattedInput = absoluteInput.toString();    // convert to string

    // prevents conversion to exponential notation
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '');
    }

    // splits integer and fractional part using decimal point
    // if input has no decimal, fracPart is default empty string
    const [intPart, fracPart = ''] = formattedInput.split('.');

    // if input is neither in between 1 and -1
    if (absoluteInput >= 1) {
        // if integer part is enough for the target number of digits
        if (intPart.length >= targetDigits) {
            const keep = intPart.slice(0, targetDigits);
            const disregard = intPart.slice(targetDigits) + fracPart;
            
            // checks if there are any non-zero digits in the remaining digits
            // returns -1 if none
            const hasNonZero = disregard.search(/[1-9]/);

            // if there are non zero digits past the kept integers then need to increment by 1 per round up rules
            if (hasNonZero !== -1) {
                // increment by 1 to the kept digits
                const incremented = (Number(keep) + 1).toString();
                const zeroPadding = '0'.repeat(intPart.length - targetDigits);

                // returns rounded up number after fixing the value and converting to Number
                return Number(incremented + zeroPadding);
            }

            // if there are no more non zero digits past the kept integers then just pad zeros to
            // fix the value then return after converting to Number
            const zeroPadding = '0'.repeat(intPart.length - targetDigits);
            return Number(keep + zeroPadding);
        }

        // if target digits spans until fractional part
        const keepFracDigits = targetDigits - intPart.length;   // number of digits to keep in fractional part
        const keepFrac = fracPart.slice(0, keepFracDigits);     // to keep fractional part

        const disregard = fracPart.slice(keepFracDigits);   // fractional part to be disregarded

        // checks if there are any non-zero digits in the remaining digits
        // returns -1 if none
        const hasNonZero = disregard.search(/[1-9]/);

        if (hasNonZero !== -1) {
            const scale = Math.pow(10, keepFracDigits);             // how much to scale number
            const originalNum = Number(`${intPart}.${keepFrac}`);       // original number

            // revert number back to original size then return
            return Number(((originalNum * scale + 1) / scale).toFixed(keepFracDigits));
        }

        // rebuild number then return
        return Number(`${intPart}.${keepFrac}`);
    }

    const firstSigFig = fracPart.search(/[1-9]/);
    
    // return 0 if no sig figs
    if (firstSigFig === -1) 
        return 0;

    const cutIndex = firstSigFig + targetDigits;    // index where to cut
    const keepFrac = fracPart.slice(0, cutIndex);   // to keep fractional part

    const disregard = fracPart.slice(cutIndex);     // fractional part to be disregarded
    
    // checks if there are any non-zero digits in the remaining digits
    // returns -1 if none
    const hasNonZero = disregard.search(/[1-9]/);

    if (hasNonZero !== -1) {
        const scale = Math.pow(10, cutIndex);           // how much to scale number
        const originalNum = Number(`0.${keepFrac}`);    // original number

        // revert number back to original size then return
        return Number(((originalNum * scale + 1) / scale).toFixed(cutIndex));
    }

    // rebuild number then return
    return Number(`0.${keepFrac}`);
}

// --------------------------------------------------
// ROUND DOWN - rounds towards negative infinity

// handles rounding down for binary numbers
function roundDownBinary(binaryInput: FormattedBinaryInput, targetBits: number) {
    // if input is 0, return 0
    if (findFirstSigFig(binaryInput.magnitude) === -1)
        return {
            ...binaryInput,
            magnitude: [...binaryInput.magnitude]
        };

    // get index of first significant bit
    let firstSigBit = -1;
    if (binaryInput.signed)
        firstSigBit = 0;    // if signed binary, first significant bit is always the sign bit
    else
        firstSigBit = findFirstSigFig(binaryInput.magnitude);     // if unsigned binary, first significant bit is the first 1 bit

    // bits after the target number of bits
    const afterTarget = binaryInput.magnitude.slice(targetBits + firstSigBit, binaryInput.magnitude.length);

    // checks if there are any 1 bits in the bits after the target
    const hasOne = afterTarget.some(b => b === 1);

    // if it does not have any 1 bits after the target, then do nothing
    if (!hasOne) 
        return {
            ...binaryInput,
            magnitude: [...binaryInput.magnitude]
        };
    
    // index where to cut the number
    const cutIndex = targetBits + firstSigBit;

    // stores target bits
    let output = [...binaryInput.magnitude];
    output = output.slice(0, cutIndex);
    let outputDecimalPoint = binaryInput.decimalPointIndex;

    // increment for negative numbers since round down means towards negative infinity
    if (binaryInput.signed && binaryInput.signBit === 1) {
        let incrementedObj = incrementBinary(output, binaryInput.decimalPointIndex);
        output = incrementedObj.arithmeticMagnitude;
        outputDecimalPoint = incrementedObj.arithmeticPointIndex;
    }

    // computes new length if it was unshifted during incrementation
    const origfracBitsCount = binaryInput.decimalPointIndex === -1 ? 0 : binaryInput.magnitude.length - binaryInput.decimalPointIndex;
    const newLen = outputDecimalPoint === -1 ? output.length : outputDecimalPoint + origfracBitsCount;

    // adds trailing 0 to retain original place values
    output = addTrailZero(output, newLen);

    // return rounded down binary
    return {
        ...binaryInput,
        magnitude: output,
        decimalPointIndex: outputDecimalPoint
    };
}

// handles rounding down for decimal numbers
function roundDownDec(input: number, targetDigits: number) {
    // return 0 if input is 0
    if (input == 0)
        return 0;

    // since positive numbers round to negative infinity, then that also follows truncation rules
    if (input > 0) {
        return truncateDec(input, targetDigits);
    }

    const absoluteInput = Math.abs(input);            // gets absolute value of input
    let formattedInput = absoluteInput.toString();    // convert to string

    // prevents conversion to exponential notation
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '');
    }

    // splits integer and fractional part using decimal point
    // if input has no decimal, fracPart is default empty string
    const [intPart, fracPart = ''] = formattedInput.split('.');

    // if input is neither in between 1 and -1
    if (absoluteInput <= -1) {
        // if integer part is enough for the target number of digits
        if (intPart.length >= targetDigits) {
            const keep = intPart.slice(0, targetDigits);
            const disregard = intPart.slice(targetDigits) + fracPart;
            
            // checks if there are any non-zero digits in the remaining digits
            // returns -1 if none
            const hasNonZero = disregard.search(/[1-9]/);

            // if there are non zero digits past the kept integers then need to increment by 1 per round up rules
            if (hasNonZero !== -1) {
                // increment by 1 to the kept digits
                const incremented = (Number(keep) + 1).toString();
                const zeroPadding = '0'.repeat(intPart.length - targetDigits);

                // returns rounded up number after fixing the value and converting to Number (negated)
                return -Number(incremented + zeroPadding);
            }

            // if there are no more non zero digits past the kept integers then just pad zeros to
            // fix the value then return after converting to Number (negated)
            const zeroPadding = '0'.repeat(intPart.length - targetDigits);
            return -Number(keep + zeroPadding);
        }

        // if target digits spans until fractional part
        const keepFracDigits = targetDigits - intPart.length;   // number of digits to keep in fractional part
        const keepFrac = fracPart.slice(0, keepFracDigits);     // to keep fractional part

        const disregard = fracPart.slice(keepFracDigits);   // fractional part to be disregarded

        // checks if there are any non-zero digits in the remaining digits
        // returns -1 if none
        const hasNonZero = disregard.search(/[1-9]/);

        if (hasNonZero !== -1) {
            const scale = Math.pow(10, keepFracDigits);             // how much to scale number
            const originalNum = Number(`${intPart}.${keepFrac}`);       // original number

            // revert number back to original size then return (negated)
            return -Number(((originalNum * scale + 1) / scale).toFixed(keepFracDigits));
        }

        // rebuild number then return (negated)
        return -Number(`${intPart}.${keepFrac}`);
    }

    const firstSigFig = fracPart.search(/[1-9]/);
    
    // return 0 if no sig figs
    if (firstSigFig === -1) 
        return 0;

    const cutIndex = firstSigFig + targetDigits;    // index where to cut
    const keepFrac = fracPart.slice(0, cutIndex);   // to keep fractional part

    // fractional part to be disregarded
    const disregard = fracPart.slice(cutIndex);
    
    // checks if there are any non-zero digits in the remaining digits
    // returns -1 if none
    const hasNonZero = disregard.search(/[1-9]/);

    if (hasNonZero !== -1) {
        const scale = Math.pow(10, cutIndex);           // how much to scale number
        const originalNum = Number(`0.${keepFrac}`);    // original number

        // revert number back to original size then return (negated)
        return -Number(((originalNum * scale + 1) / scale).toFixed(cutIndex));
    }

    // rebuild number then return (negated)
    return -Number(`0.${keepFrac}`);
}

// --------------------------------------------------
// ROUND TO NEAREST, TIES TO EVEN - rounds to nearest (up or down) and even if tie (in the middle)

// handles round to nearest, ties to even for binary numbers
function roundNearBinary(binaryInput: FormattedBinaryInput, targetBits: number) {
    // if input is 0, return 0
    if (findFirstSigFig(binaryInput.magnitude) === -1)
        return {
            ...binaryInput,
            magnitude: [...binaryInput.magnitude]
        };

    // get index of first significant bit
    let firstSigBit = -1;
    if (binaryInput.signed)
        firstSigBit = 0;    // if signed binary, first significant bit is always the sign bit
    else
        firstSigBit = findFirstSigFig(binaryInput.magnitude);     // if unsigned binary, first significant bit is the first 1 bit

    // index where to cut the number
    const cutIndex = targetBits + firstSigBit;

    // stores target bits
    let output = [...binaryInput.magnitude];
    output = output.slice(0, cutIndex);
    let outputDecimalPoint = binaryInput.decimalPointIndex;

    // check if there are bits after the target cut
    if (cutIndex < binaryInput.magnitude.length) {
        // last kept bit (L)
        const lastKeptBit = output[output.length - 1];

        // guard bit (G)
        // first bit after cut
        const guardBit = binaryInput.magnitude[cutIndex];

        // sticky bits (S)
        // OR all bits after guard bit
        const stickyBits = binaryInput.magnitude.slice(cutIndex + 1);
        const hasStickyBit = stickyBits.some(b => b === 1);

        // indicator for increment number or not
        let shouldIncrement = false;

        // round to nearest, ties to even logic
        if (guardBit === 1) {
            // if fraction is greater then the midpoint then round up
            if (hasStickyBit)
                shouldIncrement = true;
            else {
                // if exactly halfway then round to nearest even bit
                if (lastKeptBit === 1)
                    shouldIncrement = true;
            }
        }

        // incrementing logic
        if (shouldIncrement) {
            let incrementedObj = incrementBinary(output, binaryInput.decimalPointIndex);
            output = incrementedObj.arithmeticMagnitude;
            outputDecimalPoint = incrementedObj.arithmeticPointIndex;
        }
    }

    // computes new length if it was unshifted during incrementation
    const origfracBitsCount = binaryInput.decimalPointIndex === -1 ? 0 : binaryInput.magnitude.length - binaryInput.decimalPointIndex;
    const newLen = outputDecimalPoint === -1 ? output.length : outputDecimalPoint + origfracBitsCount;

    // adds trailing 0 to retain original place values
    output = addTrailZero(output, newLen);

    // return rounded down binary
    return {
        ...binaryInput,
        magnitude: output,
        decimalPointIndex: outputDecimalPoint
    };
}

// handles round to nearest, ties to even for decimal numbers
function roundNearDec(input: number, targetDigits: number) {
    // return 0 if input is 0
    if (input == 0)
        return 0;

    const absoluteInput = Math.abs(input);            // gets absolute value of input
    let formattedInput = absoluteInput.toString();    // convert to string

    // prevents conversion to exponential notation
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '');
    }

    // splits integer and fractional part using decimal point
    // if input has no decimal, fracPart is default empty string
    const [intPart, fracPart = ''] = formattedInput.split('.');

    // if input is a positive number greater than or equal to 1
    if (absoluteInput >= 1) {
        if (intPart.length >= targetDigits) {
            // get keep part and its last digit
            const keepStr = intPart.slice(0, targetDigits);
            const lastKeepDigit = Number(keepStr[keepStr.length - 1]);

            // get drop part
            const dropStr = intPart.slice(targetDigits);
            const disregard = Number(`${dropStr}.${fracPart}`);

            // compute for midpoint
            const dropIntLength = dropStr.length;
            const half = 5 * Math.pow(10, dropIntLength - 1);

            // evaluate round to nearest, ties to even logic and return rounded value
            return roundNearJudge(input, targetDigits, disregard, half, lastKeepDigit);
        } else {
            // get keep part and its last digit
            const neededFracDigits = targetDigits - intPart.length;
            const keepFracStr = fracPart.slice(0, neededFracDigits);
            
            // get last digit of the kept part of the number
            const fullKeptStr = intPart + keepFracStr;
            const lastKeepDigit = Number(fullKeptStr[fullKeptStr.length - 1]);

            // get drop part
            const dropFracStr = fracPart.slice(neededFracDigits);
            const disregard = Number(`0.${dropFracStr}`);
            
            // midpoint always 0.5 for this case
            const half = 0.5;

            // evaluate round to nearest, ties to even logic and return rounded value
            return roundNearJudge(input, targetDigits, disregard, half, lastKeepDigit);
        }
    } else {
        // find first non zero digit
        const firstSigFig = fracPart.search(/[1-9]/);

        // extract significant digits
        const keepFracStr = fracPart.slice(firstSigFig, firstSigFig + targetDigits);
        const lastKeepDigit = Number(keepFracStr[keepFracStr.length - 1]);

        // get drop part
        const dropFracStr = fracPart.slice(firstSigFig + targetDigits);
        const disregard = Number(`0.${dropFracStr}`);

        // midpoint always 0.5 for this case
        const half = 0.5;

        // evaluate round to nearest, ties to even logic and return rounded value
        return roundNearJudge(input, targetDigits, disregard, half, lastKeepDigit);
    }
}

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