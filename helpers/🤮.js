module.exports = {
    name: '🤮',
    secret: false,
    description: "increments the current song's score by 1",
    execute(params, bot) {
        //get current song uri
        //check if a song is playing
        bot.spotifyApi.getMyCurrentPlaybackState()
            .then(function (data) {
                //if a song is playing
                if (data.body && data.body.is_playing) {
                    //get current song
                    return bot.spotifyApi.getMyCurrentPlayingTrack();
                }
                else {
                    return new Promise((resolve, reject) => {
                        reject("No song playing");
                    })
                }
            })
            .then(function (data) {
                //current song data
                var name = data.body.item.name;
                var uri = data.body.item.uri;

                //check for the uri in the masterlist
                return bot.checkMasterForUri(name, uri, false);
            })
            .then((uri) => {
                //increment score
                console.log('score decreased by 3');
                bot.changeSongVal(uri, -3);
                bot.saveTheme();
            })
            .catch((error) => {
                if (error === "No song playing") {
                    //no song is playing right now
                    console.log("No song is currently playing.")
                }
            })
    }
}