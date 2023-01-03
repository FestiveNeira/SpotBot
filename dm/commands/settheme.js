module.exports = {
    name: 'settheme',
    secret: false,
    description: "Changes the rating theme",
    execute(message, args, bot)
    {
        let themeName = args.join(' ').toLowerCase();
        bot.saveTheme();
        if (bot.themeExists(themeName)) {
            bot.loadTheme(themeName);
            message.channel.send("Theme successfully updated to '" + themeName + "'.");
        }
        else {
            message.channel.send("Theme failed to update, '" + themeName + "' not found.");
        }
    }
}