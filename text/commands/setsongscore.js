module.exports = {
    name: 'setscore',
    secret: false,
    description: "Sets a song's score to an exact number",
    execute(message, args, bot)
    {
        if (args.length == 1 && !isNaN(args[0])) {
            //get current song uri
            //check if a song is playing
            bot.spotifyApi.getMyCurrentPlaybackState()
            .then(function (data)
            {
                //if a song is playing
                if (data.body && data.body.is_playing)
                {
                    //get current song
                    return bot.spotifyApi.getMyCurrentPlayingTrack();
                }
                else
                {
                    return new Promise((resolve, reject) => 
                    {
                        reject("No song playing");
                    })
                }
            })
            .then(function (data)
            {
                //if val is positive add it if it's not already in the master list
                var plus = false;
                if (args[0] >= 0) {
                    plus = true;
                }
                //current song data
                var name = data.body.item.name;
                var uri = data.body.item.uri;

                //check for the uri in the masterlist
                return bot.checkMasterForUri(name, uri, plus);
            })
            .then((uri) =>
            {
                songval = bot.urisToSongs([uri])[0].value;
                //increment score
                console.log('score increased by 1');
                bot.changeSongVal(uri, songval - args[0]);
                bot.saveTheme();
            })
            .catch((error) =>
            {
                if (error === "No song playing")
                {
                    //no song is playing right now
                    console.log("No song is currently playing.")
                }
            })
        }
    }
}