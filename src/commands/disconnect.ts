import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import PlayerManager from '../managers/player.js';
import { TYPES } from '../types.js';
import Command from './index.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('pause and disconnect Muse');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guild: string = interaction.guild ? interaction.guild.id : '';
      const player = this.playerManager.get(guild);

      if (!player.voiceConnection) {
        throw new Error('not connected');
      }

      player.disconnect();

      await interaction.reply('Disconnected Echo, Tschüss!');
    } catch (e) {
      await interaction.reply('Echo is not connected to a voice channel');
    }
  }
}
