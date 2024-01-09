import { inject, injectable } from 'inversify'
import { exec } from 'child_process'
import { SlashCommandBuilder } from '@discordjs/builders'
import { TYPES } from '../types.js'
import Config from '../services/config.js'
import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js'
import path from 'path'
import fs from 'fs'
import Command from './index.js'

const outputDir = path.join('./videos/')

@injectable()
export default class YoutubeDownloadCommand implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Download a video from a given query')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('The search query for the video')
        .setRequired(true),
    )

  private readonly config: Config

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }
    this.checkYtDlpInstalled().then(installed => {
      if (!installed) {
        console.error(
          'yt-dlp is not installed. Please install it from a package or trustworthy source.',
        )
      }
    })
  }
  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query')!
    await interaction.deferReply()

    try {
      const filePath = await this.downloadFileWithYtDlp(query)
      const fileAttachment = new AttachmentBuilder(filePath)

      await interaction.editReply({
        content: 'Download completed.',
        files: [fileAttachment],
      })
    } catch (error) {
      console.error(error)
      await interaction.editReply({
        content: 'Download failed. Request entity either too large (much more likely) or timed out.',
      })
    }
  }

  private async checkYtDlpInstalled(): Promise<boolean> {
    return new Promise(resolve => {
      exec('yt-dlp --version', error => {
        resolve(!error)
      })
    })
  }

  private async downloadFileWithYtDlp(query: string): Promise<string> {
    const ytSearchQuery = `ytsearch:${query}`;
    const safeQuery = query.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize query for filename
    const ytFilePath = path.join(outputDir, safeQuery);
    const outputTemplate = `${ytFilePath}.%(ext)s`; // Include extension in output template
  
    return new Promise((resolve, reject) => {
      // Download the best format and convert to mp4 using ffmpeg
      exec(
        `yt-dlp -f bestvideo+bestaudio/best --merge-output-format mp4 -o "${outputTemplate}" "${ytSearchQuery}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error downloading from YouTube:', stderr);
            reject(error);
          } else {
            console.log('YouTube Download stdout:', stdout);
            const mp4FilePath = `${ytFilePath}.mp4`; // Define the mp4 file path
            resolve(mp4FilePath);
          }
        },
      );
    });
  }
  
}
