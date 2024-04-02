import { SignatureGenerator } from "./algorithm.js";
import { DecodedMessage } from "./signatures.js";
import { default as fetch } from "node-fetch"
import { ShazamRoot } from "./types/shazam.js";
import { s16LEToSamplesArray } from "./utils.js";
import fs from 'fs'
import { convertfile } from "./to_pcm.js";
const TIME_ZONE = "Europe/Paris";

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }).toUpperCase();
  }
  

export class Endpoint{
    static SCHEME = "https";
    static HOSTNAME = "amp.shazam.com";

    constructor(public timezone: string){};
    url(){
        return `${Endpoint.SCHEME}://${Endpoint.HOSTNAME}/discovery/v5/en/US/iphone/-/tag/${uuidv4()}/${uuidv4()}`;
    }
    params(){
        return {
            'sync': 'true',
            'webv3': 'true',
            'sampling': 'true',
            'connected': '',
            'shazamapiversion': 'v3',
            'sharehub': 'true',
            'hubv5minorversion': 'v5.1',
            'hidelb': 'true',
            'video': 'v3'
        };
    }
    headers(){
        return {
            "X-Shazam-Platform": "IPHONE",
            "X-Shazam-AppVersion": "14.1.0",
            "Accept": "*/*",
            "Content-Type": "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "en",
            "User-Agent": "Shazam/3685 CFNetwork/1197 Darwin/20.0.0"
        }
    }


    async sendRecognizeRequest(url: string, body: string): Promise<ShazamRoot | null> {
        //@ts-ignore
        return await (await fetch(url, { body, headers: this.headers(), method: "POST" })).json();
    }

    async formatAndSendRecognizeRequest(signature: DecodedMessage): Promise<ShazamRoot | null>{
        let data = {
            'timezone': this.timezone,
            'signature': {
                'uri': signature.encodeToUri(),
                'samplems': Math.round(signature.numberSamples / signature.sampleRateHz * 1000)
            },
            'timestamp': new Date().getTime(),
            'context': {},
            'geolocation': {}
        };
        const url = new URL(this.url());
        Object.entries(this.params()).forEach(([a, b]) => url.searchParams.append(a, b));

        let response = await this.sendRecognizeRequest(url.toString(), JSON.stringify(data));
        if(response?.matches.length === 0) return null;

        return response as ShazamRoot;
    }
}

export class Shazam{
    static MAX_TIME_SCEONDS = 8;

    public endpoint: Endpoint;
    constructor(timeZone?: string){
        this.endpoint = new Endpoint(timeZone ?? TIME_ZONE);
    }

    
    async fromFilePath(path: string){
        await convertfile(path)
        const data = fs.readFileSync('output.pcm')
        
        const conv = s16LEToSamplesArray(data)
        fs.unlinkSync('output.pcm')
        const recognise = await this.recognizeSong(conv)
        return recognise

    }

    async recognizeSong(samples: number[], callback?: ((state: "generating" | "transmitting") => void)){
        let response = await this.fullRecognizeSong(samples, callback);
        if(!response) return null;

        const
            trackData = response.track,
            mainSection = trackData.sections.find((e: any) => e.type === "SONG")!;
        const
            title = trackData.title,
            artist = trackData.subtitle,
            album = mainSection.metadata!.find(e => e.title === "Album")?.text,
            year = mainSection.metadata!.find(e => e.title === "Released")?.text;
        return { title, artist, album, year };

    }

    async fullRecognizeSong(samples: number[], callback?: ((state: "generating" | "transmitting") => void)){
        callback?.("generating");
        let generator = this.createSignatureGenerator(samples);
        while(true){
            callback?.("generating");
            const signature = generator.getNextSignature();
            if(!signature){
                break;
            }
            callback?.("transmitting");
            let results = await this.endpoint.formatAndSendRecognizeRequest(signature);
            if(results !== null) return results;
        }
        return null;
    }

    createSignatureGenerator(samples: number[]){
        let signatureGenerator = new SignatureGenerator();
        signatureGenerator.feedInput(samples);
        return signatureGenerator;
    }
}