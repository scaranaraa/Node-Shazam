import { SignatureGenerator } from './algorithm.js';
import { DecodedMessage } from './signatures.js';
import { recognizeBytes } from 'shazamio-core';
import { default as fetch } from 'node-fetch';
import { ShazamRoot } from './types/shazam.js';
import { s16LEToSamplesArray } from './utils.js';
import fs from 'fs';
import { Request, ShazamURLS } from './requests.js';
import { convertfile, tomp3 } from './to_pcm.js';
const TIME_ZONE = 'Europe/Paris';

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }).toUpperCase();
}


export class Endpoint {
    static SCHEME = 'https';
    static HOSTNAME = 'amp.shazam.com';

    constructor(public timezone: string) { }
    url(language: string = 'en') {
        return `${Endpoint.SCHEME}://${Endpoint.HOSTNAME}/discovery/v5/${language}/${language.toUpperCase()}/iphone/-/tag/${uuidv4()}/${uuidv4()}`;
    }
    params() {
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
    headers(language: string = 'en') {
        return Request.headers(language);
    }


    async sendRecognizeRequest(url: string, body: string, language: string = 'en'): Promise<ShazamRoot | null> {
        //@ts-ignore
        return await (await fetch(url, { body, headers: this.headers(language), method: 'POST' })).json();
    }

    async formatAndSendRecognizeRequest(signature: DecodedMessage, language: string = 'en'): Promise<ShazamRoot | null> {
        const data = {
            'timezone': this.timezone,
            'signature': {
                'uri': signature.encodeToUri(),
                'samplems': Math.round(signature.numberSamples / signature.sampleRateHz * 1000)
            },
            'timestamp': new Date().getTime(),
            'context': {},
            'geolocation': {}
        };
        const url = new URL(this.url(language));
        Object.entries(this.params()).forEach(([a, b]) => url.searchParams.append(a, b));

        const response = await this.sendRecognizeRequest(url.toString(), JSON.stringify(data), language);
        if (response?.matches.length === 0) return null;

        return response as ShazamRoot;
    }
}
/**
 * @class Shazam
 */
export class Shazam {
    static MAX_TIME_SCEONDS = 8;

    public endpoint: Endpoint;
    constructor(timeZone?: string) {
        this.endpoint = new Endpoint(timeZone ?? TIME_ZONE);
    }

    headers(language: string = 'en') {
        return Request.headers(language);
    }

    /** 
     * @deprecated
     * Recognise a song from an audio file 
     * @param {string} path the path to the file
     * @param {Boolean} minimal false for full track data, true for simplified form
     * @param {string} language Song language
     * @returns {ShazamRoot | null} 
     */

    async fromFilePath(path: string, minimal: boolean = false, language: string = 'en'): Promise<ShazamRoot | { title: string; artist: string; album: string | undefined; year: string | undefined; } | null> {
        await convertfile(path);
        const data = fs.readFileSync('node_shazam_temp.pcm');

        const conv = s16LEToSamplesArray(data);
        fs.unlinkSync('node_shazam_temp.pcm');
        const recognise = minimal ? await this.recognizeSongMinimal(conv, language) : await this.recognizeSong(conv, language);
        return recognise;

    }

    /** 
     * @deprecated
     * Recognise a song from a video file 
     * @param {string} path the path to the file
     * @param {Boolean} minimal false for full track data, true for simplified form
     * @param {string} language Song language
     * @returns {ShazamRoot | null} 
     */

    async fromVideoFile(path: string, minimal: boolean = false, language: string = 'en'): Promise<ShazamRoot | { title: string; artist: string; album: string | undefined; year: string | undefined; } | null> {

        await tomp3(path);
        const res = await this.fromFilePath('node_shazam_temp.mp3', minimal, language);
        fs.unlinkSync('node_shazam_temp.mp3');
        return res;
    }


    /** 
     * @deprecated
     * Recognise a song from Samples Array 
     * @param {number[]} samples Samples array
     * @param {string} language  Song language
     */
    async recognizeSong(samples: number[], language: string = 'en', callback?: ((state: 'generating' | 'transmitting') => void)): Promise<ShazamRoot | null> {
        const response = await this.fullRecognizeSong(samples, callback, language);
        if (!response) return null;

        return response;

    }

    /** 
     * @deprecated
     * Recognise a song from Samples Array and return minial info
     * @param {number[]} samples Samples array
     * @param {string} language  Song language
     */

    async recognizeSongMinimal(samples: number[], language: string = 'en', callback?: ((state: 'generating' | 'transmitting') => void)) {
        const response = await this.fullRecognizeSong(samples, callback, language);
        if (!response) return null;

        const
            trackData = response.track,
            mainSection = trackData.sections.find((e: any) => e.type === 'SONG')!;
        const
            title = trackData.title,
            artist = trackData.subtitle,
            album = mainSection.metadata!.find(e => e.title === 'Album')?.text,
            year = mainSection.metadata!.find(e => e.title === 'Released')?.text;
        return { title, artist, album, year };

    }

    async fullRecognizeSong(samples: number[], callback?: ((state: 'generating' | 'transmitting') => void), language: string = 'en') {
        callback?.('generating');
        const generator = this.createSignatureGenerator(samples);
        while (true) {
            callback?.('generating');
            const signature = generator.getNextSignature();
            if (!signature) {
                break;
            }
            callback?.('transmitting');
            const results = await this.endpoint.formatAndSendRecognizeRequest(signature, language);
            if (results !== null) return results;
        }
        return null;
    }

