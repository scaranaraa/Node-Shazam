import {Shazam} from "./dist/esm/index.js"
const sh = new Shazam()
let t = await sh.recognise("./rick.mp3")
console.log(t)