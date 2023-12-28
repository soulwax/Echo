import { inject, injectable } from 'inversify'
import { exec } from 'child_process'
import { SlashCommandBuilder } from '@discordjs/builders'
import { TYPES } from '../types.js'
import Config from '../services/config.js'
import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js'
import axios from 'axios'
import fs from 'fs'
import https from 'https'
import path from 'path'
import Command from './index.js'

const outputDir = path.join('../../songs/')

@injectable()
export default class DownloadCommand implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download a song from a given query')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('The search query for the song')
        .setRequired(true),
    )
    .addIntegerOption(option =>
      option.setName('offset').setDescription('Song offset').setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('kbps')
        .setDescription('The bitrate of the song')
        .setRequired(false)
        .addChoices(
          { name: '128', value: '128' },
          { name: '320', value: '320' },
        ),
    )

  private readonly config: Config

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config
  }
  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query')!
    const offset = interaction.options.getInteger('offset') ?? 0
    const songQuery = query.replace(/ /g, '+')
    const kbpsQuery = interaction.options.getString('kbps') ?? '320'
    const url = `${this.config.DOWNLOAD_URL}${songQuery}&key=${this.config.DOWNLOAD_KEY}&offset=${offset}&kbps=${kbpsQuery}`
    console.log(`Downloading song from ${url}`)
    await interaction.deferReply()

    try {
      const filePath = await this.downloadFile(url);
      const fileAttachment = new AttachmentBuilder(filePath);
      await interaction.editReply({
        content: 'Download completed.',
        files: [fileAttachment],
      });
      fs.unlinkSync(filePath); // Clean up the file after sending
    } catch (error) {
      console.error('Error occurred:', error);
  
      // Check if yt-dlp is installed before trying to use it
      this.checkYtDlpInstalled().then(async (isInstalled) => {
        if (isInstalled) {
          try {
            const ytFilePath = await this.downloadFromYouTube(query);
            const ytFileAttachment = new AttachmentBuilder(ytFilePath);
            await interaction.editReply({
              content: 'Download completed from YouTube.',
              files: [ytFileAttachment],
            });
            fs.unlinkSync(ytFilePath); // Clean up the file after sending
          } catch (ytError) {
            console.error('YouTube download error:', ytError);
            await interaction.editReply('Error occurred while downloading from YouTube.');
          }
        } else {
          await interaction.editReply('yt-dlp is not installed. Unable to download from YouTube.');
        }
      });
    }
  }

  private async downloadFromYouTube(query: string): Promise<string> {
    // Construct the YouTube search query
    const ytSearchQuery = `ytsearch1:${query}`
    const filename = `${query.replace(/ /g, '_')}.mp3`
    const ytFilePath = path.join(outputDir, filename)

    return new Promise((resolve, reject) => {
      exec(
        `yt-dlp -x --audio-format mp3 -o "${ytFilePath}" "${ytSearchQuery}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error downloading from YouTube:', stderr)
            reject(error)
          } else {
            console.log('YouTube Download stdout:', stdout)
            resolve(ytFilePath)
          }
        },
      )
    })
  }

  private async checkYtDlpInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('yt-dlp --version', (error) => {
        resolve(!error);
      });
    });
  }
  

  private async downloadFile(url: string): Promise<string> {
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    })

    // Create folder outputDir if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }

    const filename =
      response.headers['content-disposition'].split('filename=')[1]
    const filePath = path.join(outputDir, filename)
    const writer = fs.createWriteStream(filePath)

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve(filePath)
      })
      writer.on('error', reject)
    })
  }
}
