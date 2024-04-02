import { FactorySchemas } from "./factory";

export const FACTORY_TRACK = {
    schemas: {
        TrackInfo: FactorySchemas.FACTORY_TRACK_SCHEMA,
        SongSection: FactorySchemas.FACTORY_SONG_SECTION_SCHEMA,
        VideoSection: FactorySchemas.FACTORY_VIDEO_SECTION_SCHEMA,
        LyricsSection: FactorySchemas.FACTORY_LYRICS_SECTION,
        BeaconDataLyricsSection: FactorySchemas.FACTORY_BEACON_DATA_LYRICS_SECTION,
        ArtistSection: FactorySchemas.FACTORY_ARTIST_SECTION,
        MatchModel: FactorySchemas.FACTORY_MATCH,
        RelatedSection: FactorySchemas.FACTORY_RELATED_SECTION_SCHEMA,
        YoutubeData: FactorySchemas.FACTORY_YOUTUBE_TRACK_SCHEMA,
        ResponseTrack: FactorySchemas.FACTORY_RESPONSE_TRACK_SCHEMA,
    },
    debug_path: true,
}

export const FACTORY_ARTIST = {
    schemas: {
        ArtistAttribute: FactorySchemas.FACTORY_ATTRIBUTES_ARTIST,
        ArtistV3: FactorySchemas.FACTORY_ARTIST_V2,
        ArtistInfo: FactorySchemas.FACTORY_ARTIST_SCHEMA,
    },
    debug_path: true,
}