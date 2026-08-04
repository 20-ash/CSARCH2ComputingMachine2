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
    while (input !== 0 && convertedFrac.length < precision + 8 + 127) {
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
    // initialization assumes the input is 0 first
    // precision is used to adjust how many digits should the mantissa have
    const precision = 23;
    const signBit = determineSign(input);
    let convertedWhole = new Array(precision).fill(0).slice(0, precision);
    let convertedFrac = new Array(precision).fill(0).slice(0, precision);
    let exponent = 0;
    let mantissa: number[] = new Array(precision).fill(0).slice(0, precision);
    const signString = signBit === 1 ? `-` : `+`;
    let leadDigit = `0`;
    // edgeFlag tells determineExponentBits() if the input is 0
    let edgeFlag = true;

    // we see the input is not 0
    if (input !== 0) {
        // we now mark the flag as false to make sure determineExponentBits() know this isn't the 0 input edge case
        edgeFlag = false;
        convertedWhole = convertWhole(input);
        convertedFrac = convertFrac(input, precision);
        const res = normalize(convertedWhole, convertedFrac);
        exponent = res.exponent;
        mantissa = res.mantissa;

        // this is the infinity case, we set entire mantissa to 0's
        // determineExponentBits() will handle the exponent bits field 
        if (exponent > 127) {
            mantissa = new Array(precision).fill(0).slice(0, precision);
        }    
        // we hit the denormalized form of an incredibly small number  
        else if (exponent < -126) {
            // restore the implicit leading 1 of the normalized form
            mantissa.unshift(1);
            // how far away is the exponent from the smallest limit of -126 for single precision
            const shift = -(exponent + 127);
            // shift to the right until exponent becomes -126
            const padded = new Array(shift).fill(0).concat(mantissa);
            // perform rounding in case of excess bits
            const rounded = roundMantissa(padded);
            mantissa = rounded.mantissa;
            // this overflow exists in case of a wrap around between -127 -> -126 sending an input back into the normalized range
            if (rounded.overflow) {
                exponent = -126;
            }
        }
        // hitting this line means the input is not an edge case
        else {
            // pad to the 23 bit precision for the roundedMantissa() function to work
            const padded = mantissa.concat(new Array(precision).fill(0));
            const rounded = roundMantissa(padded);
            mantissa = rounded.mantissa;
            // we now must adjust the exponent due to the rounding spilling over, this handles a normalized form of 1.11111 something
            if (rounded.overflow) {
                exponent++;
            }
        }
        // this is the non-zero input branch so our leading digit is automatically 1 on the normalized form
        leadDigit = `1`;
    }

    // we now construct the binary representation of the entire decimal input
    const binarybits = buildBinary(signBit, determineExponentBits(exponent, edgeFlag), mantissa);

    return {
        // we build the normalized form into a string based on the initialization and adjustments from the start of convert()
        normalized: `${signString}${leadDigit}.${mantissa.join("")} X 2^${exponent}`,
        binary: binarybits,
        hex: buildHex(binarybits)
    };
}

// takes in the exponent determined by the normalize function to compute for the exponent bits field
// flag is there to tell this function that the input is a 0
export function determineExponentBits(exponent: number, flag: boolean) {
    // we hit the infinitt case, we return all 1's for the exponent field
    if (exponent > 127) 
        return [1, 1, 1, 1, 1, 1, 1, 1];

    // we hit the denormalized form or the input is 0, we just return all 0's for the exponent bits field
    if (exponent < -126 || flag) 
        return [0, 0, 0, 0, 0, 0, 0, 0];

    // we calculate e prime then reuse convertWhole() to turn the eprime bits into binary
    const ePrime = exponent + 127;
    const bits = convertWhole(ePrime);

    // pad to the left with 0's to ensure exponent field matches the 8 bits requirement
    return new Array(8 - bits.length).fill(0).concat(bits);
}

// receives the signbit, the exponent number array holding the binary version of e prime, and the number array holding the mantissa
// uses these parameters and concatenates all of them into a single array to be mapped and converted into a string.
export function buildBinary(signBit: number, exponent: number[], mantissa: number[]) {
    const full = [String(signBit), ...exponent.map(String), ...mantissa.map(String)].join("");
    // spaces the arrays to make sure after every 4 digits, they are concatenated with a space
    return full.match(/.{1,4}/g)?.join(" ") ?? "";
}

