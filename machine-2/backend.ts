'use server'

export function determineSign(input: number) {
    return Object.is(input, -0) || input < 0 ? 1 : 0;
}

export function convertWhole(input: number) {
    input = Math.trunc(input);
    input = Math.abs(input);
    const convertedInt = [];
    if (input === 0) {
        convertedInt.push(0);
    }
    while (input !== 0) {
        convertedInt.push(input % 2);
        input = Math.trunc(input / 2);        
    }
    return convertedInt.reverse();     
}

export function convertFrac(input: number, precision: number) {
    input = Math.abs(input);
    input = input % 1;
    const convertedFrac = [];
    while (input !== 0 && convertedFrac.length < precision + 8) {
        input *= 2;
        convertedFrac.push(Math.floor(input));
        input -= Math.trunc(input); 
    }
    return convertedFrac;        
}

export function normalize(whole: number[], frac: number[]) {
    if (whole[0] !== 0) return { exponent: whole.length - 1, mantissa: whole.slice(1).concat(frac) };
    const first = frac.indexOf(1);
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
    if (exponent > 127) return [1, 1, 1, 1, 1, 1, 1, 1];
    if (exponent < -126 || flag) return [0, 0, 0, 0, 0, 0, 0, 0];
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

export function roundMantissa(raw: number[]) {
    if (raw.length <= 23) return { mantissa: raw.concat(new Array(23).fill(0)).slice(0, 23), overflow: false };
    const guard = raw[23];
    if (guard === 0) return {  mantissa: raw.slice(0, 23), overflow: false };
    if (raw.length <= 24) return { mantissa: raw.concat(new Array(23).fill(0)).slice(0, 23), overflow: false };

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