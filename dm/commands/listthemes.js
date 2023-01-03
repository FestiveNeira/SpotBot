module.exports = {
    name: 'listthemes',
    secret: false,
    description: "Lists all registered themes",
    execute(channel, bot)
    {
        var msg = "__Themes__\n";
        var themes = bot.themeslist;
        themes.forEach(theme => {
            msg += theme + "\n";
        });
        channel.send(msg);
    }
}