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
} = require("discord.js");

// ==========================
// 🔧 CONFIGURATION DES BOUTONS
// ==========================

const MESSAGE_TEXTE = "Choisis tes rôles 👇";

const BOUTONS = [
  {
    id: "IRMA",
    label: "🪬 IRMA",
    roleId: process.env.ROLE_IRMA,
    style: ButtonStyle.Primary,
  },
  {
    id: "METEO",
    label: "🌦️ La météo",
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

// ==========================
// 🤖 CLIENT DISCORD
// ==========================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==========================
// 📌 CRÉATION DE LA COMMANDE /setup-roles
// ==========================

const commands = [
  new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Envoie le message avec les boutons de rôles"),
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

    console.log("Commande /setup-roles enregistrée.");
  } catch (error) {
    console.error(error);
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
// 🖱️ INTERACTIONS
// ==========================

client.on(Events.InteractionCreate, async interaction => {
  // Commande /setup-roles
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "setup-roles") {
      const boutons = BOUTONS.map(bouton =>
        new ButtonBuilder()
          .setCustomId(bouton.id)
          .setLabel(bouton.label)
          .setStyle(bouton.style)
      );

      const row = new ActionRowBuilder().addComponents(boutons);

      await interaction.channel.send({
        content: MESSAGE_TEXTE,
        components: [row],
      });

      return interaction.reply({
        content: "Message des rôles envoyé.",
        ephemeral: true,
      });
    }
  }

  // Clic sur un bouton
  if (interaction.isButton()) {
    const bouton = BOUTONS.find(b => b.id === interaction.customId);

    if (!bouton) return;

    const role = await interaction.guild.roles.fetch(bouton.roleId);

    if (!role) {
      return interaction.reply({
        content: "Rôle introuvable.",
        ephemeral: true,
      });
    }

    if (interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.remove(role);

      return interaction.reply({
        content: `Le rôle **${role.name}** t’a été retiré.`,
        ephemeral: true,
      });
    }

    await interaction.member.roles.add(role);

    return interaction.reply({
      content: `Le rôle **${role.name}** t’a été ajouté.`,
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);