    /**
     * Recognise a song from a file or buffer
     * @param {string | Buffer} pathOrBuffer The path to the file or a Buffer containing the file contents
     * @param {string} language Song language (default: 'en')
     * @param {boolean} minimal Return minimal info (default: false)
     * @returns {ShazamRoot | null} 
     */
    async recognise(pathOrBuffer: string | Buffer, language: string = 'en', minimal = false) {

        let fileContent: Buffer;
        if (typeof pathOrBuffer === 'string') {
            // If pathOrBuffer is a string, assume it's a file path
            fileContent = fs.readFileSync(pathOrBuffer);
        } else {
            // Use the provided buffer
            fileContent = pathOrBuffer;
        }

        const signatures = recognizeBytes(fileContent, 0, Number.MAX_SAFE_INTEGER);
        let response;

        for (let i = Math.floor(signatures.length / 2); i < signatures.length; i += 4) {
            const data = {
                'timezone': this.endpoint.timezone,
                'signature': {
                    'uri': signatures[i].uri,
                    'samplems': signatures[i].samplems
                },
                'timestamp': new Date().getTime(),
                'context': {},
                'geolocation': {}
            };
            const url = new URL(this.endpoint.url(language));
            Object.entries(this.endpoint.params()).forEach(([a, b]) => url.searchParams.append(a, b));

            response = await this.endpoint.sendRecognizeRequest(url.toString(), JSON.stringify(data), language);
            if (response?.matches.length === 0) continue;
            break;
        }

        for (const sig of signatures) sig.free();

        if (!response) return null;
        if (response?.matches.length === 0) return null;
        if (minimal) {
            const
                trackData = response.track,
                mainSection = trackData.sections.find((e: any) => e.type === 'SONG')!;
            const
                title = trackData.title,
                artist = trackData.subtitle,
                album = mainSection.metadata!.find(e => e.title === 'Album')?.text,
                year = mainSection.metadata!.find(e => e.title === 'Released')?.text;
            return { title, artist, album, year };
        }

        return response;
    }

    createSignatureGenerator(samples: number[]) {
        const signatureGenerator = new SignatureGenerator();
        signatureGenerator.feedInput(samples);
        return signatureGenerator;
    }

    /** 
     * Most shazamed tracks globally 
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */

    async top_tracks_global(language: string = 'en-US', endpoint_country: string = 'GB', limit: string = '10', offset: string = '0') {

        const url = ShazamURLS.top_tracks_global(language, endpoint_country, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Most shazamed tracks for a country 
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} country_code ISO country code for the country
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */

    async top_tracks_country(language: string, endpoint_country: string, country_code: string, limit: string, offset: string) {

        const url = ShazamURLS.top_tracks_country(language, endpoint_country, country_code, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Most shazamed tracks for a city 
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} city_id Shazam city id
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async top_tracks_city(language: string, endpoint_country: string, city_id: string, limit: string, offset: string) {

        const url = ShazamURLS.top_tracks_city(language, endpoint_country, city_id, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Info about a track
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} track_id Shazam track id
     */
    async track_info(language: string, endpoint_country: string, track_id: string) {

        const url = ShazamURLS.track_info(language, endpoint_country, track_id);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * List locations
     */
    async list_locations() {
        const url = ShazamURLS.locations();
        return await (await fetch(url, { headers: this.headers(), method: 'GET' })).json();
    }

    /** 
     * Most shazamed tracks globally for a genre 
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} genre Genre to search
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async top_genre_tracks_world(language: string, endpoint_country: string, genre: string, limit: string, offset: string) {

        const url = ShazamURLS.genre_world(language, endpoint_country, genre, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Most shazamed tracks for a country 
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} country ISO country code for the country
     * @param {string} genre Genre to search 
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async top_genre_tracks_country(language: string, endpoint_country: string, country: string, genre: string, limit: string, offset: string) {

        const url = ShazamURLS.genre_country(language, endpoint_country, country, genre, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Related songs for a track
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} track_id Shazam track id
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async related_songs(language: string, endpoint_country: string, track_id: string, offset: string, limit: string) {

        const url = ShazamURLS.related_songs(language, endpoint_country, track_id, offset, limit);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Search artist by name
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} query Artist name
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async search_artist(language: string, endpoint_country: string, query: string, limit: string, offset: string) {

        const url = ShazamURLS.search_artist(language, endpoint_country, query, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Search artist by id
     * @param {string} endpoint_country Endpoint country  
     * @param {string} artist_id Artist ID
     */
    async search_artist_v2(endpoint_country: string, artist_id: string) {

        const url = ShazamURLS.search_artist_v2(endpoint_country, artist_id);
        return await (await fetch(url, { headers: this.headers(), method: 'GET' })).json();
    }

    /** 
     * Albums by an artist 
     * @param {string} endpoint_country Endpoint country  
     * @param {string} artist_id Shazam artist id
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async artist_albums(endpoint_country: string, artist_id: string, limit: string, offset: string) {

        const url = ShazamURLS.artist_albums(endpoint_country, artist_id, limit, offset);
        return await (await fetch(url, { headers: this.headers(), method: 'GET' })).json();
    }

    /** 
     * Search music on shazam
     * @param {string} language  Song language
     * @param {string} endpoint_country Endpoint country  
     * @param {string} query Query to search
     * @param {string} limit limit to how many tracks are fetched
     * @param {string} offset the offset to start fetching from
     */
    async search_music(language: string, endpoint_country: string, query: string, limit: string, offset: string) {

        const url = ShazamURLS.search_music(language, endpoint_country, query, limit, offset);
        return await (await fetch(url, { headers: this.headers(language), method: 'GET' })).json();
    }

    /** 
     * Get number of times a track was shazamed
     * @param {string} track Track ID
     */

    async listen_count(track: string) {

        const url = ShazamURLS.listening_counter(track);
        return await (await fetch(url, { headers: this.headers(), method: 'GET' })).json();
    }

}