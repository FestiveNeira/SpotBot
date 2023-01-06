const Discord = require("discord.js");
const { Client, GatewayIntentBits, ThreadAutoArchiveDuration } = require('discord.js');
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
})

const { tokenDiscord, clientId, clientSecret } = require('./data/config.json');

var bot = {
    tokenDiscord: tokenDiscord,
    prefix: '-',
    client: client,
    spotLogChat: "946677297728069632"
}

client.once('ready', () => {
    bot.startup();
    console.log('SpotBot v0.1.0');
    client.channels.cache.get(bot.spotLogChat).send('hi');
});

client.once('message', (message) => {
    client.channels.cache.get(bot.spotLogChat).send('hi');
});

client.login(bot.tokenDiscord);