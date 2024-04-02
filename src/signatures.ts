import { Buffer } from 'buffer';

const crc32 = function(str: number[]) {
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }

    var crc = 0 ^ (-1);

    for (var i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str[i]) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
};
export enum FrequencyBand{
    _0_250 = -1,
    _250_520 = 0,
    _520_1450 = 1,
    _1450_3500 = 2,
    _3500_5500 = 3,
};

export enum SampleRate{
    _8000 = 1,
    _11025 = 2,
    _16000 = 3,
    _32000 = 4,
    _44100 = 5,
    _48000 = 6,
};

const DATA_URI_PREFIX = 'data:audio/vnd.shazam.sig;base64,';

export class FrequencyPeak{
    constructor(public fftPassNumber: number, public peakMagnitude: number, public correctedPeakFrequencyBin: number, public sampleRateHz: number){}

    getFrequencyHz(){
        return this.correctedPeakFrequencyBin * (this.sampleRateHz / 2 / 1024 / 64);
    }

    getAmplitudePcm(){
        return Math.sqrt(Math.exp((this.peakMagnitude - 6144) / 1477.3) * (1 << 17) / 2) / 1024;
    }

    getSeconds(){
        return (this.fftPassNumber * 128) / this.sampleRateHz;
    }
}

export interface RawSignatureHeader{
    magic1: number;
    crc32: number;
    sizeMinusHeader: number;
    magic2: number;
    shiftedSampleRateId: number;
    numberSamplesPlusDividedSampleRate: number;
    fixedValue: number;
}

const readUint32 = (data: Uint8Array) => {
    return (
        data[0] >> 24 |
        data[1] >> 16 |
        data[2] >> 8 |
        data[3]
    );
}
const padTo32       = (data: Uint8Array) => new Uint8Array([...data, ...Array(4 - data.length).fill(0)]);
const readInt32     = (data: Uint8Array) => new Int32Array(data)[0];
const writeUint32   = (e: number) => [e & 0xff, (e >> 8) & 0xff, (e >> 16) & 0xff, (e >> 24) & 0xff];
const writeInt32    = (e: number) => {
    let q = new DataView(new ArrayBuffer(4), 0);
    q.setInt32(0, e, true);
    return new Uint8Array(q.buffer);
}
const writeInt16    = (e: number) => {
    let q = new DataView(new ArrayBuffer(2), 0);
    q.setInt16(0, e, true);
    return new Uint8Array(q.buffer);
}

export function readRawSignatureHeader(read: ((e?: number) => Uint8Array)){
    const _readUint32 = () => readUint32(read(4));
    const clear = (e: number) => Array(e).fill(0).map(readUint32);
    const
        magic1 = _readUint32(),
        crc32 = _readUint32(),
        sizeMinusHeader = _readUint32(),
        magic2 = _readUint32(),
        _a = clear(3),
        shiftedSampleRateId = _readUint32(),
        _b = clear(2),
        numberSamplesPlusDividedSampleRate = _readUint32(),
        fixedValue = _readUint32();
    return {magic1, crc32, sizeMinusHeader, magic2, shiftedSampleRateId, numberSamplesPlusDividedSampleRate, fixedValue};
}

export function writeRawSignatureHeader(rsh: RawSignatureHeader){
    let buffer: number[] = [];
    let _writeUint32 = (e: number) => buffer.push(...writeUint32(e));

    _writeUint32(rsh.magic1);
    _writeUint32(rsh.crc32);
    _writeUint32(rsh.sizeMinusHeader);
    _writeUint32(rsh.magic2);
    _writeUint32(0);
    _writeUint32(0);
    _writeUint32(0);
    _writeUint32(rsh.shiftedSampleRateId);
    _writeUint32(0);
    _writeUint32(0);
    _writeUint32(rsh.numberSamplesPlusDividedSampleRate);
    _writeUint32(rsh.fixedValue);
    
    return new Uint8Array(buffer);
}

export class DecodedMessage{
    sampleRateHz: number = 0;
    numberSamples: number = 0;
    frequencyBandToSoundPeaks: {[key: string]: FrequencyPeak[]} = {};

