# Node-Shazam
 A library to interact with the Shazam API

This is based on [Node-Shazam-API](https://github.com/asivery/node-shazam-api) with most features added from [ShazamIO](https://github.com/shazamio/ShazamIO)

## Example usage

Recognise track from audio
```js
import {Shazam} from 'node-shazam'
const shazam = new Shazam()
//audio is trimmed to 10 seconds
const recognise = await shazam.fromFilePath('/path/to/file.mp3',false,'en')
console.log(recognise)
``` 

Recognise track from video
```js
const recognise = await shazam.fromVideoFile('/path/to/file.mp4',false,'en')
console.log(recognise)
```

Top tracks globally
```js
const toptracks = await shazam.top_tracks_global('en-US','GB','10','0')
console.log(toptracks)
```