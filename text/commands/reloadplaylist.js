module.exports = {
    name: 'reload',
    secret: false,
    description: "Roloads the dynamic playlist",
    execute(message, args, bot)
    {
        bot.reloadPlaylist();
        message.channel.send("Playlist reloaded for most recent ratings.");
    }
}