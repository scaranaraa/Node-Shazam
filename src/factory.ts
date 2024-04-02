
export class FactorySchemas{
    
    static FACTORY_TRACK_SCHEMA = {
        name_mapping : {
            "photo_url": ["images", "coverarthq"],
            "ringtone": ["hub", "actions", 1, "uri"],
            "artist_id": ["artists", 0, "id"],
            "apple_music_url": ["hub", "options", 0, "actions", 0, "uri"],
            "spotify_url": ["hub", "providers", 0, "actions", 0, "uri"],
            "spotify_uri": ["hub", "providers", 0, "actions", 1, "uri"],
            "sections": "sections",
        },
        skip_internal: true,
    }

    static FACTORY_ARTIST_SCHEMA ={
        name_mapping: {
            "avatar": "avatar",
            "genres": ["genres", "secondaries"],
            "genres_primary": ["genres", "primary"],
            "adam_id": "adamid",
            "url": "weburl",
        }
    }

    static FACTORY_SONG_SECTION_SCHEMA = {

        name_mapping:{
            "type": "type",
            "meta_pages": "metapages",
            "tab_name": "tabname",
            "metadata": "metadata",
        },
        skip_internal: true

    }

    static FACTORY_VIDEO_SECTION_SCHEMA = {

        name_mapping:{
            "type": "type",
            "youtube_url": "youtubeurl",
            "tab_name": "tabname",
        },
        skip_internal: true,
    }

    static FACTORY_RELATED_SECTION_SCHEMA = {
        name_mapping:{
            "type": "type",
            "url": "url",
            "tab_name": "tabname",
        },
        skip_internal:true,
    }

    static FACTORY_YOUTUBE_TRACK_SCHEMA = {
        name_mapping:{
            "caption": "caption",
            "image": "image",
            "actions": "actions",
        },
        skip_internal:true,
    }

    static FACTORY_RESPONSE_TRACK_SCHEMA = {
        name_mapping:{
            "matches": "matches",
            "location": "location",
            "retry_ms": "retryms",
            "timestamp": "timestamp",
            "timezone": "timezone",
            "track": "track",
            "tag_id": "tagid",
        },
        skip_internal: true,
    }

    static FACTORY_LYRICS_SECTION ={ 
        name_mapping : {
            "type": "type",
            "text": "text",
            "footer": "footer",
            "tab_name": "tabname",
            "beacon_data": "beacondata",
        },
    }

    static FACTORY_BEACON_DATA_LYRICS_SECTION = {
        name_mapping: {
            "lyrics_id": "lyricsid",
            "provider_name": "providername",
            "common_track_id": "commontrackid",
        }
    }

    static FACTORY_ARTIST_SECTION = {
        name_mapping:{
            "type": "type",
            "id": "id",
            "name": "name",
            "verified": "verified",
            "actions": "actions",
            "tab_name": "tabname",
            "top_tracks": "toptracks",
        }
    }

    static FACTORY_MATCH = {
        name_mapping:{
            "id": "id",
            "offset": "offset",
            "channel": "channel",
            "time_skew": "timeskew",
            "frequency_skew": "frequencyskew",
        }
    }

    static FACTORY_ATTRIBUTES_ARTIST ={
        name_mapping: {
            "name": "name",
            "url": "url",
            "artist_bio": "artistBio",
            "genre_names": "genreNames",
        }
    }

    static FACTORY_ARTIST_V2 = {
        name_mapping:{
            "id": "id",
            "type": "type",
            "attributes": "attributes",
        }
    }

}