// takes in the string generated from buildBinary and then maps every 4 binary digits into a hex digit
export function buildHex(binary: string) {
    const bits = binary.replaceAll(" ", "");
    // we group up the bits into nibbles first
    const nibbles = bits.match(/.{1,4}/g) ?? [];
    // we converted every nibble entry into their corresponding hex digit
    return nibbles.map(n => parseInt(n, 2).toString(16).toUpperCase()).join("");
}

// takes in a binary number
// performs round to nearest, ties to even
// overflow flag is there to tell convert later if the exponent value needs to be adjusted due to the rounding
export function roundMantissa(raw: number[]) {
    // if has less than or equal to 23 bits, pad with 0 then return
    if (raw.length <= 23) 
        return { mantissa: raw.concat(new Array(23).fill(0)).slice(0, 23), overflow: false };
    
    // we now know we have enough bits for rounding, now we set the 24th bit as the guard bit 
    const guard = raw[23];
    // if guard is 0, we know rounding here is going to floor
    if (guard === 0) 
        return {  mantissa: raw.slice(0, 23), overflow: false };

    // we do another check if there is a bit past the guard, if this fails, we return the mantissa flooring it to 23 bits
    if (raw.length <= 24) 
        return { mantissa: raw.concat(new Array(23).fill(0)).slice(0, 23), overflow: false };

    // this sets the 25th bit as the round bit
    const round = raw[24];
    // if round is 1, it's going to be a ceiling, so now we begin incrementing the mantissa
    if (round === 1) {
        const mantissa = raw.slice(0, 23);
        let carry = 1;
        for (let i = 22; i >= 0; i--) {
            const sum = mantissa[i] + carry;
            mantissa[i] = sum % 2;
            carry = Math.floor(sum / 2);
            // this break means we encountered a case of a carry over from a previous addition NOT resulting in a carry over on the current digit
            if (carry === 0) break;
        }
        // we now return the adjusted mantissa
        // overflow will be true if the incrementation overflowed the most significant bit of the mantissa
        return { mantissa, overflow: carry === 1 };
    } 

    // if reaching this line, guard = 0, round = 0, sticky = about to be determined

    // sticky bit, we just take 26th bit onward and find if there is a 1 somewhere there
    const sticky = raw.slice(25).some(b => b === 1);
    // flag to determine if we should increment
    // if the 23rd is a 1, this is a ties to even situation
    // if sticky is true, we know this is not ties to even and is greater than half 
    const shouldRoundUp = sticky || raw[22] === 1;
    if (!shouldRoundUp) {
        // if not true from above, we do not round up, we simply truncate
        return { mantissa: raw.slice(0, 23), overflow: false };
    }
    const mantissa = raw.slice(0, 23);
    // this is the same mantissa incrementation process seen in the round bit section earlier
    let carry = 1;
    for (let i = 22; i >= 0; i--) {
        const sum = mantissa[i] + carry;
        mantissa[i] = sum % 2;
        carry = Math.floor(sum / 2);
        if (carry === 0) break;
    }
    // we now return the incremented mantissa after determining sticky bit is 1. Now tell convert() to increment exponent
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

// custom data type for storing the outputs
type ArithmeticBinaryResult = {
    arithmeticMagnitude: number[];      // magnitude
    arithmeticPointIndex: number;       // indicates at which index does the fractional part start in input
                                        // -1 if input is whole number
    guardBit: number;                   // guard bit
    stickyAny: boolean;                 // true if any dropped bits after the guard bit were non-zero, false if not
    roundedUp: boolean;                 // true if number was rounded up, false if not
};

// custom data type for storing output for decimal data type
type DecimalResult = {
    value: number | string;     // rounded string or numeric output
    guardBit: number;           // guard bit
    stickyAny: boolean;         // true if any dropped bits after the guard bit were non-zero, false if not
    roundedUp: boolean;         // true if number was rounded up, false if not
};

// --------------------------------------------------
// MAIN ENTRANCE FOR ROUNDING METHODS

// properly formats and converts user input depending on the input (binary, decimal, or ieee)
export function roundingMethods(inputStr: string, signedStr: string, signBitStr: string, target: string, type: string) {
    const targetNum = Number(target);

    // if number is in binary then it uses the binary rounding functions
    // if number is in decimal then it uses the decimal rounding functions
    // if number is in ieee then it uses the binary rounding functions (adjust input to only include magnitude)
    if (type === "binary") {
        const inputBinary = formatBinaryInput(inputStr, signedStr, signBitStr);
        return roundBinary(inputBinary, targetNum);
    } else if (type === "decimal") {
        const inputDec = Number(inputStr);
        return roundDec(inputDec, targetNum, inputStr);
    } else if (type === "ieee") {
        const inputDec = parseIeeeInputToDecimal(inputStr);
        return roundDec(inputDec, targetNum);
    }
}

// parse IEEE input to decimal data type
function parseIeeeInputToDecimal(inputStr: string): number {
    const cleaned = inputStr.trim().replace(/^0x/i, "").replace(/\s+/g, "");
    let uint32 = 0;

    // parse 32-bit binary string
    if (/^[01]{32}$/.test(cleaned)) {
        uint32 = parseInt(cleaned, 2) >>> 0;
    } else if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
        // parse 8-digit hexadecimal representation
        uint32 = parseInt(cleaned, 16) >>> 0;
    } else {
        // fallback parsing as raw numeric string
        const num = Number(inputStr);
        return Number.isNaN(num) ? 0 : num;
    }

    // decode uint32 bit pattern as IEEE 754 single-precision float
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint32(0, uint32, false);

    return view.getFloat32(0, false);
}

