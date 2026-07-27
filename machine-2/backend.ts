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
    if (input === 0) {
        convertedFrac.push(0);
    }
    while (input !== 0 && convertedFrac.length < precision) {
        input *= 2;
        convertedFrac.push(Math.floor(input));
        input -= Math.floor(input); 
    }
    return convertedFrac;        
}

export function normalize(whole: number[], frac: number[]) {
    if (whole[0] !== 0) return { exponent: whole.length - 1, mantissa: whole.slice(1).concat(frac) };
    const first = frac.indexOf(1);
    return { exponent: -(first + 1), mantissa: frac.slice(first + 1) };
}

export function convert(input: number) {
    let signBit = 0;
    let convertedWhole = [0];
    let convertedFrac = [0];
    let exponent = 0;
    let mantissa = [0];
    let signString = `+`;
    let leadDigit = `0`;

    if (input !== 0) {
        signBit = determineSign(input);
        convertedWhole = convertWhole(input);
        convertedFrac = convertFrac(input, 4);
        const res = normalize(convertedWhole, convertedFrac);
        exponent = res.exponent;
        mantissa = res.mantissa;
        signString = signBit === 1 ? `-` : `+`;
        leadDigit = `1`;
    }

    return `${signString}${leadDigit}.${mantissa.join("")} X 2^${exponent}`;
}