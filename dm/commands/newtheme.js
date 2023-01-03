module.exports = {
    name: 'createtheme',
    secret: false,
    description: "Creates a new theme",
    execute(message, args, bot)
    {
        let themeName = args.join(' ').toLowerCase();
        var success = bot.newTheme(themeName);
        if (success) {
            message.channel.send("'" + themeName + "' successfully created!");
        }
        else {
            message.channel.send("'" + themeName + "' already exists!");
        }
    }
}