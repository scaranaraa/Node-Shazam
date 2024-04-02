import pkg from '@ffmpeg-installer/ffmpeg';
const { path } = pkg;
import Ffmpeg from "fluent-ffmpeg"
Ffmpeg.setFfmpegPath(path);

export async function convertfile(path: string) {
    return new Promise((resolve, reject) => {
    Ffmpeg(path)
    .outputFormat('s16le')
    .audioFrequency(16000)
    .outputOptions('-acodec pcm_s16le')
    .audioChannels(1)
    .output('output.pcm')
    .on("end", () => {
        try { 
            resolve(undefined);
        } catch (error) {
            reject(error);
        }
    })
    .on("error", reject)
    .run()
    });
}