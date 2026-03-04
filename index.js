const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    AuditLogEvent
} = require('discord.js');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');
const { joinVoiceChannel } = require('@discordjs/voice');
const { GameDig } = require('gamedig');
require('dotenv').config();

// CONFIGURATION
const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    serverIp: process.env.SERVER_IP || '127.0.0.1', // REPLACE WITH YOUR SERVER IP OR USE .ENV
    serverPort: parseInt(process.env.SERVER_PORT) || 27015 // REPLACE WITH YOUR PORT OR USE .ENV
};

const dbPath = './db.json';
let cache = {};

function loadDb() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        cache = {};
    } else {
        try {
            cache = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (e) {
            cache = {};
        }
    }
}

function saveDb() {
    fs.writeFileSync(dbPath, JSON.stringify(cache, null, 2));
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function addStaffScore(guildId, userId) {
    const gConfig = getGuildConfig(guildId);
    if (!gConfig.staffStats) gConfig.staffStats = { daily: { date: '', scores: {} }, weekly: { date: '', scores: {} }, allTime: {} };
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentWeekStr = `${now.getFullYear()}-W${getWeekNumber(now)}`;

    if (gConfig.staffStats.daily.date !== todayStr) {
        gConfig.staffStats.daily = { date: todayStr, scores: {} };
    }
    if (gConfig.staffStats.weekly.date !== currentWeekStr) {
        gConfig.staffStats.weekly = { date: currentWeekStr, scores: {} };
    }

    gConfig.staffStats.daily.scores[userId] = (gConfig.staffStats.daily.scores[userId] || 0) + 1;
    gConfig.staffStats.weekly.scores[userId] = (gConfig.staffStats.weekly.scores[userId] || 0) + 1;
    gConfig.staffStats.allTime[userId] = (gConfig.staffStats.allTime[userId] || 0) + 1;
    saveGuildConfig(guildId, { staffStats: gConfig.staffStats });
}

function getGuildConfig(guildId) {
    if (!cache[guildId]) cache[guildId] = { ticketCount: 0, tickets: {}, openTicketsByUser: {}, staffStats: { daily: { date: '', scores: {} }, weekly: { date: '', scores: {} }, allTime: {} } };
    if (!cache[guildId].tickets) cache[guildId].tickets = {};
    if (!cache[guildId].openTicketsByUser) cache[guildId].openTicketsByUser = {};
    if (!cache[guildId].staffStats) cache[guildId].staffStats = { daily: { date: '', scores: {} }, weekly: { date: '', scores: {} }, allTime: {} };
    return cache[guildId];
}

function saveGuildConfig(guildId, configData) {
    cache[guildId] = { ...cache[guildId], ...configData };
}

setInterval(() => {
    saveDb();
}, 3 * 60 * 1000);

loadDb();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up the ticket channel, log channel, and staff role.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the open ticket button will be sent')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Staff role that can view tickets')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('log_channel')
                .setDescription('Channel where closed ticket transcripts will be sent')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Select the category under which new tickets will be created')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildCategory)
        ),

    new SlashCommandBuilder()
        .setName('log_setup')
        .setDescription('Sets up the channels for Ban and Kick logs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('ban_channel')
                .setDescription('Channel where ban records will be sent')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('kick_channel')
                .setDescription('Channel where kick records will be sent')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),

    new SlashCommandBuilder()
        .setName('general_log_setup')
        .setDescription('Sets up the channels for Join/Leave, Message, and Voice logs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('join_leave')
                .setDescription('Channel to log members joining/leaving the server')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('message_log')
                .setDescription('Channel to log deleted messages')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('voice_log')
                .setDescription('Channel to log voice channel join/leave activities')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),

    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Adds another user to the current ticket channel.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Removes a user from the current ticket channel.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remove')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('close')
        .setDescription('Closes the active ticket channel.'),

    new SlashCommandBuilder()
        .setName('active')
        .setDescription('Announces that the server is online and provides connection info.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('Announces that the server is under maintenance.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Makes the bot join a specific voice channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel for the bot to join')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        ),

    new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfers the ticket to another staff member.')
        .addUserOption(option =>
            option.setName('staff')
                .setDescription('Staff member to transfer the ticket to')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('toplist')
        .setDescription('Shows the ranking of staff who solved the most tickets.')
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Which timeframe ranking do you want to see?')
                .setRequired(true)
                .addChoices(
                    { name: 'Daily', value: 'daily' },
                    { name: 'Weekly', value: 'weekly' },
                    { name: 'All Time', value: 'allTime' }
                )
        ),

    new SlashCommandBuilder()
        .setName('counter')
        .setDescription('Sets the starting number for new tickets.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('Starting number for new tickets')
                .setRequired(true)
        )
];

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    if (config.token && config.clientId) {
        const rest = new REST({ version: '10' }).setToken(config.token);
        try {
            console.log('Loading slash commands...');
            await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
            console.log('Slash commands loaded successfully.');
        } catch (error) {
            console.error('Error loading commands:', error);
        }
    } else {
        console.log("WARNING: token or clientId not found! Commands could not be sent to Discord.");
    }

    let statusIndex = 0;
    let cachedPlayerCount = 'Unknown';
    let isServerOnline = false;

    async function fetchServerData() {
        try {
            const state = await GameDig.query({
                type: 'garrysmod', // Update if not a Garry's Mod server
                host: config.serverIp,
                port: config.serverPort,
                maxAttempts: 1,
                socketTimeout: 5000
            });
            cachedPlayerCount = `${state.players.length}/${state.maxplayers}`;
            isServerOnline = true;
        } catch (error) {
            isServerOnline = false;
        }
    }

    function updateDiscordPresence() {
        // REPLACE THE TEXT BELOW WITH YOUR OWN SERVER DETAILS
        const statuses = isServerOnline ? [
            { name: `${cachedPlayerCount} Online`, type: 0 },
            { name: 'Your Server Name', type: 0 },
            { name: 'THE BEST SERVER', type: 0 }
        ] : [
            { name: 'Waiting for Server Connection...', type: 0 },
            { name: 'Your Server Name', type: 0 },
            { name: 'THE BEST SERVER', type: 0 }
        ];

        client.user.setActivity(statuses[statusIndex].name, { type: statuses[statusIndex].type });
        statusIndex = (statusIndex + 1) % statuses.length;
    }

    fetchServerData().then(() => {
        updateDiscordPresence();
        setInterval(fetchServerData, 60000);
        setInterval(updateDiscordPresence, 10000);
    });
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'toplist') {
            const period = interaction.options.getString('period');
            const gConfig = getGuildConfig(interaction.guildId);
            const stats = gConfig.staffStats || { daily: { scores: {} }, weekly: { scores: {} }, allTime: {} };

            let scoresObj = {};
            let titleStr = '';

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const currentWeekStr = `${now.getFullYear()}-W${getWeekNumber(now)}`;

            if (period === 'daily') {
                if (stats.daily && stats.daily.date === todayStr) scoresObj = stats.daily.scores || {};
                titleStr = 'Daily Top Staff (Today)';
            } else if (period === 'weekly') {
                if (stats.weekly && stats.weekly.date === currentWeekStr) scoresObj = stats.weekly.scores || {};
                titleStr = 'Weekly Top Staff (This Week)';
            } else {
                scoresObj = stats.allTime || {};
                titleStr = 'All-Time Top Staff';
            }

            const sortedRank = Object.entries(scoresObj).sort((a, b) => b[1] - a[1]).slice(0, 10);

            if (sortedRank.length === 0) {
                return interaction.reply({ content: `No tickets closed for this period yet.`, ephemeral: true });
            }

            let desc = '';
            for (let i = 0; i < sortedRank.length; i++) {
                const [userId, score] = sortedRank[i];
                let rankEmoji = '🏅';
                if (i === 0) rankEmoji = '🥇';
                else if (i === 1) rankEmoji = '🥈';
                else if (i === 2) rankEmoji = '🥉';

                desc += `${rankEmoji} **${i + 1}.** <@${userId}>: **${score} Tickets**\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle(titleStr)
                .setDescription(desc)
                .setColor('Gold')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const role = interaction.options.getRole('role');
            const logChannel = interaction.options.getChannel('log_channel');
            const categoryChannel = interaction.options.getChannel('category');

            saveGuildConfig(interaction.guildId, {
                panelChannel: channel.id,
                ticketRole: role.id,
                logChannel: logChannel.id,
                ticketCategory: categoryChannel ? categoryChannel.id : null
            });

            const embed = new EmbedBuilder()
                .setTitle('Support System')
                .setDescription('Click the button below to create a support ticket.')
                .setColor('Blue');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('📩 Create Ticket')
                        .setStyle(ButtonStyle.Primary),
                );

            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: `Setup successful! Panel sent to ${channel}. Staff role set to ${role}, and log channel to ${logChannel}.`, ephemeral: true });
        }

        if (commandName === 'log_setup') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You must have Administrator permissions to use this command.', ephemeral: true });
            }

            const banChannel = interaction.options.getChannel('ban_channel');
            const kickChannel = interaction.options.getChannel('kick_channel');

            saveGuildConfig(interaction.guildId, {
                banLogChannel: banChannel.id,
                kickLogChannel: kickChannel.id
            });

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Security Logs Configured')
                .setDescription(`Banned members will be logged in ${banChannel}, and kicked members in ${kickChannel}.`)
                .setColor('Green');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'general_log_setup') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You must have Administrator permissions to use this command.', ephemeral: true });
            }

            const girisCikisChannel = interaction.options.getChannel('join_leave');
            const mesajLogChannel = interaction.options.getChannel('message_log');
            const sesLogChannel = interaction.options.getChannel('voice_log');

            saveGuildConfig(interaction.guildId, {
                joinLeaveLogChannel: girisCikisChannel.id,
                messageLogChannel: mesajLogChannel.id,
                voiceLogChannel: sesLogChannel.id
            });

            const embed = new EmbedBuilder()
                .setTitle('📋 General Server Logs Configured')
                .setDescription(`Join/Leave logs in ${girisCikisChannel}.\nMessage Deletion logs in ${mesajLogChannel}.\nVoice Join/Leave logs in ${sesLogChannel}.`)
                .setColor('Green');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'counter') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You must have Administrator permissions to use this command.', ephemeral: true });
            }

            const newCount = interaction.options.getInteger('number');
            const finalCount = newCount > 0 ? newCount - 1 : 0;
            saveGuildConfig(interaction.guildId, { ticketCount: finalCount });

            return interaction.reply({ content: `✅ Ticket counter successfully set! The next ticket will be named **ticket-${newCount.toString().padStart(4, '0')}**.`, ephemeral: true });
        }

        if (commandName === 'active') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You must have Administrator permissions to use this command.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🟢 Server Online')
                .setDescription(`Our server is currently online, you can join now!\n\n**To connect:** \`connect ${config.serverIp}:${config.serverPort}\``)
                .setColor('Green')
                .setTimestamp();

            return interaction.reply({ content: '@everyone', embeds: [embed] });
        }

        if (commandName === 'maintenance') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You must have Administrator permissions to use this command.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔴 Server Under Maintenance')
                .setDescription('Our server is currently under maintenance for a better gaming experience. Please wait for the online announcement.')
                .setColor('Red')
                .setTimestamp();

            return interaction.reply({ content: '@everyone', embeds: [embed] });
        }

        if (commandName === 'voice') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You must have Administrator permissions to use this command.', ephemeral: true });
            }

            const kanal = interaction.options.getChannel('channel');

            try {
                joinVoiceChannel({
                    channelId: kanal.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                return interaction.reply({ content: `✅ Bot successfully joined the ${kanal} channel and is waiting.`, ephemeral: true });
            } catch (error) {
                console.error("Failed to join voice channel:", error);
                return interaction.reply({ content: `❌ An error occurred while joining the voice channel.`, ephemeral: true });
            }
        }

        if (commandName === 'add' || commandName === 'remove' || commandName === 'close' || commandName === 'transfer') {
            const gConfig = getGuildConfig(interaction.guildId);
            const isTicketChannel = interaction.channel.name.startsWith('ticket-');

            if (!isTicketChannel) {
                return interaction.reply({ content: 'You can only use this command in ticket channels.', ephemeral: true });
            }

            const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (commandName === 'transfer') {
                const isHandler = gConfig.tickets && gConfig.tickets[interaction.channel.id] && gConfig.tickets[interaction.channel.id].handler === interaction.user.id;

                if (!isHandler && !isAdmin) {
                    return interaction.reply({ content: 'You must be the original handler or an administrator to transfer this ticket.', ephemeral: true });
                }

                const newUser = interaction.options.getUser('staff');
                const targetMember = await interaction.guild.members.fetch(newUser.id).catch(() => null);

                if (!targetMember) {
                    return interaction.reply({ content: 'Specified user not found in the server!', ephemeral: true });
                }

                const targetHasManagerRole = targetMember.roles.cache.has(gConfig.ticketRole) || targetMember.permissions.has(PermissionFlagsBits.Administrator);
                if (!targetHasManagerRole) {
                    return interaction.reply({ content: 'You can only transfer the ticket to another staff member!', ephemeral: true });
                }

                if (!gConfig.tickets[interaction.channel.id]) gConfig.tickets[interaction.channel.id] = { owner: null, handler: null };

                const oldOwnerId = gConfig.tickets[interaction.channel.id].handler;
                if (oldOwnerId) {
                    await interaction.channel.permissionOverwrites.delete(oldOwnerId).catch(() => { });
                }

                await interaction.channel.permissionOverwrites.edit(newUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                gConfig.tickets[interaction.channel.id].handler = newUser.id;
                saveGuildConfig(interaction.guildId, { tickets: gConfig.tickets });

                return interaction.reply({ content: `Ticket successfully transferred to ${newUser}. They will handle it from now on.` });
            }

            if (commandName === 'add') {
                if (!hasManagerRole && !isAdmin) return interaction.reply({ content: 'You do not have permission to do this.', ephemeral: true });

                const user = interaction.options.getUser('user');
                await interaction.channel.permissionOverwrites.edit(user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                return interaction.reply({ content: `${user} was added to this ticket.` });
            }

            if (commandName === 'remove') {
                if (!hasManagerRole && !isAdmin) return interaction.reply({ content: 'You do not have permission to do this.', ephemeral: true });

                const user = interaction.options.getUser('user');
                await interaction.channel.permissionOverwrites.delete(user.id);
                return interaction.reply({ content: `${user} was removed from the ticket.` });
            }

            if (commandName === 'close') {
                await interaction.deferReply();
                const ticketData = gConfig.tickets ? gConfig.tickets[interaction.channel.id] : null;

                const isOwner = ticketData && ticketData.owner === interaction.user.id;
                const isHandler = ticketData && ticketData.handler === interaction.user.id;

                if (!isOwner && !isHandler && !isAdmin) {
                    return interaction.editReply({ content: 'Only the ticket creator, assigned staff, or server administrators can close this ticket.' });
                }

                await interaction.editReply({ content: 'Closing ticket...' });

                const channelId = interaction.channel.id;
                if (gConfig.tickets && gConfig.tickets[channelId]) {
                    const ownerId = gConfig.tickets[channelId].owner;
                    if (ownerId && gConfig.openTicketsByUser && gConfig.openTicketsByUser[ownerId]) {
                        delete gConfig.openTicketsByUser[ownerId];
                    }
                    delete gConfig.tickets[channelId];
                    saveGuildConfig(interaction.guildId, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });
                }

                await interaction.channel.delete().catch(err => console.error("Could not delete channel", err));
            }
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);

            if (!gConfig.ticketRole) {
                return interaction.editReply({ content: 'Ticket setup has not been configured on this server. Please contact an administrator.' });
            }

            if (gConfig.openTicketsByUser && gConfig.openTicketsByUser[interaction.user.id]) {
                const existingTicketId = gConfig.openTicketsByUser[interaction.user.id];
                const existingChannel = guild.channels.cache.get(existingTicketId);

                if (existingChannel) {
                    return interaction.editReply({ content: `You already have an open ticket: ${existingChannel}. Please close the current one before opening a new one.` });
                } else {
                    delete gConfig.openTicketsByUser[interaction.user.id];
                    saveGuildConfig(guild.id, { openTicketsByUser: gConfig.openTicketsByUser });
                }
            }

            const ticketRole = guild.roles.cache.get(gConfig.ticketRole);
            gConfig.ticketCount = (gConfig.ticketCount || 0) + 1;
            saveGuildConfig(guild.id, { ticketCount: gConfig.ticketCount });

            const channelName = `ticket-${gConfig.ticketCount.toString().padStart(4, '0')}`;

            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                }
            ];

            if (ticketRole) {
                permissionOverwrites.push({
                    id: ticketRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    deny: [PermissionFlagsBits.SendMessages],
                });
            }

            try {
                const channelOptions = {
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: permissionOverwrites
                };

                if (gConfig.ticketCategory) {
                    channelOptions.parent = gConfig.ticketCategory;
                }

                const ticketChannel = await guild.channels.create(channelOptions);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('Support Ticket')
                    .setDescription(`Hello ${interaction.user}, your ticket has been successfully created. Staff will attend to you shortly. \n\nYou can describe your issue in detail. To close the ticket, use the button below or the \`/close\` command.`)
                    .setColor('Green');

                const closeBtnRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('take_ticket')
                            .setLabel('✋ Claim Ticket')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('manage_ticket')
                            .setLabel('⚙️ Control Panel')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('🔒 Close Ticket')
                            .setStyle(ButtonStyle.Danger)
                    );

                await ticketChannel.send({
                    content: `${interaction.user} ${ticketRole ? `<@&${ticketRole.id}>` : ''}`,
                    embeds: [welcomeEmbed],
                    components: [closeBtnRow]
                });

                await interaction.editReply({ content: `Your ticket has been successfully created: ${ticketChannel}` });

                if (!gConfig.openTicketsByUser) gConfig.openTicketsByUser = {};
                gConfig.openTicketsByUser[interaction.user.id] = ticketChannel.id;

                gConfig.tickets[ticketChannel.id] = { owner: interaction.user.id, handler: null };
                saveGuildConfig(guild.id, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });

            } catch (error) {
                console.error('Channel could not be created:', error);
                await interaction.editReply({ content: 'An error occurred while creating the ticket. Please check the bot\'s channel creation/management permissions.' });
            }
        }

        if (interaction.customId === 'take_ticket') {
            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);

            const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'You do not have permission to claim this ticket.', ephemeral: true });
            }

            if (!gConfig.tickets) gConfig.tickets = {};

            if (gConfig.tickets[interaction.channel.id] && gConfig.tickets[interaction.channel.id].handler) {
                return interaction.reply({ content: `This ticket has already been claimed by <@${gConfig.tickets[interaction.channel.id].handler}>.`, ephemeral: true });
            }

            if (!gConfig.tickets[interaction.channel.id]) gConfig.tickets[interaction.channel.id] = { owner: null };
            gConfig.tickets[interaction.channel.id].handler = interaction.user.id;
            saveGuildConfig(guild.id, { tickets: gConfig.tickets });

            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            const newRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('take_ticket')
                        .setLabel('✅ Ticket Claimed')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('manage_ticket')
                        .setLabel('⚙️ Control Panel')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.message.edit({ components: [newRow] });
            await interaction.reply({ content: `${interaction.user} claimed this ticket and is looking into it.` });
        }

        if (interaction.customId === 'manage_ticket') {
            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);

            const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasManagerRole) {
                return interaction.reply({ content: 'Only staff members can use the control panel.', ephemeral: true });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId('ticket_manage_select')
                        .setPlaceholder('Select a user to perform an action on the ticket')
                );

            const btnRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('action_add')
                        .setLabel('➕ Add User')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('action_remove')
                        .setLabel('➖ Remove User')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('action_transfer')
                        .setLabel('🔄 Transfer to Someone Else')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({
                content: 'Please select the user you want to perform an action on and then click the desired action:',
                components: [row, btnRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.deferReply();

            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);
            const channelId = interaction.channelId || (interaction.channel ? interaction.channel.id : null);
            if (!channelId) return;

            const ticketData = gConfig.tickets ? gConfig.tickets[channelId] : null;

            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            const isOwner = ticketData && ticketData.owner === interaction.user.id;
            const isHandler = ticketData && ticketData.handler === interaction.user.id;

            if (!isOwner && !isHandler && !isAdmin) {
                return interaction.editReply({ content: 'Only the ticket creator, assigned staff, or server administrators can close this ticket.' });
            }

            await interaction.editReply({ content: 'Ticket is being closed, preparing Transcript. Please wait...' });

            let solverId = null;
            if (ticketData && ticketData.handler) {
                solverId = ticketData.handler;
            } else {
                const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
                if (hasManagerRole) solverId = interaction.user.id;
            }

            if (solverId) {
                addStaffScore(guild.id, solverId);
            }

            try {
                const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                    limit: -1,
                    returnType: 'attachment',
                    filename: `transcript-${interaction.channel.name}.html`,
                    saveImages: true,
                    poweredBy: false,
                    description: `Support Ticket Transcript`
                });

                let attachmentUrl = null;
                let logMessage = null;

                if (gConfig.logChannel) {
                    const logChannel = guild.channels.cache.get(gConfig.logChannel);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📄 Ticket Closed and Archived')
                            .setColor('Red')
                            .addFields(
                                { name: 'Channel Name', value: `\`${interaction.channel.name}\``, inline: true },
                                { name: 'Opened By', value: ticketData && ticketData.owner ? `<@${ticketData.owner}>` : 'Unknown', inline: true },
                                { name: 'Assigned Staff', value: ticketData && ticketData.handler ? `<@${ticketData.handler}>` : ticketData && ticketData.owner === null ? 'None' : `<@${interaction.user.id}> (Closed by)`, inline: true }
                            )
                            .setTimestamp();

                        try {
                            logMessage = await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                            if (logMessage.attachments.size > 0) {
                                attachmentUrl = logMessage.attachments.first().url;
                            }
                        } catch (e) {
                            console.error("Could not send to log channel:", e);
                        }
                    }
                }

                if (attachmentUrl) {
                    const downloadRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel('📥 Download Transcript')
                                .setStyle(ButtonStyle.Link)
                                .setURL(attachmentUrl)
                        );

                    if (logMessage) await logMessage.edit({ components: [downloadRow] });

                    if (ticketData && ticketData.owner) {
                        const ownerUser = await client.users.fetch(ticketData.owner).catch(() => null);
                        if (ownerUser) {
                            const dmEmbed = new EmbedBuilder()
                                .setTitle('📄 Your Ticket Was Closed')
                                .setColor('Blue')
                                .setDescription(`Hello, the ticket named **${interaction.channel.name}** you opened on our server has been closed.\n\nYou can download your conversation history directly to your browser by clicking the button below.`);

                            await ownerUser.send({ embeds: [dmEmbed], components: [downloadRow] })
                                .catch(() => console.log('Could not DM user, DMs are disabled.'));
                        }
                    }
                }
            } catch (err) {
                console.error("Error generating transcript:", err);
            }

            if (ticketData && ticketData.owner) {
                delete gConfig.openTicketsByUser[ticketData.owner];
            }
            if (gConfig.tickets && gConfig.tickets[channelId]) {
                delete gConfig.tickets[channelId];
            }
            saveGuildConfig(guild.id, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });

            if (interaction.channel) {
                await interaction.channel.delete().catch(() => { });
            }
        }

        if (interaction.customId.startsWith('action_')) {
            const message = interaction.message;
            const selectMenuRow = message.components.find(r => r.components[0].customId === 'ticket_manage_select');

            if (!selectMenuRow) {
                return interaction.reply({ content: 'An error occurred, selection menu not found.', ephemeral: true });
            }

            return interaction.reply({ content: 'Please make a user selection from the menu above first!', ephemeral: true });
        }
    }

    if (interaction.isUserSelectMenu()) {
        if (interaction.customId === 'ticket_manage_select') {
            const selectedUserId = interaction.values[0];
            const targetUser = await interaction.client.users.fetch(selectedUserId);

            const btnRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`do_add_${selectedUserId}`)
                        .setLabel(`➕ Add ${targetUser.username}`)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`do_remove_${selectedUserId}`)
                        .setLabel(`➖ Remove ${targetUser.username}`)
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`do_transfer_${selectedUserId}`)
                        .setLabel(`🔄 Transfer to ${targetUser.username}`)
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.update({
                content: `Selected user: **${targetUser.username}**. Please select what you want to do:`,
                components: [interaction.message.components[0], btnRow],
            }).catch(console.error);
        }
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('do_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const targetId = parts[2];

        try {
            const guild = interaction.guild;
            const targetUser = await client.users.fetch(targetId);
            const gConfig = getGuildConfig(guild.id);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (action === 'add') {
                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                await interaction.channel.send({ content: `${targetUser} was added to the ticket by staff.` });
                await interaction.reply({ content: 'Action successful. User added.', ephemeral: true });
            }
            else if (action === 'remove') {
                await interaction.channel.permissionOverwrites.delete(targetUser.id).catch(() => { });
                await interaction.channel.send({ content: `${targetUser} was removed from the ticket channel.` });
                await interaction.reply({ content: 'Action successful. User removed.', ephemeral: true });
            }
            else if (action === 'transfer') {
                const isHandler = gConfig.tickets && gConfig.tickets[interaction.channel.id] && gConfig.tickets[interaction.channel.id].handler === interaction.user.id;

                if (!isHandler && !isAdmin) {
                    return interaction.reply({ content: 'You must be the original handler or an administrator to transfer this ticket.', ephemeral: true });
                }

                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!targetMember) {
                    return interaction.reply({ content: 'Specified user not found in the server!', ephemeral: true });
                }

                const targetHasManagerRole = targetMember.roles.cache.has(gConfig.ticketRole) || targetMember.permissions.has(PermissionFlagsBits.Administrator);
                if (!targetHasManagerRole) {
                    return interaction.reply({ content: 'You can only transfer the ticket to another staff member!', ephemeral: true });
                }

                const oldOwnerId = gConfig.tickets[interaction.channel.id].handler;
                if (oldOwnerId) {
                    await interaction.channel.permissionOverwrites.delete(oldOwnerId).catch(() => { });
                }

                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                gConfig.tickets[interaction.channel.id].handler = targetUser.id;
                saveGuildConfig(interaction.guildId, { tickets: gConfig.tickets });

                await interaction.channel.send({ content: `Ticket successfully transferred to ${targetUser}. They will handle it from now on.` });
                await interaction.reply({ content: 'Ticket successfully transferred.', ephemeral: true });
            }
        } catch (error) {
            console.error('Control panel action error:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred during the process.', ephemeral: true });
            }
        }
    }
});