// directs to rounding methods for binary/ieee inputs
function roundBinary(binaryInput: FormattedBinaryInput, targetBits: number) {
    return {
        truncate: truncateBinary(binaryInput, targetBits),
        roundUp: roundUpBinary(binaryInput, targetBits),
        roundDown: roundDownBinary(binaryInput, targetBits),
        roundNearest: roundNearBinary(binaryInput, targetBits)
    };
}

// directs to rounding methods for decimal inputs
function roundDec(decInput: number, targetDigits: number, rawStr?: string) {
    return {
        truncate: truncateDec(decInput, targetDigits, rawStr),
        roundUp: roundUpDec(decInput, targetDigits, rawStr),
        roundDown: roundDownDec(decInput, targetDigits, rawStr),
        roundNearest: roundNearDec(decInput, targetDigits, rawStr)
    };
}

// formats input to object type FormattedBinaryInput and returns object
function formatBinaryInput(inputStr: string, signedStr: string, signbitStr: string): FormattedBinaryInput {
    let signed = signedStr === "signed";                // indicate whether input is signed (true) or unsigned (false) binary
    let clean = inputStr.trim().replace(/^[+-]/, "");   // cleaned input
    let signBit = signed ? Number(signbitStr) : -1;     // converts sign bit to number, defaults to -1 if unsigned
    let decimalPointIndex = clean.indexOf(".");         // determine the index of the decimal point

    // converts input to array of numbers for correct formatting
    let result: number[] = [];
    for (let i = 0; i < clean.length; i++) {
        if (clean[i] !== ".") {
            if (clean[i] === "0") result.push(0);
            else if (clean[i] === "1") result.push(1);
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

// helper to get guard, sticky bit status, and cutoff index for binary numbers
function getBinaryGuardAndSticky(binaryInput: FormattedBinaryInput, targetBits: number) {
    const { magnitude } = binaryInput;
    const firstSigFig = findFirstSigFig(magnitude);     // get first significant bit

    // if input is 0 then return 0
    if (firstSigFig === -1) {
        return { 
            guardBit: 0, 
            stickyAny: false, 
            cutIndex: -1 
        };
    }

    // index where to cut
    const cutIndex = firstSigFig + targetBits;

    // guard bit
    const guardBit = cutIndex < magnitude.length ? magnitude[cutIndex] : 0;
    
    // sticky bits
    const stickyBits = cutIndex + 1 < magnitude.length ? magnitude.slice(cutIndex + 1) : [];
    const stickyAny = stickyBits.some(b => b === 1);    // true if any dropped bits after the guard bit were non-zero, false if not

    // return guard bit, sticky bit status, and cut index
    return { 
        guardBit, 
        stickyAny, 
        cutIndex 
    };
}

// return incremented binary number and new point index
function incrementBinaryAtCut(binaryInput: FormattedBinaryInput, targetBits: number): { arithmeticMagnitude: number[]; arithmeticPointIndex: number } {
    const { magnitude, decimalPointIndex } = binaryInput;

    // finds first significant bit
    const firstSigFig = findFirstSigFig(magnitude);
    if (firstSigFig === -1) {
        return { arithmeticMagnitude: [0], arithmeticPointIndex: -1 };
    }

    // index where to cut or split
    const cutIndex = firstSigFig + targetBits;
    const intLen = decimalPointIndex === -1 ? magnitude.length : decimalPointIndex;

    let prefix: number[];
    let suffix: number[];
    let pointIndex: number;

    // extract kept prefix and construct required trailing integer zeros if cut occurs before decimal point
    if (cutIndex < intLen) {
        prefix = magnitude.slice(0, cutIndex);
        suffix = new Array(intLen - cutIndex).fill(0);
        pointIndex = -1;
    } else {
        prefix = magnitude.slice(0, cutIndex);
        while (prefix.length < cutIndex) {
            prefix.push(0);
        }
        suffix = [];
        pointIndex = decimalPointIndex;
    }

    let carry = 1;      // initialize to 1 for addition at LSB

    // increments binary number
    for (let i = prefix.length - 1; i >= 0; i--) {
        let sumBit = prefix[i] + carry;
        prefix[i] = sumBit % 2;
        carry = Math.floor(sumBit / 2);
    }

    // put carry overflow bit at start if carry remains at MSB position
    if (carry) {
        prefix.unshift(1);
        if (pointIndex !== -1) {
            pointIndex += 1;
        }
    }

    let combined = [...prefix, ...suffix];

    // strip unnecessary trailing zeros after fractional point
    while (
        pointIndex !== -1 &&
        combined.length > pointIndex &&
        combined[combined.length - 1] === 0
    ) {
        combined.pop();
    }

    // convert to whole number if fractional part was completely stripped
    if (pointIndex !== -1 && combined.length <= pointIndex) {
        pointIndex = -1;
    }

    // return magnitude and new point index
    return {
        arithmeticMagnitude: combined,
        arithmeticPointIndex: pointIndex
    };
}

// helper to get guard, sticky bit status, and cutoff index for decimal numbers
function getDecimalGuardSticky(input: number, targetDigits: number, rawStr?: string) {
    // if input is 0 then return 0
    if (input === 0) 
        return { 
            guardBit: 0, 
            stickyAny: false 
        };

    const absoluteInput = Math.abs(input);
    let formattedInput = rawStr ? rawStr.trim().replace(/^[-+]/, '') : absoluteInput.toString();
    
    // expand scientific notation strings into standard decimal format
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '').replace(/\.$/, '');
    }

    const [intPart, fracPart = ''] = formattedInput.split('.');

    let disregardStr = '';

    // determine dropped digits based on whether number is >= 1 or < 1
    if (absoluteInput >= 1) {
        if (intPart.length >= targetDigits) {
            disregardStr = intPart.slice(targetDigits) + fracPart;
        } else {
            const neededFrac = targetDigits - intPart.length;
            disregardStr = fracPart.slice(neededFrac);
        }
    } else {
        const firstSigFig = fracPart.search(/[1-9]/);

        if (firstSigFig === -1) 
            return { guardBit: 0, stickyAny: false };

        disregardStr = fracPart.slice(firstSigFig + targetDigits);
    }

    if (!disregardStr) 
        return { 
            guardBit: 0, 
            stickyAny: false 
        };

    const guardBit = Number(disregardStr[0]);               // guard bit
    const stickyDigits = disregardStr.slice(1);             // sticky digits
    const stickyAny = stickyDigits.search(/[1-9]/) !== -1;  // sticky bit status

    // return guard bit and sticky bit status
    return { 
        guardBit, 
        stickyAny 
    };
}

// increments decimal
function incrementDecimalString(keptStr: string, fracDigits: number): string {
    const cleanStr = keptStr.replace('.', '');
    const incrementedBigInt = BigInt(cleanStr) + BigInt(1);
    let str = incrementedBigInt.toString();

    // reinsert decimal point if fractional digits exist
    if (fracDigits > 0) {
        while (str.length <= fracDigits) {
            str = '0' + str;
        }
        const intP = str.slice(0, str.length - fracDigits);
        const fracP = str.slice(str.length - fracDigits);
        return `${intP}.${fracP}`;
    }

    return str;
}

// --------------------------------------------------
// TRUNCATION (RTZ) - cuts off until target number of bits

// handles the truncation for binary numbers
function truncateBinary(binaryInput: FormattedBinaryInput, targetBits: number): ArithmeticBinaryResult {
    const { magnitude, decimalPointIndex } = binaryInput;
    const { guardBit, stickyAny } = getBinaryGuardAndSticky(binaryInput, targetBits);   // get guard bit and sticky

    // Find the first non-zero bit (first significant figure)
    const firstSigFig = findFirstSigFig(magnitude);

    // if input is 0 return 0
    if (firstSigFig === -1) {
        return {
            arithmeticMagnitude: [0],
            arithmeticPointIndex: -1,
            guardBit: 0,
            stickyAny: false,
            roundedUp: false
        };
    }

    // get length
    const intLen = decimalPointIndex === -1 ? magnitude.length : decimalPointIndex;
    
    // Determine the end index of bits to keep
    const keepEndIndex = firstSigFig + targetBits;

    // magnitude of the bits to keep
    let keptMagnitude: number[];
    let newPointIndex = decimalPointIndex;  // stores new decimal point index

    // zero-pad whole numbers if cutIndex happens before decimal point
    if (keepEndIndex < intLen) {
        const kept = magnitude.slice(0, keepEndIndex);
        const zeroPadding = new Array(intLen - keepEndIndex).fill(0);
        keptMagnitude = [...kept, ...zeroPadding];
        newPointIndex = -1;
    } else {
        keptMagnitude = magnitude.slice(0, Math.min(keepEndIndex, magnitude.length));

        // trim trailing fractional zeros
        while (
            newPointIndex !== -1 &&
            keptMagnitude.length > newPointIndex &&
            keptMagnitude[keptMagnitude.length - 1] === 0
        ) {
            keptMagnitude.pop();
        }

        if (newPointIndex !== -1 && keptMagnitude.length <= newPointIndex) {
            newPointIndex = -1;
        }
    }

    return {
        arithmeticMagnitude: keptMagnitude,
        arithmeticPointIndex: newPointIndex,
        guardBit,
        stickyAny,
        roundedUp: false
    };
}

// handles the truncation for decimal numbers (including whole numbers and floats)
function truncateDec(input: number, targetDigits: number, rawStr?: string): DecimalResult {
    const { guardBit, stickyAny } = getDecimalGuardSticky(input, targetDigits, rawStr);
    
    // if input is 0 return 0
    if (input === 0) 
        return { 
            value: 0, 
            guardBit: 0, 
            stickyAny: false, 
            roundedUp: false 
        };

    const sign = input < 0 ? '-' : '';
    const absoluteInput = Math.abs(input);
    let formattedInput = rawStr ? rawStr.trim().replace(/^[-+]/, '') : absoluteInput.toString();

    // handle scientific notation string format
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '').replace(/\.$/, '');
    }

    const [intPart, fracPart = ''] = formattedInput.split('.');

    // pad integer part with trailing zeros if integer digits exceed target digits
    if (intPart.length >= targetDigits && absoluteInput >= 1) {
        const keep = intPart.slice(0, targetDigits);
        const zeroPadding = '0'.repeat(intPart.length - targetDigits);
        return {
            value: `${sign}${keep}${zeroPadding}`,
            guardBit,
            stickyAny,
            roundedUp: false
        };
    }

    let truncatedFrac = '';

    // truncate fractional part based on relative magnitude (< 1 vs >= 1)
    if (absoluteInput < 1 && absoluteInput > 0) {
        const firstSigFig = fracPart.search(/[1-9]/);
        if (firstSigFig === -1) return { value: 0, guardBit: 0, stickyAny: false, roundedUp: false };
        truncatedFrac = fracPart.slice(0, targetDigits + firstSigFig);
    } else {
        truncatedFrac = fracPart.slice(0, targetDigits - intPart.length);
    }

    const resultStr = `${sign}${intPart}.${truncatedFrac}`;
    return {
        value: resultStr,
        guardBit,
        stickyAny,
        roundedUp: false
    };
}

