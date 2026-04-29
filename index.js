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
// 🔧 CONFIGURATION
// ==========================

const MESSAGE_ROLES = "Clique sur les boutons ci-dessous pour ajouter ou retirer tes rôles.";
const ticketCooldown = new Map();
const COOLDOWN_TICKET_MS = 60 * 1000;

// 🔘 Boutons de rôles : modifie ici si tu ajoutes des rôles
const BOUTONS = [
  {
    id: "IRMA",
    label: "🪬 IRMA",
    roleId: process.env.ROLE_IRMA,
    style: ButtonStyle.Primary,
  },
  {
    id: "METEO",
    label: "🌦️ Météo",
    roleId: process.env.ROLE_METEO,
    style: ButtonStyle.Secondary,
  },
  {
    id: "news",
    label: "📰 News",
    roleId: process.env.ROLE_NEWS,
    style: ButtonStyle.Success,
  },
];

const REPONSES_AUTOMATIQUES = [
  { mots: ["bonjour", "salut", "coucou"], reponse: "Salut 👋" },
  { mots: ["merci"], reponse: "Avec plaisir ! ☕" },
  { mots: ["ticket", "problème", "probleme", "bug"], reponse: "Besoin d'aide ? Utilise la commande `/ticket` pour contacter le staff." },
];

const REACTIONS_AUTOMATIQUES = [
  { mots: ["café", "cafe"], emoji: "☕" },
  { mots: ["gg", "bravo"], emoji: "🎉" },
  { mots: ["mdr", "lol"], emoji: "😂" },
];

const PHRASES_ALEATOIRES = [
  "Je surveille discrètement 👀",
  "Quelqu’un a parlé de café ? ☕",
  "Message validé par CAFETTE ✅",
  "Je note ça dans mon carnet secret 📒",
  "Intéressant... très intéressant.",
];

// ==========================
// 🤖 CLIENT
// ==========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==========================
// 🛠️ OUTILS
// ==========================

function safeChannelName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "utilisateur";
}

function isStaffOrAdmin(interaction) {
  const isAdmin = interaction.user.id === process.env.ADMIN_ID;
  const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);
  return isAdmin || isStaff;
}

// ==========================
// 📌 COMMANDES
// ==========================

const commands = [
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ouvre un ticket privé avec le staff"),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Affiche l'aide du bot"),

  new SlashCommandBuilder()
    .setName("message")
    .setDescription("Envoyer un message simple avec le bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName("texte")
        .setDescription("Le message à envoyer")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Envoie le message avec les boutons de rôles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("Commandes enregistrées.");
  } catch (error) {
    console.error("Erreur enregistrement commandes :", error);
  }
}

// ==========================
// 🚀 BOT PRÊT
// ==========================

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  await registerCommands();
});

// ==========================
// 💬 MESSAGES AUTO / RÉACTIONS
// ==========================

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const contenu = message.content.toLowerCase();

  for (const reaction of REACTIONS_AUTOMATIQUES) {
    if (reaction.mots.some(mot => contenu.includes(mot))) {
      await message.react(reaction.emoji).catch(() => null);
    }
  }

  for (const auto of REPONSES_AUTOMATIQUES) {
    if (auto.mots.some(mot => contenu.includes(mot))) {
      await message.reply(auto.reponse).catch(() => null);
      break;
    }
  }

  if (process.env.SALON_FUN_ID && message.channel.id === process.env.SALON_FUN_ID) {
    if (Math.random() < 0.05) {
      const phrase = PHRASES_ALEATOIRES[Math.floor(Math.random() * PHRASES_ALEATOIRES.length)];
      await message.channel.send(phrase).catch(() => null);
    }
  }
});

// ==========================
// 🖱️ INTERACTIONS
// ==========================

