module.exports = {
    name: 'saveplaylist',
    secret: false,
    description: "saves the current playlist as a duplicate",
    execute(message, args, bot)
    {
        if (args.length == 2) {
            var name = args[0];
            var public;
            var go = false;
            if (args[1] == '1' || args[1] == 'true' || args[1] == 'public') {
                var public = true;
                go = true;
            }
            else if (args[1] == '0' || args[1] == 'false' || args[1] == 'private') {
                var public = true;
                go = true;
            }
            if (go) {
                bot.savePlaylist(name, public);
                message.channel.send("Playlist saved.");
            }
        }
    }
}