// --------------------------------------------------
// ROUND UP (RTP) - rounds towards positive infinity

// handles rounding up for binary numbers
function roundUpBinary(binaryInput: FormattedBinaryInput, targetBits: number): ArithmeticBinaryResult {
    const truncated = truncateBinary(binaryInput, targetBits);

    if (binaryInput.signed && binaryInput.signBit === 1) {
        return truncated;
    }

    const firstSigFig = findFirstSigFig(binaryInput.magnitude);
    if (firstSigFig === -1) return truncated;

    const cutIndex = firstSigFig + targetBits;
    const discardedBits = binaryInput.magnitude.slice(cutIndex);
    const hasNonZeroDiscarded = discardedBits.some(bit => bit === 1);

    if (hasNonZeroDiscarded) {
        const inc = incrementBinaryAtCut(binaryInput, targetBits);
        return {
            arithmeticMagnitude: inc.arithmeticMagnitude,
            arithmeticPointIndex: inc.arithmeticPointIndex,
            guardBit: truncated.guardBit,
            stickyAny: truncated.stickyAny,
            roundedUp: true
        };
    }

    return truncated;
}

function roundUpDec(input: number, targetDigits: number, rawStr?: string): DecimalResult {
    const truncated = truncateDec(input, targetDigits, rawStr);
    if (input <= 0) return truncated;

    const { guardBit, stickyAny } = truncated;
    const hasDiscarded = guardBit !== 0 || stickyAny;

    if (!hasDiscarded) return truncated;

    const absoluteInput = Math.abs(input);
    let formattedInput = rawStr ? rawStr.trim().replace(/^[-+]/, '') : absoluteInput.toString();
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '').replace(/\.$/, '');
    }
    const [intPart, fracPart = ''] = formattedInput.split('.');

    let valStr: string;
    if (absoluteInput >= 1) {
        if (intPart.length >= targetDigits) {
            const keep = intPart.slice(0, targetDigits);
            const incremented = (BigInt(keep) + BigInt(1)).toString();
            const zeroPadding = '0'.repeat(intPart.length - targetDigits);
            valStr = incremented + zeroPadding;
        } else {
            const keepFracDigits = targetDigits - intPart.length;
            const keepFrac = fracPart.slice(0, keepFracDigits);
            const keptStr = `${intPart}.${keepFrac}`;
            valStr = incrementDecimalString(keptStr, keepFracDigits);
        }
    } else {
        const firstSigFig = fracPart.search(/[1-9]/);
        const cutIndex = firstSigFig + targetDigits;
        const keepFrac = fracPart.slice(0, cutIndex);
        const keptStr = `0.${keepFrac}`;
        valStr = incrementDecimalString(keptStr, cutIndex);
    }

    return {
        value: valStr,
        guardBit,
        stickyAny,
        roundedUp: true
    };
}

