import { inject, injectable } from 'inversify'
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

  private readonly config: Config

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config
  }
  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query')!
    const offset = interaction.options.getInteger('offset') ?? 0
    const songQuery = query.replace(/ /g, '+')
    const url = `${this.config.DOWNLOAD_URL}${songQuery}&key=${this.config.DOWNLOAD_KEY}&offset=${offset}`

    await interaction.deferReply()

    try {
      const filePath = await this.downloadFile(url)
      const fileAttachment = new AttachmentBuilder(filePath)
      await interaction.editReply({
        content: 'Download completed.',
        files: [fileAttachment],
      })
      fs.unlinkSync(filePath) // Clean up the file after sending
    } catch (error) {
      console.error('Error occurred:', error)
      await interaction.editReply('Error occurred while downloading.')
    }
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
