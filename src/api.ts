import { SignatureGenerator } from "./algorithm.js";
import { DecodedMessage } from "./signatures.js";
import { default as fetch } from "node-fetch"
import { ShazamRoot } from "./types/shazam.js";
import { s16LEToSamplesArray } from "./utils.js";
import fs from 'fs'
import { Device,Request,ShazamURLS } from "./requests.js";
import { USER_AGENTS } from "./useragents.js";
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
    headers(language: string = 'en'){
        return Request.headers(language)
    }


    async sendRecognizeRequest(url: string, body: string, language: string = 'en'): Promise<ShazamRoot | null> {
        //@ts-ignore
        return await (await fetch(url, { body, headers: this.headers(language), method: "POST" })).json();
    }

    async formatAndSendRecognizeRequest(signature: DecodedMessage, language: string = 'en'): Promise<ShazamRoot | null>{
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

        let response = await this.sendRecognizeRequest(url.toString(), JSON.stringify(data), language);
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

    headers(language: string = 'en'){
        return Request.headers(language)
    }

    async fromFilePath(path: string, minimal: Boolean = false, language: string = 'en'){
        await convertfile(path)
        const data = fs.readFileSync('output.pcm')
        
        const conv = s16LEToSamplesArray(data)
        fs.unlinkSync('output.pcm')
        const recognise = minimal ? await this.recognizeSongMinimal(conv,language) : await this.recognizeSong(conv,language)
        return recognise

    }

    async recognizeSong(samples: number[], language: string = 'en', callback?: ((state: "generating" | "transmitting") => void)){
        let response = await this.fullRecognizeSong(samples, callback, language);
        if(!response) return null;

        return response

    }

    async recognizeSongMinimal(samples: number[], language: string = 'en', callback?: ((state: "generating" | "transmitting") => void)){
        let response = await this.fullRecognizeSong(samples, callback, language);
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

    async fullRecognizeSong(samples: number[], callback?: ((state: "generating" | "transmitting") => void), language: string = 'en'){
        callback?.("generating");
        let generator = this.createSignatureGenerator(samples);
        while(true){
            callback?.("generating");
            const signature = generator.getNextSignature();
            if(!signature){
                break;
            }
            callback?.("transmitting");
            let results = await this.endpoint.formatAndSendRecognizeRequest(signature, language);
            if(results !== null) return results;
        }
        return null;
    }

    createSignatureGenerator(samples: number[]){
        let signatureGenerator = new SignatureGenerator();
        signatureGenerator.feedInput(samples);
        return signatureGenerator;
    }

    async top_tracks_global(language: string = 'en-US',endpoint_country: string = 'GB',limit: string = '10',offset: string = '0'){

        const url = ShazamURLS.top_tracks_global(language,endpoint_country,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async top_tracks_country(language: string,endpoint_country: string,country_code: string,limit: string,offset: string){

        const url = ShazamURLS.top_tracks_country(language,endpoint_country,country_code,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async top_tracks_city(language: string,endpoint_country: string,city_id: string,limit: string,offset: string){

        const url = ShazamURLS.top_tracks_city(language,endpoint_country,city_id,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async track_info(language: string,endpoint_country: string,track_id: string){

        const url = ShazamURLS.track_info(language,endpoint_country,track_id)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async list_locations(){
        const url = ShazamURLS.locations()
        return await (await fetch(url, { headers: this.headers(), method: "GET" })).json();
    }

    async top_genre_tracks_world(language: string,endpoint_country: string,genre: string,limit: string,offset: string){

        const url = ShazamURLS.genre_world(language,endpoint_country,genre,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async top_genre_tracks_country(language: string, endpoint_country: string, country: string, genre: string, limit: string, offset: string){

        const url = ShazamURLS.genre_country(language,endpoint_country,country,genre,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async related_songs(language: string,endpoint_country: string,track_id: string,offset: string,limit: string){

        const url = ShazamURLS.related_songs(language,endpoint_country,track_id,offset,limit)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async search_artist(language: string,endpoint_country: string,query: string,limit: string,offset: string){

        const url = ShazamURLS.search_artist(language,endpoint_country,query,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

    async search_artist_v2(endpoint_country: string,artist_id: string){

        const url = ShazamURLS.search_artist_v2(endpoint_country,artist_id)
        return await (await fetch(url, { headers: this.headers(), method: "GET" })).json();
    }

    async artist_albums(endpoint_country: string,artist_id: string,limit: string,offset: string){

        const url = ShazamURLS.artist_albums(endpoint_country,artist_id,limit,offset)
        return await (await fetch(url, { headers: this.headers(), method: "GET" })).json();
    }

    async search_music(language: string,endpoint_country: string, query: string,limit: string,offset: string){

        const url = ShazamURLS.search_music(language,endpoint_country,query,limit,offset)
        return await (await fetch(url, { headers: this.headers(language), method: "GET" })).json();
    }

}