    static decodeFromBinary(bytes: Uint8Array){
        let self = new DecodedMessage();

        let ptr = 0;
        const read = (e?: number) => e === undefined ? bytes.slice(ptr, ptr = bytes.length) : bytes.slice(ptr, ptr += e);
        const seek = (e: number) => ptr = e;

        seek(8);
        const checksummableData = read();
        seek(0);
        const header: RawSignatureHeader = readRawSignatureHeader(read);

        if(header.magic1 != 0xcafe2580){
            console.log("ASSERT 3 FAIL");
        }

        self.sampleRateHz = parseInt(SampleRate[header.shiftedSampleRateId >> 27].substring(1));
        self.numberSamples = Math.round(header.numberSamplesPlusDividedSampleRate - self.sampleRateHz * 0.24);

        while(true){
            const tlvHeader = read(8);
            if(tlvHeader.length === 0) break;

            let frequencyBandId = readInt32(tlvHeader.slice(0, 4)),
                frequencyPeaksSize = readInt32(tlvHeader.slice(4));
            let frequencyPeaksPadding = 4 + (-frequencyPeaksSize % 4);
            read(frequencyPeaksPadding);

            let frequencyBand = (frequencyBandId - 0x60030040) as FrequencyBand;
            let fftPassNumber = 0;
            self.frequencyBandToSoundPeaks[FrequencyBand[frequencyBand]] = [];

            while(true){
                let rawFftPass = read(1);
                if(rawFftPass.length === 0) break;

                let fftPassOffset = rawFftPass[0];
                if(fftPassOffset === 0xff){
                    fftPassNumber = readInt32(read(4));
                    continue;
                }else{
                    fftPassNumber += fftPassOffset
                }

                let peakMagnitude = readInt32(padTo32(read(2)));
                let correctedPeakFrequencyBin = readInt32(padTo32(read(2)));

                self.frequencyBandToSoundPeaks[FrequencyBand[frequencyBand]].push(
                    new FrequencyPeak(fftPassNumber, peakMagnitude, correctedPeakFrequencyBin, self.sampleRateHz)
                );
            }
        }

        return self;
    }

    static decodeFromUri(uri: string){
        if(!uri.startsWith(DATA_URI_PREFIX)){
            throw new Error("assert 4");
        }
        return this.decodeFromBinary(Buffer.from(uri.replace(DATA_URI_PREFIX, ""), "base64"));
    }

    encodeToBinary(){
        let header: RawSignatureHeader = {
            magic1: 0xcafe2580,
            magic2: 0x94119c00,
            shiftedSampleRateId: SampleRate[`_${this.sampleRateHz}` as any] as unknown as number << 27,
            fixedValue: ((15 << 19) + 0x40000),
            numberSamplesPlusDividedSampleRate: Math.round(this.numberSamples + this.sampleRateHz * 0.24),

            crc32: -1,
            sizeMinusHeader: -1
        };
        
        let contentsBuf: number[] = [];
        
        for(let x of Object.entries(this.frequencyBandToSoundPeaks).map(a => [FrequencyBand[a[0] as any] as unknown as number, a[1]]).sort((a, b) => ((a[0] as number) - (b[0] as number)))){
            const
                frequencyBand = x[0] as number,
                frequencyPeaks = x[1] as FrequencyPeak[];

            let peaksBuffer: number[] = [];

            let fftPassNumber = 0;

            for(let frequencyPeak of frequencyPeaks){
                if(frequencyPeak.fftPassNumber < fftPassNumber){
                    throw new Error("Assert 5");
                }

                if((frequencyPeak.fftPassNumber - fftPassNumber) >= 0xff){
                    peaksBuffer.push(0xff);
                    peaksBuffer.push(...writeInt32(frequencyPeak.fftPassNumber));
                    fftPassNumber = frequencyPeak.fftPassNumber;
                }

                peaksBuffer.push(frequencyPeak.fftPassNumber - fftPassNumber);
                peaksBuffer.push(...writeInt16(frequencyPeak.peakMagnitude - 1));
                peaksBuffer.push(...writeInt16(frequencyPeak.correctedPeakFrequencyBin - 1));
                fftPassNumber = frequencyPeak.fftPassNumber;
            }
            contentsBuf.push(...writeInt32(0x60030040 + frequencyBand));
            contentsBuf.push(...writeInt32(peaksBuffer.length));
            contentsBuf = contentsBuf.concat(peaksBuffer);
            let paddingCount = 4 - (peaksBuffer.length % 4);
            if(paddingCount < 4) contentsBuf.push(...Array(paddingCount).fill(0));
        }

        header.sizeMinusHeader = contentsBuf.length + 8;

        let buf: number[] = [];
        buf.push(...writeRawSignatureHeader(header));
        buf.push(...writeInt32(0x40000000));
        buf.push(...writeInt32(contentsBuf.length + 8));
        buf = buf.concat(contentsBuf);
        header.crc32 = crc32(buf.slice(8));
        let newHeader = writeRawSignatureHeader(header);
        buf.splice(0, newHeader.length, ...newHeader);

        return buf;
    }
    
    encodeToUri(){
        const bin = this.encodeToBinary();
        return DATA_URI_PREFIX + Buffer.from(bin).toString('base64');
    }
}
