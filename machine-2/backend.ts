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
    while (input !== 0 && convertedFrac.length < precision) {
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
    let mantissa = new Array(precision).fill(0).slice(0, precision);
    const signString = signBit === 1 ? `-` : `+`;
    let leadDigit = `0`;

    if (input !== 0) {
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
            mantissa = new Array(shift).fill(0).concat(mantissa).slice(0, precision);
        }
        else {
            mantissa = mantissa.concat(new Array(precision).fill(0)).slice(0, precision);
        }
        leadDigit = `1`;
    }

    return {
        normalized: `${signString}${leadDigit}.${mantissa.join("")} X 2^${exponent}`,
        binary: buildBinary(signBit, determineExponentBits(exponent), mantissa)
    };
}

export function determineExponentBits(exponent: number) {
    if (exponent > 127) return [1, 1, 1, 1, 1, 1, 1, 1];
    if (exponent < -126) return [0, 0, 0, 0, 0, 0, 0, 0];
    const ePrime = exponent + 127;
    const bits = convertWhole(ePrime);
    return new Array(8 - bits.length).fill(0).concat(bits);
}

export function buildBinary(signBit: number, exponent: number[], mantissa: number[]) {
    const full = [String(signBit), ...exponent.map(String), ...mantissa.map(String)].join("");
    return full.match(/.{1,4}/g)?.join(" ");
}