// --------------------------------------------------
// ROUND DOWN (RTN - Toward -Infinity)
// --------------------------------------------------

function roundDownBinary(binaryInput: FormattedBinaryInput, targetBits: number): ArithmeticBinaryResult {
    const truncated = truncateBinary(binaryInput, targetBits);

    if (!binaryInput.signed || binaryInput.signBit === 0) {
        return truncated;
    }

    const firstSigFig = findFirstSigFig(binaryInput.magnitude);
    if (firstSigFig === -1) return truncated;

    const cutIndex = firstSigFig + targetBits;
    const discardedBits = binaryInput.magnitude.slice(cutIndex);
    const hasNonZeroDiscarded = discardedBits.some(bit => bit === 1);

    if (hasNonZeroDiscarded) {
        const inc = incrementBinaryAtCut(binaryInput, targetBits);
        return {
            arithmeticMagnitude: inc.arithmeticMagnitude,
            arithmeticPointIndex: inc.arithmeticPointIndex,
            guardBit: truncated.guardBit,
            stickyAny: truncated.stickyAny,
            roundedUp: true
        };
    }

    return truncated;
}

function roundDownDec(input: number, targetDigits: number, rawStr?: string): DecimalResult {
    const truncated = truncateDec(input, targetDigits, rawStr);
    if (input >= 0) return truncated;

    const { guardBit, stickyAny } = truncated;
    const hasDiscarded = guardBit !== 0 || stickyAny;

    if (!hasDiscarded) return truncated;

    const absoluteInput = Math.abs(input);
    let formattedInput = rawStr ? rawStr.trim().replace(/^[-+]/, '') : absoluteInput.toString();
    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '').replace(/\.$/, '');
    }
    const [intPart, fracPart = ''] = formattedInput.split('.');

    let valStr: string;
    if (absoluteInput >= 1) {
        if (intPart.length >= targetDigits) {
            const keep = intPart.slice(0, targetDigits);
            const incremented = (BigInt(keep) + BigInt(1)).toString();
            const zeroPadding = '0'.repeat(intPart.length - targetDigits);
            valStr = '-' + incremented + zeroPadding;
        } else {
            const keepFracDigits = targetDigits - intPart.length;
            const keepFrac = fracPart.slice(0, keepFracDigits);
            const keptStr = `${intPart}.${keepFrac}`;
            valStr = '-' + incrementDecimalString(keptStr, keepFracDigits);
        }
    } else {
        const firstSigFig = fracPart.search(/[1-9]/);
        const cutIndex = firstSigFig + targetDigits;
        const keepFrac = fracPart.slice(0, cutIndex);
        const keptStr = `0.${keepFrac}`;
        valStr = '-' + incrementDecimalString(keptStr, cutIndex);
    }

    return {
        value: valStr,
        guardBit,
        stickyAny,
        roundedUp: true
    };
}