if (config.token) {
    client.login(config.token);

    client.on('guildBanAdd', async ban => {
        try {
            const guild = ban.guild;
            const user = ban.user;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.banLogChannel) return;

            const logChannel = guild.channels.cache.get(gConfig.banLogChannel);
            if (!logChannel) return;

            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            });
            const banLog = fetchedLogs.entries.first();

            let executor = 'Unknown';
            let reason = ban.reason || 'No reason provided.';

            if (banLog) {
                const { executor: logExecutor, target, reason: logReason } = banLog;
                if (target.id === user.id) {
                    executor = logExecutor;
                    reason = logReason || reason;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🚫 A Member Was Banned')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setColor('DarkRed')
                .addFields(
                    { name: 'Banned Member', value: `${user} (\`${user.id}\`)`, inline: false },
                    { name: 'Banning Staff', value: `${executor}`, inline: true },
                    { name: 'Reason', value: `${reason}`, inline: true }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        } catch (e) {
            console.error('Error logging ban:', e);
        }
    });

    client.on('guildMemberRemove', async member => {
        try {
            const guild = member.guild;
            const user = member.user;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.kickLogChannel) return;

            const logChannel = guild.channels.cache.get(gConfig.kickLogChannel);
            if (!logChannel) return;

            await new Promise(resolve => setTimeout(resolve, 2000));
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick,
            });

            const kickLog = fetchedLogs.entries.first();
            if (!kickLog) return;

            const { executor, target, reason, createdAt } = kickLog;
            if (target.id !== user.id) return;

            const timeDifference = Date.now() - createdAt.getTime();
            if (timeDifference > 30000) return;

            const kickReason = reason || 'No reason provided.';

            const embed = new EmbedBuilder()
                .setTitle('👢 A Member Was Kicked')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setColor('Orange')
                .addFields(
                    { name: 'Kicked Member', value: `${user} (\`${user.id}\`)`, inline: false },
                    { name: 'Kicking Staff', value: `${executor}`, inline: true },
                    { name: 'Reason', value: `${kickReason}`, inline: true }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        } catch (e) {
            console.error('Error logging kick:', e);
        }
    });

    client.on('guildMemberAdd', member => {
        try {
            const guild = member.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.joinLeaveLogChannel) return;

            const logChannel = guild.channels.cache.get(gConfig.joinLeaveLogChannel);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle('📥 Someone Joined the Server')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('DarkGreen')
                .addFields(
                    { name: 'Member', value: `${member.user} (\`${member.user.id}\`)`, inline: true },
                    { name: 'Account Creation', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Join log error:', e); }
    });

    client.on('guildMemberRemove', member => {
        try {
            const guild = member.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.joinLeaveLogChannel) return;

            const logChannel = guild.channels.cache.get(gConfig.joinLeaveLogChannel);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle('📤 Someone Left the Server')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('DarkRed')
                .addFields(
                    { name: 'Member', value: `${member.user} (\`${member.user.id}\`)`, inline: true }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Leave log error:', e); }
    });

    client.on('messageDelete', message => {
        try {
            if (message.author?.bot || !message.guild) return;
            const guild = message.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.messageLogChannel) return;

            const logChannel = guild.channels.cache.get(gConfig.messageLogChannel);
            if (!logChannel) return;

            const content = message.content ? (message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content) : '*[No text content or only attachment]*';

            const embed = new EmbedBuilder()
                .setTitle('🗑️ A Message Was Deleted')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setColor('Yellow')
                .addFields(
                    { name: 'Message Author', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                    { name: 'Channel', value: `${message.channel}`, inline: true },
                    { name: 'Content', value: `\`\`\`\n${content}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Message log error:', e); }
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
        try {
            const guild = newState.guild || oldState.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.voiceLogChannel) return;

            const logChannel = guild.channels.cache.get(gConfig.voiceLogChannel);
            if (!logChannel) return;

            const member = newState.member;
            if (!member || member.user.bot) return;

            let embed = new EmbedBuilder().setTimestamp().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

            if (!oldState.channelId && newState.channelId) {
                embed.setTitle('🎤 Joined Voice Channel')
                    .setColor('Green')
                    .setDescription(`${member} joined the **${newState.channel.name}** channel.`);
                return logChannel.send({ embeds: [embed] });
            }

            if (oldState.channelId && !newState.channelId) {
                embed.setTitle('🎧 Left Voice Channel')
                    .setColor('Red')
                    .setDescription(`${member} left the **${oldState.channel.name}** channel.`);
                return logChannel.send({ embeds: [embed] });
            }

            if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                embed.setTitle('🔄 Changed Voice Channel')
                    .setColor('Blue')
                    .setDescription(`${member} moved from the **${oldState.channel.name}** channel to the **${newState.channel.name}** channel.`);
                return logChannel.send({ embeds: [embed] });
            }
        } catch (e) { console.error('Voice log error:', e); }
    });

    client.on('channelDelete', channel => {
        try {
            if (!channel.guild) return;
            const guildId = channel.guild.id;
            const gConfig = getGuildConfig(guildId);
            let updated = false;

            if (gConfig.tickets && gConfig.tickets[channel.id]) {
                const ownerId = gConfig.tickets[channel.id].owner;
                if (ownerId && gConfig.openTicketsByUser && gConfig.openTicketsByUser[ownerId]) {
                    delete gConfig.openTicketsByUser[ownerId];
                }
                delete gConfig.tickets[channel.id];
                updated = true;
            }

            if (updated) {
                saveGuildConfig(guildId, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });
            }
        } catch (e) {
            console.error("Channel deletion (auto-control) error:", e);
        }
    });
}
