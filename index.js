require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

// ==========================
// CONFIG
// ==========================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==========================
// COMMANDES
// ==========================

const commands = [
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ouvre un ticket"),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide"),

  new SlashCommandBuilder()
    .setName("message")
    .setDescription("Envoyer un message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt.setName("texte").setDescription("Message").setRequired(true)
    ),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
}

// ==========================
// READY
// ==========================

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  await registerCommands();
});

// ==========================
// INTERACTIONS
// ==========================

client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand()) {

    // ===== /aide =====
    if (interaction.commandName === "aide") {
      const embed = new EmbedBuilder()
        .setTitle("📖 Aide")
        .setDescription("Commande disponible :")
        .addFields({
          name: "/ticket",
          value: "Ouvre un ticket privé avec le staff",
        })
        .setColor("Blue");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===== /message =====
    if (interaction.commandName === "message") {
      const isAdmin = interaction.user.id === process.env.ADMIN_ID;
      const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);

      if (!isAdmin && !isStaff) {
        return interaction.reply({
          content: "❌ Pas autorisé",
          ephemeral: true,
        });
      }

      const texte = interaction.options.getString("texte");

      await interaction.channel.send(texte);

      return interaction.reply({
        content: "✅ Message envoyé",
        ephemeral: true,
      });
    }

    // ===== /ticket =====
    if (interaction.commandName === "ticket") {

      const existing = interaction.guild.channels.cache.find(
        c => c.name === `ticket-${interaction.user.id}`
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Tu as déjà un ticket : ${existing}`,
          ephemeral: true,
        });
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: process.env.TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Fermer")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}`,
        components: [btn],
      });

      return interaction.reply({
        content: `✅ Ticket créé : ${channel}`,
        ephemeral: true,
      });
    }
  }

  // ===== bouton fermer ticket =====
  if (interaction.isButton()) {
    if (interaction.customId === "close_ticket") {
      await interaction.channel.delete();
    }
  }
});

client.login(process.env.TOKEN);