// --------------------------------------------------
// ROUND TO NEAREST (RNE - Ties to Even)
// --------------------------------------------------

function roundNearBinary(binaryInput: FormattedBinaryInput, targetBits: number): ArithmeticBinaryResult {
    const truncated = truncateBinary(binaryInput, targetBits);
    const { guardBit, stickyAny } = truncated;

    const firstSigFig = findFirstSigFig(binaryInput.magnitude);
    if (firstSigFig === -1) return truncated;

    const cutIndex = firstSigFig + targetBits;
    const lsbIndex = cutIndex - 1;
    const lsb = lsbIndex >= 0 && lsbIndex < binaryInput.magnitude.length ? binaryInput.magnitude[lsbIndex] : 0;

    let shouldIncrement = false;

    if (guardBit === 1) {
        if (stickyAny) {
            shouldIncrement = true;
        } else {
            if (lsb === 1) {
                shouldIncrement = true;
            }
        }
    }

    if (shouldIncrement) {
        const inc = incrementBinaryAtCut(binaryInput, targetBits);
        return {
            arithmeticMagnitude: inc.arithmeticMagnitude,
            arithmeticPointIndex: inc.arithmeticPointIndex,
            guardBit,
            stickyAny,
            roundedUp: true
        };
    }

    return truncated;
}