client.on(Events.InteractionCreate, async interaction => {
  try {
    // ==========================
    // COMMANDES SLASH
    // ==========================
    if (interaction.isChatInputCommand()) {
      // --------------------------
      // /aide
      // --------------------------
      if (interaction.commandName === "aide") {
        const embed = new EmbedBuilder()
          .setTitle("📖 Aide")
          .setDescription("Commande disponible :")
          .addFields({
            name: "/ticket",
            value: "Ouvre un ticket privé avec le staff. Tape simplement `/ticket`, puis appuie sur Entrée.",
          })
          .setColor("Blue");

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // --------------------------
      // /message staff/admin
      // --------------------------
      if (interaction.commandName === "message") {
        if (!isStaffOrAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
            ephemeral: true,
          });
        }

        const texte = interaction.options.getString("texte");
        await interaction.channel.send(texte);

        return interaction.reply({
          content: "✅ Message envoyé.",
          ephemeral: true,
        });
      }

      // --------------------------
      // /setup-roles staff/admin
      // --------------------------
      if (interaction.commandName === "setup-roles") {
        if (!isStaffOrAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
            ephemeral: true,
          });
        }

        const row = new ActionRowBuilder().addComponents(
          BOUTONS.map(bouton =>
            new ButtonBuilder()
              .setCustomId(bouton.id)
              .setLabel(bouton.label)
              .setStyle(bouton.style)
          )
        );

        const embed = new EmbedBuilder()
          .setTitle("🎭 Choix des rôles")
          .setDescription(MESSAGE_ROLES)
          .setColor("Blue");

        await interaction.channel.send({ embeds: [embed], components: [row] });

        return interaction.reply({
          content: "✅ Message des rôles envoyé.",
          ephemeral: true,
        });
      }

      // --------------------------
      // /ticket
      // --------------------------
      if (interaction.commandName === "ticket") {
        const userId = interaction.user.id;
        const now = Date.now();
        const lastTicket = ticketCooldown.get(userId);

        if (lastTicket && now - lastTicket < COOLDOWN_TICKET_MS) {
          const secondes = Math.ceil((COOLDOWN_TICKET_MS - (now - lastTicket)) / 1000);
          return interaction.reply({
            content: `⏳ Attends encore ${secondes} secondes avant de refaire un ticket.`,
            ephemeral: true,
          });
        }

        const existing = interaction.guild.channels.cache.find(channel =>
          channel.name.includes(userId) && channel.name.startsWith("ticket-")
        );

        if (existing) {
          return interaction.reply({
            content: `❌ Tu as déjà un ticket ouvert : ${existing}`,
            ephemeral: true,
          });
        }

        ticketCooldown.set(userId, now);

        const staffRole = await interaction.guild.roles.fetch(process.env.STAFF_ROLE_ID);
        if (!staffRole) {
          return interaction.reply({
            content: "❌ Le rôle staff est introuvable. Vérifie STAFF_ROLE_ID.",
            ephemeral: true,
          });
        }

        const pseudo = safeChannelName(interaction.member.displayName || interaction.user.username);
        const ticketName = `ticket-${pseudo}-${userId}`.slice(0, 90);

        const ticketChannel = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: process.env.TICKET_CATEGORY_ID || null,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: userId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
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

        const closeButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("🔒 Clôturer le ticket")
            .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setTitle("🎫 Ticket ouvert")
          .setDescription(
            `Bonjour ${interaction.user}, ton ticket est ouvert.\n\nExplique clairement ta demande ici. Le staff te répondra dès que possible.`
          )
          .addFields(
            { name: "Utilisateur", value: `${interaction.user}`, inline: true },
            { name: "Statut", value: "Ouvert", inline: true }
          )
          .setColor("Green")
          .setTimestamp();

        await ticketChannel.send({
          content: `${interaction.user} <@&${staffRole.id}>`,
          embeds: [embed],
          components: [closeButton],
        });

        return interaction.reply({
          content: `✅ Ton ticket a été créé ici : ${ticketChannel}\n\nTu peux cliquer dessus et écrire directement ton message au staff.`,
          ephemeral: true,
        });
      }
    }

    // ==========================
    // BOUTONS
    // ==========================
    if (interaction.isButton()) {
      // --------------------------
      // Boutons de rôles
      // --------------------------
      const bouton = BOUTONS.find(b => b.id === interaction.customId);

      if (bouton) {
        const role = await interaction.guild.roles.fetch(bouton.roleId);

        if (!role) {
          return interaction.reply({
            content: `❌ Le rôle lié au bouton **${bouton.label}** est introuvable.`,
            ephemeral: true,
          });
        }

        if (interaction.member.roles.cache.has(role.id)) {
          await interaction.member.roles.remove(role);
          return interaction.reply({
            content: `❌ Le rôle **${role.name}** t’a été retiré.`,
            ephemeral: true,
          });
        }

        await interaction.member.roles.add(role);
        return interaction.reply({
          content: `✅ Le rôle **${role.name}** t’a été ajouté.`,
          ephemeral: true,
        });
      }

      // --------------------------
      // Clôturer ticket
      // --------------------------
      if (interaction.customId === "close_ticket") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "❌ Ce bouton ne peut être utilisé que dans un ticket.",
            ephemeral: true,
          });
        }

        if (!isStaffOrAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Seul le staff ou un admin peut clôturer ce ticket.",
            ephemeral: true,
          });
        }

        const parts = interaction.channel.name.split("-");
        const ownerId = parts[parts.length - 1];
        const closedName = interaction.channel.name
          .replace(/^ticket-/, "termine-")
          .slice(0, 90);

        await interaction.channel.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true,
        }).catch(() => null);

        await interaction.channel.setName(closedName).catch(() => null);

        const embed = new EmbedBuilder()
          .setTitle("🔒 Ticket clôturé")
          .setDescription(`Ce ticket a été clôturé par ${interaction.user}.\nL'utilisateur ne peut plus écrire ici.`)
          .setColor("Red")
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error("Erreur interaction :", error);

    if (interaction.isRepliable()) {
      const message = "❌ Une erreur est survenue. Vérifie les permissions du bot.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
      }
    }
  }
});

client.login(process.env.TOKEN);
