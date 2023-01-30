module.exports = {
    name: 'setplaylist',
    secret: false,
    description: "Changes the dynamic playlist settings",
    execute(message, args, bot) {
        if (args.length >= 3) {
            temp = args.splice(0, args.length - 2).join(" ");
            var success = bot.setPlaylist(temp.toLowerCase(), args[0].toLowerCase(), args[1].toLowerCase());
            if (success) {
                message.channel.send("Playlist set to " + temp + " " + args.join(' ') + ".");
            }
            else {
                message.channel.send("Playlist failed to update, check that your input values ar valid\ncheck the spelling of your theme argument\nvalid types are top, bottom, and rank\nranks only fall between -25 and 25\nthe number of songs cannot exceed the number of songs in the master playlist");
            }
        }
    }
}