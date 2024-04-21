# Node-Shazam
 A library to interact with the Shazam API

This is based on [Node-Shazam-API](https://github.com/asivery/node-shazam-api) with most features added from [ShazamIO](https://github.com/shazamio/ShazamIO)

## Installation
```
npm install node-shazam
yarn add node-shazam
```

## Example usage

Recognise track from file
```js
import {Shazam} from 'node-shazam'
const shazam = new Shazam()

const recognise = await shazam.recognise('/path/to/file','en-US')
console.log(recognise)

//fromVideoFile and fromFilePath is deprecated and much slower
```

Top tracks globally
```js
await shazam.top_tracks_global('en-US','GB','10','0')
console.log(toptracks)
```

Top tracks globally for a genre
```js
await shazam.top_genre_tracks_world('en-US','GB','POP','10','0')
```

Top tracks by country
```js
await shazam.top_tracks_country('en-US','GB','GB','10','0')
```

Search track
```js
await shazam.search_music('en-US','GB','Beautiful things','1','0')
```

Related songs
```js
const trackid = '157666207'
await shazam.related_songs('en-US','GB',trackid,'10','0')
```

