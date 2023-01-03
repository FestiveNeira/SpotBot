module.exports = {
    name: 'setplaylist',
    secret: false,
    description: "Changes the dynamic playlist settings",
    execute(message, args, bot)
    {
        if (args.length == 3) {
            var success = bot.setPlaylist(args[0].toLowerCase(), args[1].toLowerCase(), args[2].toLowerCase());
            if (success) {
                message.channel.send("Playlist set to " + args.join(' ') + ".");
            }
            else {
                message.channel.send("Playlist failed to update.");
            }
        }
    }
}