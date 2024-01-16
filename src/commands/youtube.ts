import { inject, injectable } from 'inversify'
import { exec } from 'child_process'
import { SlashCommandBuilder } from '@discordjs/builders'
import { TYPES } from '../types.js'
import Config from '../services/config.js'
import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import Command from './index.js'
import { DownloadResult } from '../types.js'
import ytsr from 'ytsr'

const MAX_FILE_SIZE_MB_FOR_UNBOOSTED_SERVER = 8
const MAX_FILE_SIZE_MB_FOR_BOOSTED_SERVER = 50

const outputDir = path.join(__dirname, 'videos')

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
    const quality =
      interaction.options.getString('quality') || 'worstvideo+worstaudio/worst'

    await interaction.deferReply()

    try {
      const { videoUrl, filePath } = await this.downloadFileWithYtDlp(
        query,
        quality,
      )

      const qualityValue =
        quality === 'bestvideo+bestaudio/best'
          ? MAX_FILE_SIZE_MB_FOR_BOOSTED_SERVER
          : MAX_FILE_SIZE_MB_FOR_UNBOOSTED_SERVER
      await this.compressVideo(filePath, qualityValue)

      if (this.isFileSizeAcceptable(filePath, qualityValue)) {
        const fileAttachment = new AttachmentBuilder(filePath)
        await interaction.editReply({
          content: 'Download completed.',
          files: [fileAttachment],
        })
      } else {
        await interaction.editReply({
          content: `The video file is too large for this Discord server. Here's the direct YouTube link: ${videoUrl}`,
        })
      }
    } catch (error) {
      console.error(error)
      const videoUrl = await this.getFallbackYoutubeLink(query)
      await interaction.editReply({
        content: `Server probably not fit fore meaningful compression sizes. Here's a direct link instead: ${videoUrl}`,
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
    const ytDlpQuality = quality || 'bestvideo+bestaudio/best'
    const ytSearchQuery = `ytsearch:${query}`
    const safeQuery = query.replace(/[^a-zA-Z0-9]/g, '_') // Sanitize query for filename
    const ytFilePath = path.join(outputDir, safeQuery)
    const outputTemplate = `${ytFilePath}.%(ext)s` // Include extension in output template

    return new Promise((resolve, reject) => {
      exec(
        `yt-dlp -f ${ytDlpQuality} --get-url --merge-output-format mp4 -o "${outputTemplate}" "${ytSearchQuery}"`,
        async (error, stdout, stderr) => {
          if (error) {
            console.error('Error downloading from YouTube:', stderr)
            reject(new Error('Failed to download video.'))
          } else {
            const videoUrl = stdout.trim().split('\n')[0] // Extract the direct video URL
            const mp4FilePath = `${ytFilePath}.mp4` // Define the mp4 file path
            resolve({ filePath: mp4FilePath, videoUrl })
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
      exec(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error getting video duration:', stderr)
            reject(new Error('Failed to get video duration.'))
            return
          }

          const durationInSeconds = parseFloat(stdout)
          const targetSize = targetSizeMB * 8 * 1024 * 1024 // Convert target size to bits
          const bitrate = Math.floor(targetSize / durationInSeconds) // Calculate target bitrate

          // For better quality, I now use a two-pass encoding process with adjusted CRF (Constant Rate Factor) and preset
          const scale = targetSizeMB > 25 ? 'iw/2:ih/2' : targetSizeMB < 12 ? 'iw/4:ih/4' : '' // Adjust scale based on target size
          const compressedFilePath = filePath.replace('.mp4', '_compressed.mp4')
          const crfValue = targetSizeMB > 25 ? '23' : '28' // Lower CRF value for better quality, but higher file size
          const preset = 'slow' // Slower presets provide better compression

          // First pass with CRF and preset settings
          exec(
            `ffmpeg -i "${filePath}" -b:v ${bitrate}k -pass 1 -c:v libx264 -preset ${preset} -crf ${crfValue} -an -vf "scale=${scale}" -f mp4 -y /dev/null`,
            firstPassError => {
              if (firstPassError) {
                console.error(
                  'Error during first pass of compression:',
                  firstPassError,
                )
                reject(new Error('First pass compression failed.'))
                return
              }

              // Second pass
              exec(
                `ffmpeg -i "${filePath}" -b:v ${bitrate}k -pass 2 -c:v libx264 -preset ${preset} -crf ${crfValue} -c:a aac -b:a 128k -vf "scale=${scale}" "${compressedFilePath}"`,
                (secondPassError, compressStdout, compressStderr) => {
                  if (secondPassError) {
                    console.error(
                      'Error during second pass of compression:',
                      compressStderr,
                    )
                    reject(new Error('Second pass compression failed.'))
                  } else {
                    fs.unlinkSync(filePath) // Delete the original file
                    fs.renameSync(compressedFilePath, filePath) // Rename compressed file to original file name
                    resolve()
                  }
                },
              )
            },
          )
        },
      )
    })
  }

  private isFileSizeAcceptable(filePath: string, maxSizeMB: number): boolean {
    const stats = fs.statSync(filePath)
    const fileSizeInBytes = stats.size
    const maxSizeInBytes = maxSizeMB * 1024 * 1024
    return fileSizeInBytes <= maxSizeInBytes
  }

  private async getFallbackYoutubeLink(query: string): Promise<string> {
    try {
      const ytidFromQuery = await this.extractFirstYoutubeIdFromSearch(query)
      return `https://www.youtube.com/watch?v=${ytidFromQuery}`
    } catch (e) {
      console.error('Error extracting YouTube ID:', e)
      return 'Error: Unable to retrieve YouTube link.'
    }
  }

  private async extractFirstYoutubeIdFromSearch(
    query: string,
  ): Promise<string> {
    const searchResults = await ytsr(query, { limit: 1 })
    const firstResult = searchResults.items.find(item => item.type === 'video')
    if (!firstResult || !('id' in firstResult)) {
      throw new Error('No video found.')
    }
    return firstResult.id
  }
}
