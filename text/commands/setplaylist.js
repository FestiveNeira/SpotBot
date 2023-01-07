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
                message.channel.send("Playlist failed to update, check that your input values ar valid\ncheck the spelling of your theme argument\nvalid types are top, bottom, and rank\nranks only fall between -25 and 25\nthe number of songs cannot exceed the number of songs in the master playlist");
            }
        }
    }
}