import { inject, injectable } from 'inversify'
import { exec } from 'child_process'
import { SlashCommandBuilder } from '@discordjs/builders'
import { TYPES } from '../types.js'
import Config from '../services/config.js'
import {
  ChatInputCommandInteraction,
  AttachmentBuilder,
  Interaction,
  StringSelectMenuComponent,
} from 'discord.js'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import Command from './index.js'
import { DownloadResult } from '../types.js'
import ytsr from 'ytsr'

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
    .addStringOption(option =>
      option
        .setName('quality')
        .setDescription('The quality of the video')
        .setRequired(false)
        .addChoices(
          { name: 'Best', value: 'bestvideo+bestaudio/best' },
          { name: 'Normal', value: 'worstvideo+worstaudio/worst' },
        ),
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
    const quality = interaction.options
      .getString('quality')
      ?.toLowerCase()
      .trim()
    await interaction.deferReply()

    try {
      const { videoUrl, filePath } = await this.downloadFileWithYtDlp( // Property videoUrl and filePath does not exist on type 'object' 
        query,
        !quality ? 'worstvideo+worstaudio+worst' : quality,
      ) // Assume the worst scenario - unboosted server
      await this.compressVideo(
        filePath,
        quality === 'bestvideo+bestaudio/best' ? 50 : 8,
      )

      if (this.isFileSizeAcceptable(filePath, 50 || 8)) {
        const fileAttachment = new AttachmentBuilder(filePath)
        await interaction.editReply({
          content: 'Download completed.',
          files: [fileAttachment],
        })
      } else {
        // File too large, send direct YouTube video link instead
        await interaction.editReply({
          content: `The video file is too large for Discord. Here's the direct YouTube link: ${videoUrl}`,
        })
      }
    } catch (error) {
      console.error(error)
      // If an error occurs, send the YouTube link
      const ytidFromQuery = await this.extractFirstYoutubeIdFromSearch(query)
      let videoURLs = []

      const videoUrl = `https://www.youtube.com/watch?v=${ytidFromQuery}`
      await interaction.editReply({
        content: `An error occurred while processing your request. Here's some results instead: ${videoUrl}`,
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
  ): Promise<DownloadResult> {
    const ytDlpQuality = !quality ? 'bestvideo+bestaudio/best' : quality
    const ytSearchQuery = `ytsearch:${query}`
    const safeQuery = query.replace(/[^a-zA-Z0-9]/g, '_') // Sanitize query for filename
    const ytFilePath = path.join(outputDir, safeQuery)
    const outputTemplate = `${ytFilePath}.%(ext)s` // Include extension in output template

    return new Promise((resolve, reject) => {
      // Download the best format and convert to mp4 using ffmpeg
      exec(
        `yt-dlp -f ${ytDlpQuality} --get-url --merge-output-format mp4 "${ytSearchQuery}"`,
        async (error, stdout, stderr) => {
          if (error) {
            console.error('Error downloading from YouTube:', stderr)
            reject(error)
          } else {
            const videoUrl = stdout.trim() // Extract the direct video URL
            const mp4FilePath = `${ytFilePath}.mp4` // Define the mp4 file path
            try {
              await this.compressVideo(mp4FilePath, 8)
              resolve({ filePath: mp4FilePath, videoUrl })
            } catch (compressError) {
              reject(compressError)
            }
          }
        },
      )
    })
  }

  

  private async compressVideo(
    filePath: string,
    targetSizeMB: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use ffprobe to get the duration of the video
      console.log('Probing size of source video...')
      exec(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error getting video duration:', stderr)
            reject(error)
            return
          }
          console.log('Source video duration:', stdout)
          const durationInSeconds = parseFloat(stdout)
          const targetSize = targetSizeMB * 8 * 1024 * 1024 // Convert target size to bits
          const bitrate = Math.floor(targetSize / durationInSeconds) // Calculate target bitrate

          const compressedFilePath = filePath.replace('.mp4', '_compressed.mp4')

          exec(
            `ffmpeg -i "${filePath}" -b:v ${bitrate} -bufsize ${bitrate} -vf "scale=iw/2:ih/2" "${compressedFilePath}"`,
            (compressError, compressStdout, compressStderr) => {
              if (compressError) {
                console.error('Error compressing video:', compressStderr)
                reject(compressError)
              } else {
                fs.unlinkSync(filePath) // Delete the original file
                fs.renameSync(compressedFilePath, filePath) // Rename compressed file to original file name
                resolve()
              }
            },
          )
        },
      )
    })
  }

  private isFileSizeAcceptable(filePath: string, quality: number): boolean {
    const stats = fs.statSync(filePath)
    const fileSizeInBytes = stats.size
    const maxSizeInBytes = quality * 1024 * 1024 // 50 MB for Boosted Servers only
    return fileSizeInBytes <= maxSizeInBytes
  }

  private async extractFirstYoutubeIdFromSearch(query: string): Promise<string> {
    const searchResults = await ytsr(query, { limit: 1 });
    const firstResult = searchResults.items.find(item => item.type === 'video');
    if (!firstResult || !('id' in firstResult)) {
      throw new Error('No video found.');
    }
    return firstResult.id;
  }
}