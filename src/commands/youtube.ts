import { inject, injectable } from 'inversify'
import { exec } from 'child_process'
import { SlashCommandBuilder } from '@discordjs/builders'
import { TYPES } from '../types.js'
import Config from '../services/config.js'
import {
  ChatInputCommandInteraction,
  AttachmentBuilder,
  Interaction,
} from 'discord.js'
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
      const filePath = await this.downloadFileWithYtDlp(query, 'worstvideo') // Assume the worst scenario - unboosted server
      await this.compressVideo(filePath)

      if (this.isFileSizeAcceptable(filePath)) {
        const fileAttachment = new AttachmentBuilder(filePath)
        await interaction.editReply({
          content: 'Download completed.',
          files: [fileAttachment],
        })
      } else {
        // File too large, send YouTube link instead
        const youtubeLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          query,
        )}`
        await interaction.editReply({
          content: `The video file is too large for Discord. Here's the YouTube link instead: ${youtubeLink}`,
        })
      }
    } catch (error) {
      console.error(error)
      await interaction.editReply({
        content: 'An error occurred while processing your request.',
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

  private async downloadFileWithYtDlp(
    query: string,
    quality?: string,
  ): Promise<string> {
    const ytDlpQuality = !quality ? 'bestvideo+bestaudio/best' : quality
    const ytSearchQuery = `ytsearch:${query}`
    const safeQuery = query.replace(/[^a-zA-Z0-9]/g, '_') // Sanitize query for filename
    const ytFilePath = path.join(outputDir, safeQuery)
    const outputTemplate = `${ytFilePath}.%(ext)s` // Include extension in output template

    return new Promise((resolve, reject) => {
      // Download the best format and convert to mp4 using ffmpeg
      exec(
        `yt-dlp -f ${ytDlpQuality} --merge-output-format mp4 -o "${outputTemplate}" "${ytSearchQuery}"`,
        async (error, stdout, stderr) => {
          if (error) {
            console.error('Error downloading from YouTube:', stderr)
            reject(error)
          } else {
            console.log('YouTube Download stdout:', stdout)
            const mp4FilePath = `${ytFilePath}.mp4` // Define the mp4 file path
            try {
              await this.compressVideo(mp4FilePath)
              resolve(mp4FilePath)
            } catch (compressError) {
              reject(compressError)
            }
          }
        },
      )
    })
  }

  private async compressVideo(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const compressedFilePath = filePath.replace('.mp4', '_compressed.mp4')
      // Estimate bitrate to target 50MB (8 * 8 * 1024 * 1024 bits)
      // Assuming a 3-minute video, adjust duration (in seconds) accordingly
      const duration = 180 // Example duration in seconds
      const targetSize = 8 * 8 * 1024 * 1024 // 8 MB in bits, 50 MB for Boosted Servers only
      const bitrate = Math.floor(targetSize / duration) // Target bitrate

      exec(
        `ffmpeg -i "${filePath}" -b:v ${bitrate} -bufsize ${bitrate} -vf "scale=iw/2:ih/2" "${compressedFilePath}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error compressing video:', stderr)
            reject(error)
          } else {
            fs.unlinkSync(filePath) // Delete the original file
            fs.renameSync(compressedFilePath, filePath) // Rename compressed file to original file name
            resolve()
          }
        },
      )
    })
  }

  private isFileSizeAcceptable(filePath: string): boolean {
    const stats = fs.statSync(filePath)
    const fileSizeInBytes = stats.size
    const maxSizeInBytes = 8 * 1024 * 1024 // 50 MB for Boosted Servers only
    return fileSizeInBytes <= maxSizeInBytes
  }
}
