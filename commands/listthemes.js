module.exports = {
    name: 'listthemes',
    secret: false,
    description: "Lists all registered themes",
    execute(message, args, bot) {
        var msg = "__Themes__\n";
        var themes = bot.themeslist;
        themes.forEach(theme => {
            msg += theme + "\n";
        });
        bot.client.channels.cache.get(bot.spotLogChat).send(msg);
    }
}