function roundNearDec(input: number, targetDigits: number, rawStr?: string): DecimalResult {
    const truncated = truncateDec(input, targetDigits, rawStr);
    if (input === 0) return truncated;

    const { guardBit, stickyAny } = truncated;
    const absoluteInput = Math.abs(input);
    let formattedInput = rawStr ? rawStr.trim().replace(/^[-+]/, '') : absoluteInput.toString();

    if (formattedInput.includes('e')) {
        formattedInput = absoluteInput.toFixed(50).replace(/0+$/, '').replace(/\.$/, '');
    }

    const [intPart, fracPart = ''] = formattedInput.split('.');

    let lastKeepDigit = 0;

    if (absoluteInput >= 1) {
        if (intPart.length >= targetDigits) {
            const keepStr = intPart.slice(0, targetDigits);
            lastKeepDigit = Number(keepStr[keepStr.length - 1]);
        } else {
            const neededFracDigits = targetDigits - intPart.length;
            const keepFracStr = fracPart.slice(0, neededFracDigits);
            const fullKeptStr = intPart + keepFracStr;
            lastKeepDigit = Number(fullKeptStr[fullKeptStr.length - 1] || 0);
        }
    } else {
        const firstSigFig = fracPart.search(/[1-9]/);
        if (firstSigFig !== -1) {
            const keepFracStr = fracPart.slice(firstSigFig, firstSigFig + targetDigits);
            lastKeepDigit = Number(keepFracStr[keepFracStr.length - 1] || 0);
        }
    }

    const isNegative = input < 0;
    let shouldIncrement = false;

    if (guardBit > 5) {
        shouldIncrement = true;
    } else if (guardBit === 5) {
        if (stickyAny) {
            shouldIncrement = true;
        } else {
            if (lastKeepDigit % 2 !== 0) {
                shouldIncrement = true;
            }
        }
    }

    if (shouldIncrement) {
        const res = isNegative ? roundDownDec(input, targetDigits, rawStr) : roundUpDec(input, targetDigits, rawStr);
        return {
            value: res.value,
            guardBit,
            stickyAny,
            roundedUp: true
        };
    }

    return truncated;
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